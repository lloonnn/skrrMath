// Step 3 test (docs/LECTURER-PLAN.md): does Mark look up the lecturer's book and send it? No AI is used:
// the page's fetch for /api/mark is replaced by a canned reply, and the request the app sends is recorded.
// Needs Chrome, the Supabase keys in .env (two temporary accounts, deleted at the end) and a test server
// in SERVICE mode (Mark needs a signed-in user, and a stroke below the question):
//
// 1. cd web && MARK_MODE=service npx vite --host 127.0.0.1 --port 5180 --strictPort
// 2. google-chrome --headless=new --remote-debugging-port=9353 --user-data-dir=/tmp/b about:blank &
// 3. node --env-file=.env e2e/book-lookup.mjs        (from the repo root)
//
// It uses made-up course codes (TEST7777...) and never touches real books. It never prints keys.
import { randomUUID } from "node:crypto"
const { SUPABASE_URL: url, SUPABASE_ANON_KEY: anon, SUPABASE_SERVICE_ROLE_KEY: service } = process.env
if (!url || !anon || !service) throw new Error("Needs SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in .env")
const admin = (p, init = {}) => fetch(`${url}/auth/v1/admin${p}`, { ...init, headers: { apikey: service, authorization: `Bearer ${service}`, "content-type": "application/json" } })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const check = (n, ok, x = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : "  " + x}`); ok ? pass++ : fail++ }
const svc = (path, init = {}) => fetch(`${url}/rest/v1/${path}`, { ...init, headers: { apikey: service, authorization: `Bearer ${service}`, "content-type": "application/json", prefer: "return=representation", ...init.headers } })
const mk = async (tag) => { const email = `bk-${tag}-${randomUUID().slice(0, 8)}@example.com`, password = randomUUID(); const u = await (await admin("/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true }) })).json(); return { id: u.id, email, password } }
const created = []
try {
  const S = await mk("s"); created.push(S)
  const L = await mk("l"); created.push(L)
  const book = (course, exam, extra = {}) => svc("bank_solutions", { method: "POST", body: JSON.stringify({ course_code: course, exam, answer_text: "Q1: x = 4. Q2: x = 5.", lecturer: L.id, ...extra }) })
  await book("TEST7777", "2099 may")
  await book("TEST7779", "2099 may", { withdrawn: true })

  const tabs = await (await fetch("http://127.0.0.1:9353/json")).json()
  const ws = new WebSocket(tabs.find((t) => t.type === "page").webSocketDebuggerUrl)
  await new Promise((r) => (ws.onopen = r))
  let id = 0; const pending = new Map()
  ws.onmessage = (m) => { const d = JSON.parse(m.data); pending.get(d.id)?.(d) }
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
  const ev = async (e) => (await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true })).result.result.value
  const type = async (t) => { await send("Input.insertText", { text: t }); await sleep(120) }
  const enter = () => send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 }).then(() => send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter" }))
  await send("Emulation.setDeviceMetricsOverride", { width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false })
  await send("Page.navigate", { url: "http://127.0.0.1:5180/" }); await sleep(3500)
  await ev("localStorage.clear()"); await send("Page.reload"); await sleep(3000)
  const fillF = async (i, t) => { await ev(`document.querySelectorAll('[data-slot="sidebar-footer"] input')[${i}].focus()`); await send("Input.insertText", { text: t }) }
  const footerBtn = (t) => ev(`[...document.querySelectorAll('[data-slot="sidebar-footer"] button')].find(b=>b.textContent.trim()===${JSON.stringify(t)})?.click()`)
  await footerBtn("Sign in"); await sleep(300); await fillF(0, S.email); await fillF(1, S.password); await footerBtn("Sign in"); await sleep(5500)

  // The canned reply, and a recorder for what the app sends.
  await ev(`window.__sent = []; const real = window.fetch.bind(window); window.fetch = async (u, o) => {
    if (String(u).includes('/api/mark')) {
      window.__sent.push(JSON.parse(o.body))
      const result = { status: 'marked', question_restated: 'q', lines: [{ n: 1, latex: 'x', readable: true, verdict: 'ok', comment: '', correct_latex: null, box: null }], first_error_line: null, error_type: null, final_answer: { matches_reference: 'yes', student_latex: 'x', reference_latex: 'x = 4' }, method_ok: true, reference_source: 'verified_bank', solve_runs_agree: null, summary: 'canned', model: 'canned' }
      return new Response(JSON.stringify({ type: 'step', step: 'marking' }) + '\\n' + JSON.stringify({ type: 'result', result }) + '\\n', { status: 200, headers: { 'content-type': 'application/x-ndjson' } })
    }
    return real(u, o)
  }`)
  const addCourse = async (name) => { await ev("document.querySelector('[aria-label=\"Add a course\"]').click()"); await sleep(200); await type(name); await enter(); await sleep(700) }
  const addNote = async (course, name) => { await ev(`document.querySelector('[aria-label="Options for ${course}"]').closest('div').querySelector('[aria-label="Add a note"]').click()`); await sleep(200); await type(name); await enter(); await sleep(2500) }
  const question = async () => { await ev(`(async () => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 90
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0,0,400,90); g.fillStyle = '#000'; g.font = '22px sans-serif'; g.fillText('Question 1. Solve it.', 10, 50)
    const blob = await new Promise(r => c.toBlob(r, 'image/png'))
    const dt = new DataTransfer(); dt.items.add(new File([blob], 'q.png', { type: 'image/png' }))
    const t = document.querySelector('canvas.interactive') || document.querySelector('.excalidraw canvas')
    const r = t.getBoundingClientRect(); const o = { dataTransfer: dt, bubbles: true, cancelable: true, clientX: r.left + 150, clientY: r.top + 130 }
    t.dispatchEvent(new DragEvent('dragenter', o)); t.dispatchEvent(new DragEvent('dragover', o)); t.dispatchEvent(new DragEvent('drop', o))
  })()`); await sleep(1800) }
  const scribble = async () => {
    const box = await ev("(()=>{const r=(document.querySelector('canvas.interactive')||document.querySelector('.excalidraw canvas')).getBoundingClientRect(); return {x:r.left,y:r.top}})()")
    await ev("document.querySelector('[data-testid=\"toolbar-freedraw\"]')?.click()"); await sleep(400)
    const y = box.y + 330, x0 = box.x + 460
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x0, y }); await send("Input.dispatchMouseEvent", { type: "mousePressed", x: x0, y, button: "left", clickCount: 1 })
    for (let x = 0; x <= 200; x += 12) await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x0 + x, y: y + Math.sin(x / 14) * 10, button: "left", buttons: 1 })
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x0 + 220, y, button: "left" }); await sleep(800)
  }
  const markAndRead = async () => { const n = await ev("window.__sent.length"); await ev("[...document.querySelectorAll('aside button')].find(b=>b.textContent.trim()==='Mark').click()"); for (let i = 0; i < 30 && (await ev("window.__sent.length")) === n; i++) await sleep(500); await sleep(800); return ev("window.__sent.at(-1)") }
  const run = async (course, note) => { await addCourse(course); await addNote(course, note); await question(); await scribble(); return markAndRead() }

  const a = await run("TEST7777", "May 2099")
  check("with a lecturer's book, the book is sent with the request", a?.verifiedAnswer?.kind === "text" && a.verifiedAnswer.text.includes("Q1: x = 4") && a.verifiedAnswer.book === true, JSON.stringify(a?.verifiedAnswer)?.slice(0, 120))
  check("the panel says it was checked against a lecturer's solution", (await ev("document.querySelector('aside:last-of-type').innerText")).includes("Checked against a lecturer's solution"))
  const b = await run("TEST7778", "May 2099")
  check("with no book for the paper, nothing is sent as a reference", b && b.verifiedAnswer === undefined, JSON.stringify(b?.verifiedAnswer))
  const c = await run("Calculus", "May 2099")
  check("a course not named like a code looks up nothing", c && c.verifiedAnswer === undefined)
  const d = await run("TEST7779", "May 2099")
  check("a withdrawn book is not sent", d && d.verifiedAnswer === undefined)
  // the student's own answer wins over the book (a second note of the same course, same paper)
  await addNote("TEST7777", "2099 May"); await question(); await scribble()
  await ev("[...document.querySelectorAll('aside button')].find(b => b.textContent.includes('Correct answer'))?.click()"); await sleep(500)
  await ev("document.querySelector('aside textarea').focus()"); await send("Input.insertText", { text: "my own answer" }); await sleep(700)
  const n = await ev("window.__sent.length")
  await ev("[...document.querySelectorAll('aside button')].find(b=>b.textContent.trim()==='Mark').click()")
  for (let i = 0; i < 30 && (await ev("window.__sent.length")) === n; i++) await sleep(500)
  const e = await ev("window.__sent.at(-1)")
  check("the student's own correct answer is sent instead of the book", e?.verifiedAnswer?.text === "my own answer" && e.verifiedAnswer.book === undefined, JSON.stringify(e?.verifiedAnswer)?.slice(0, 100))
  ws.close()
} catch (e) { console.log("ERROR", e.message); fail++ } finally {
  for (const u of created) await admin(`/users/${u.id}`, { method: "DELETE" })
  console.log("temporary users removed (their books go with them)")
}
console.log(`\n${pass} passed, ${fail} failed`)
