// Step 2 test (docs/LECTURER-PLAN.md): the lecturer screen. Needs Chrome, the Supabase keys in .env
// (it makes two temporary accounts and deletes them) and a test server:
//
// 1. cd web && MARK_MODE=demo npx vite --host 127.0.0.1 --port 5179 --strictPort
// 2. google-chrome --headless=new --remote-debugging-port=9352 --user-data-dir=/tmp/l about:blank &
// 3. node --env-file=.env e2e/lecturer-screen.mjs        (from the repo root)
//
// If no lecturer code is stored yet, it stores a throwaway one and removes it after. If a code is stored,
// it uses LECTURER_CODE from .env (and leaves the stored code alone). It never prints keys or codes. Not part of the normal tests.
import { randomUUID } from "node:crypto"

const { SUPABASE_URL: url, SUPABASE_ANON_KEY: anon, SUPABASE_SERVICE_ROLE_KEY: service } = process.env
if (!url || !anon || !service) throw new Error("Needs SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in .env")
const admin = (p, init = {}) => fetch(`${url}/auth/v1/admin${p}`, { ...init, headers: { apikey: service, authorization: `Bearer ${service}`, "content-type": "application/json" } })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const check = (n, ok, x = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : "  " + x}`); ok ? pass++ : fail++ }
const rest = async (path, token, init = {}) => (await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { apikey: token === service ? service : anon, authorization: `Bearer ${token}`, "content-type": "application/json", prefer: "return=representation", ...init.headers } })).json()
async function user(tag) {
  const email = `lec-${tag}-${randomUUID().slice(0, 8)}@example.com`, password = randomUUID()
  const u = await (await admin("/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true }) })).json()
  const t = await (await fetch(`${url}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: anon, "content-type": "application/json" }, body: JSON.stringify({ email, password }) })).json()
  return { id: u.id, email, password, token: t.access_token }
}

const created = []
let tempCode = null
try {
  const L = await user("l"); created.push(L)
  const S = await user("s"); created.push(S)
  const probe = await (await fetch(`${url}/rest/v1/rpc/claim_lecturer`, { method: "POST", headers: { apikey: anon, authorization: `Bearer ${S.token}`, "content-type": "application/json" }, body: JSON.stringify({ code: "not-the-code" }) })).json()
  // Which code to use: the real one from .env if a code is stored, or a throwaway one if none is.
  let code = process.env.LECTURER_CODE
  if (probe === "not_set") {
    tempCode = "test-" + randomUUID().slice(0, 8)
    code = tempCode
    await fetch(`${url}/rest/v1/rpc/set_lecturer_code`, { method: "POST", headers: { apikey: service, authorization: `Bearer ${service}`, "content-type": "application/json" }, body: JSON.stringify({ code }) })
  } else if (!code) {
    throw new Error("A lecturer code is stored but LECTURER_CODE is not in .env, so this test cannot claim.")
  } else if (probe === "locked") {
    throw new Error("The wrong-code limit is active (30 wrong tries in the last hour). Try again later.")
  }

  const tabs = await (await fetch("http://127.0.0.1:9352/json")).json()
  const ws = new WebSocket(tabs.find((t) => t.type === "page").webSocketDebuggerUrl)
  await new Promise((r) => (ws.onopen = r))
  let id = 0; const pending = new Map()
  ws.onmessage = (m) => { const d = JSON.parse(m.data); pending.get(d.id)?.(d) }
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
  const ev = async (e) => (await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true })).result.result.value
  const type = async (t) => { await send("Input.insertText", { text: t }); await sleep(120) }
  const focusSel = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); e.focus(); e.select?.(); })()`)
  const typeInto = async (sel, text) => { await focusSel(sel); await type(text) }
  const clickText = (t, scope = "") => ev(`[...document.querySelectorAll('${scope} button')].find(b => b.textContent.trim() === ${JSON.stringify(t)})?.click()`)
  const page = () => ev("document.body.innerText.replace(/\\n+/g,' | ')")
  await send("Emulation.setDeviceMetricsOverride", { width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false })
  await send("Page.navigate", { url: "http://127.0.0.1:5179/" }); await sleep(3500)
  await ev("localStorage.clear(); window.confirm = () => true"); await send("Page.reload"); await sleep(3000)

  // sign in
  await ev("window.confirm = () => true")
  await clickText("Sign in", '[data-slot="sidebar-footer"]'); await sleep(300)
  await typeInto('[data-slot="sidebar-footer"] input[type=email]', L.email); await typeInto('[data-slot="sidebar-footer"] input[type=password]', L.password)
  await clickText("Sign in", '[data-slot="sidebar-footer"]'); await sleep(5000)
  await ev("window.confirm = () => true")
  check("a signed-in person sees a Lecturer button", (await ev("[...document.querySelectorAll('[data-slot=\"sidebar-footer\"] button')].some(b => b.textContent.trim() === 'Lecturer')")))
  await clickText("Lecturer", '[data-slot="sidebar-footer"]'); await sleep(1500)
  check("a person who is not a lecturer is asked for the code", (await page()).includes("Give the lecturer code"), (await page()).slice(0, 200))

  await typeInto('input[placeholder="Lecturer code"]', "wrong-code"); await clickText("Continue"); await sleep(1500)
  check("a wrong code gives a clear message", (await page()).includes("That code is not right."))
  await typeInto('input[placeholder="Lecturer code"]', code); await clickText("Continue"); await sleep(2500)
  check("the right code opens the book form", (await page()).includes("Add an answer book"), (await page()).slice(0, 200))

  // add a book
  await clickText("Save the book"); await sleep(600)
  check("saving an empty form says what is missing", (await page()).includes("course code should be letters then numbers"))
  await typeInto('input[aria-label="Course code"]', "calculus"); await typeInto('input[aria-label="Exam"]', "May 2023"); await clickText("Save the book"); await sleep(500)
  check("a course name that is not a code is refused", (await page()).includes("course code should be letters then numbers"))
  await typeInto('input[aria-label="Course code"]', " uecm 2353 "); await sleep(300)
  check("the cleaned paper is shown", (await ev("document.querySelector('[data-testid=paper-key]')?.innerText")).includes('UECM2353') && (await ev("document.querySelector('[data-testid=paper-key]')?.innerText")).includes('2023 may'))
  await typeInto('textarea[aria-label="Solutions"]', "Q1: x = 4.\nQ2: x = 5."); await clickText("Save the book"); await sleep(2500)
  check("the book appears in the list", (await ev("document.querySelector('[data-testid=book]')?.innerText")).includes("UECM2353") , await ev("document.querySelector('[data-testid=book]')?.innerText"))
  const rows = await rest(`bank_solutions?lecturer=eq.${L.id}`, service)
  check("it is saved with the cleaned course and exam", rows.length === 1 && rows[0].course_code === "UECM2353" && rows[0].exam === "2023 may" && rows[0].answer_text.startsWith("Q1"), JSON.stringify(rows).slice(0, 160))

  // a student can read it
  check("a student can read the live book", (await rest("bank_solutions?course_code=eq.UECM2353&exam=eq.2023%20may", S.token)).length === 1)

  // a second book for the same paper is refused
  await typeInto('input[aria-label="Course code"]', "UECM2353"); await typeInto('input[aria-label="Exam"]', "2023 may"); await typeInto('textarea[aria-label="Solutions"]', "another"); await clickText("Save the book"); await sleep(1500)
  check("a second live book for the same paper is refused with a message", (await page()).includes("already a book for this paper"), (await page()).slice(0, 300))

  // change it
  await clickText("Change"); await sleep(500)
  await typeInto('textarea[aria-label="Change the solutions"]', "Q1: x = 4.\nQ2: x = 6 (corrected)."); await ev("[...document.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Save').at(-1)?.click()"); await sleep(2000)
  const after = await rest(`bank_solutions?lecturer=eq.${L.id}`, service)
  check("changing the solutions saves them and raises the version", after[0].version === 2 && after[0].answer_text.includes("corrected"), JSON.stringify(after).slice(0, 160))

  // withdraw
  await clickText("Withdraw"); await sleep(2000)
  const gone = await rest(`bank_solutions?lecturer=eq.${L.id}`, service)
  check("withdrawing marks it withdrawn", gone[0].withdrawn === true)
  check("a student can no longer read it", (await rest("bank_solutions?course_code=eq.UECM2353&exam=eq.2023%20may", S.token)).length === 0)
  check("the lecturer still sees it in their list, marked withdrawn", (await ev("document.querySelector('[data-testid=book]')?.innerText")).includes("withdrawn"))

  // a picture book, and changing it
  const putPicture = (sel) => ev(`(async () => {
    const c = document.createElement('canvas'); c.width = 300; c.height = 120
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0,0,300,120); g.fillStyle = '#000'; g.font = '28px sans-serif'; g.fillText('Q1: x = 4', 10, 60)
    const blob = await new Promise(r => c.toBlob(r, 'image/png'))
    const dt = new DataTransfer(); dt.items.add(new File([blob], 'solutions.png', { type: 'image/png' }))
    const input = document.querySelector(${JSON.stringify(sel)})
    input.files = dt.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })()`)
  await typeInto('input[aria-label="Course code"]', "uecm 2354"); await typeInto('input[aria-label="Exam"]', "May 2023")
  await putPicture('input[type=file]'); await sleep(1500)
  check("a chosen picture is shown as added", (await page()).includes("A picture of the solutions is added"))
  await clickText("Save the book"); await sleep(2500)
  const pic = (await rest(`bank_solutions?lecturer=eq.${L.id}&course_code=eq.UECM2354`, service))[0]
  check("a picture book is saved with the picture and no text", pic?.answer_image?.length > 100 && pic?.answer_text === null && pic?.answer_image_type === "image/jpeg", JSON.stringify(Object.keys(pic ?? {})))
  const buttons = () => ev("[...document.querySelectorAll('[data-testid=book]')].find(b => b.innerText.includes('UECM2354'))?.innerText")
  check("a picture book has a Change button too", await ev("[...document.querySelectorAll('[data-testid=book]')].find(b => b.innerText.includes('UECM2354')) && [...[...document.querySelectorAll('[data-testid=book]')].find(b => b.innerText.includes('UECM2354')).querySelectorAll('button')].some(x => x.textContent.trim() === 'Change')"), await buttons())
  const clickInBook = (label) => ev(`[...[...document.querySelectorAll('[data-testid=book]')].find(b => b.innerText.includes('UECM2354')).querySelectorAll('button')].find(x => x.textContent.trim() === ${JSON.stringify(label)})?.click()`)
  await clickInBook("Change"); await sleep(500)
  await typeInto('textarea[aria-label="Change the solutions"]', "Q1: x = 4 (now typed)"); await ev("[...document.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Save').at(-1)?.click()"); await sleep(2000)
  const asText = (await rest(`bank_solutions?lecturer=eq.${L.id}&course_code=eq.UECM2354`, service))[0]
  check("a picture book can be changed to text (version 2, picture gone)", asText.answer_text?.includes("now typed") && asText.answer_image === null && asText.version === 2, JSON.stringify({ v: asText.version, t: asText.answer_text, i: asText.answer_image === null }))
  await clickInBook("Change"); await sleep(500)
  await putPicture('input[aria-label="New picture"]'); await sleep(1500)
  check("a new picture is shown as ready to replace the text", (await page()).includes("A new picture will replace the solutions"))
  await ev("[...document.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Save').at(-1)?.click()"); await sleep(2000)
  const asPic = (await rest(`bank_solutions?lecturer=eq.${L.id}&course_code=eq.UECM2354`, service))[0]
  check("a text book can be changed to a picture (version 3, text gone)", asPic.answer_image?.length > 100 && asPic.answer_text === null && asPic.version === 3, JSON.stringify({ v: asPic.version, t: asPic.answer_text, i: asPic.answer_image?.length }))
  ws.close()
} catch (e) {
  console.log("ERROR", e.message); fail++
} finally {
  if (tempCode) await fetch(`${url}/rest/v1/app_secrets?name=eq.lecturer_code_hash`, { method: "DELETE", headers: { apikey: service, authorization: `Bearer ${service}` } })
  for (const u of created) await admin(`/users/${u.id}`, { method: "DELETE" })
  console.log(tempCode ? "the throwaway code and the temporary users were removed" : "temporary users removed")
}
console.log(`\n${pass} passed, ${fail} failed`)
