// Phase 1 test (docs/LECTURER-PLAN.md): the question key. Needs Chrome, the Supabase keys in .env
// (it makes one temporary account and deletes it), and a test server in DEMO mode:
//
// 1. cd web && MARK_MODE=demo npx vite --host 127.0.0.1 --port 5177 --strictPort
// 2. google-chrome --headless=new --remote-debugging-port=9351 --user-data-dir=/tmp/k about:blank &
// 3. node --env-file=.env e2e/question-keys.mjs        (from the repo root)
//
// It never prints keys. Not part of the normal tests.
import { randomUUID } from "node:crypto"

const { SUPABASE_URL: url, SUPABASE_ANON_KEY: anon, SUPABASE_SERVICE_ROLE_KEY: service } = process.env
if (!url || !anon || !service) throw new Error("Needs SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in .env")
const admin = (p, init = {}) => fetch(`${url}/auth/v1/admin${p}`, { ...init, headers: { apikey: service, authorization: `Bearer ${service}`, "content-type": "application/json" } })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const check = (n, ok, x = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : "  " + x}`); ok ? pass++ : fail++ }

const email = `keys-${randomUUID().slice(0, 8)}@example.com`, password = randomUUID()
const user = await (await admin("/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true }) })).json()
const rows = async (table) => (await (await fetch(`${url}/rest/v1/${table}?owner=eq.${user.id}`, { headers: { apikey: service, authorization: `Bearer ${service}` } })).json())

try {
  const tabs = await (await fetch("http://127.0.0.1:9351/json")).json()
  const ws = new WebSocket(tabs.find((t) => t.type === "page").webSocketDebuggerUrl)
  await new Promise((r) => (ws.onopen = r))
  let id = 0; const pending = new Map()
  ws.onmessage = (m) => { const d = JSON.parse(m.data); pending.get(d.id)?.(d) }
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
  const ev = async (e) => (await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true })).result.result.value
  const type = async (t) => { await send("Input.insertText", { text: t }); await sleep(120) }
  const enter = () => send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 }).then(() => send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter" }))
  const list = () => ev("document.querySelector('[data-slot=\"sidebar-content\"]')?.innerText.replace(/\\n+/g,' | ')")
  const keyLine = () => ev("[...document.querySelectorAll('[data-testid=question-key]')].map(e => e.innerText).join(' || ')")
  const addCourse = async (name) => { await ev("document.querySelector('[aria-label=\"Add a course\"]').click()"); await sleep(200); await type(name); await enter(); await sleep(500) }
  const addNote = async (courseName, name) => { await ev(`document.querySelector('[aria-label="Options for ${courseName}"]').closest('div').querySelector('[aria-label="Add a note"]').click()`); await sleep(200); await type(name); await enter(); await sleep(2200) }
  const openNote = (name) => ev(`[...document.querySelectorAll('[data-slot="sidebar-content"] button')].find(b => b.textContent.trim() === ${JSON.stringify(name)})?.click()`)
  const dropQuestion = async (y = 130) => { await ev(`(async () => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 90
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0,0,400,90); g.fillStyle = '#000'; g.font = '22px sans-serif'; g.fillText('Question ' + Math.random().toFixed(3), 10, 50)
    const blob = await new Promise(r => c.toBlob(r, 'image/png'))
    const dt = new DataTransfer(); dt.items.add(new File([blob], 'q' + Math.random() + '.png', { type: 'image/png' }))
    const t = document.querySelector('canvas.interactive') || document.querySelector('.excalidraw canvas')
    const r = t.getBoundingClientRect(); const o = { dataTransfer: dt, bubbles: true, cancelable: true, clientX: r.left + 150, clientY: r.top + ${y} }
    t.dispatchEvent(new DragEvent('dragenter', o)); t.dispatchEvent(new DragEvent('dragover', o)); t.dispatchEvent(new DragEvent('drop', o))
  })()`); await sleep(1800) }
  const setLabel = async (value) => { await ev("document.querySelector('[aria-label=\"Question label\"]').focus()"); await ev("document.querySelector('[aria-label=\"Question label\"]').select()"); await type(value); await sleep(500) }
  const optionsMenu = async (courseName, item) => { await ev(`document.querySelector('[aria-label="Options for ${courseName}"]').click()`); await sleep(500); await ev(`[...document.querySelectorAll('[role=menuitem]')].find(e => e.textContent.trim() === ${JSON.stringify(item)})?.click()`); await sleep(400) }
  await send("Emulation.setDeviceMetricsOverride", { width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false })
  await send("Page.navigate", { url: "http://127.0.0.1:5177/" }); await sleep(3500)
  await ev("localStorage.clear()"); await send("Page.reload"); await sleep(3000)

  // ---- as a guest
  await addCourse("Calculus II")
  await addNote("Calculus II", "2023 May")
  await dropQuestion()
  check("the question shows what its key still needs", (await keyLine()).includes("Key needs: course code, question label"), await keyLine())

  await optionsMenu("Calculus II", "Course code"); await type("uecm 2323"); await enter(); await sleep(600)
  check("the course code is cleaned and shown under the course name", (await list()).includes("UECM2323"), await list())
  check("the key now needs only the question label", (await keyLine()).includes("Key needs: question label"), await keyLine())

  await setLabel("Q23(a)")
  check("the full key shows", (await keyLine()).includes("Key: UECM2323 · 2023 may · 23a"), await keyLine())

  await addNote("Calculus II", "May 2023")
  await dropQuestion()
  await setLabel("23 a")
  check("the same exam and question typed another way gives the same key", (await keyLine()).includes("Key: UECM2323 · 2023 may · 23a"), await keyLine())

  await addCourse("uecm 2353")
  await addNote("uecm 2353", "2023 May")
  await dropQuestion()
  await setLabel("1")
  check("a course named like a code needs no code to be typed", (await keyLine()).includes("Key: UECM2353 · 2023 may · 1"), await keyLine())

  await sleep(1500)
  await send("Page.reload"); await sleep(3500)
  await openNote("2023 May"); await sleep(2500)
  // two notes are called 2023 May (one per course): the first in the list is Calculus II's
  const afterReload = await keyLine()
  check("after a reload the course code and label are still there", afterReload.includes("Key: UECM2323 · 2023 may · 23a"), afterReload)
  check("after a reload the course code is still under the name", (await list()).includes("UECM2323"))

  await optionsMenu("Calculus II", "Course code"); await type("not a code!"); await enter(); await sleep(500)
  check("a bad course code is refused with a message", (await list()).includes("letters then numbers"), await list())
  await ev("[...document.querySelectorAll('[data-slot=\"sidebar-content\"] button')].find(b => b.textContent.trim() === 'Cancel')?.click()"); await sleep(300)

  // ---- sign in: the guest course code and the labels go up with the list
  const fillF = async (i, t) => { await ev(`document.querySelectorAll('[data-slot="sidebar-footer"] input')[${i}].focus()`); await send("Input.insertText", { text: t }) }
  const footerBtn = (t) => ev(`[...document.querySelectorAll('[data-slot="sidebar-footer"] button')].find(b=>b.textContent.trim()===${JSON.stringify(t)})?.click()`)
  await footerBtn("Sign in"); await sleep(300); await fillF(0, email); await fillF(1, password); await footerBtn("Sign in"); await sleep(6000)
  const courses = await rows("courses")
  const calc = courses.find((c) => c.name === "Calculus II")
  check("the course code reached the account", calc?.course_code === "UECM2323", JSON.stringify(courses.map((c) => [c.name, c.course_code])))
  check("a course with no hand-set code has none stored (it is worked out from the name)", courses.find((c) => c.name === "uecm 2353")?.course_code === null)
  const pages = await rows("pages")
  const labels = pages.map((p) => Object.values(p.strokes?.labels ?? {})).flat().sort()
  check("the question labels reached the account", labels.includes("Q23(a)") && labels.includes("23 a") && labels.includes("1"), JSON.stringify(labels))

  // ---- signed in: clear the course code
  await openNote("2023 May"); await sleep(3500)
  await optionsMenu("Calculus II", "Course code")
  await ev("document.querySelector('[data-slot=\"sidebar-content\"] input').select()"); await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8 }); await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Backspace", code: "Backspace" })
  await enter(); await sleep(2500)
  check("clearing the course code clears it in the account", (await rows("courses")).find((c) => c.name === "Calculus II")?.course_code === null)
  ws.close()
} catch (e) {
  console.log("ERROR", e.message); fail++
} finally {
  await admin(`/users/${user.id}`, { method: "DELETE" })
  console.log("temporary user deleted")
}
console.log(`\n${pass} passed, ${fail} failed`)
