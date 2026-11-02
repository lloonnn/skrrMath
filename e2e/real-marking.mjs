// Real marking and saved results test. Needs the network, the Supabase keys, a Google key,
// Chrome and two test servers, and it makes real model calls. Not part of the normal tests.
//
// 1. cd marking-service && PORT=3002 MARK_AUTH=supabase GEMINI_MODEL=<a fast model> npm start
// 2. cd web && PORT=3002 MARK_MODE=service npx vite --host 127.0.0.1 --port 5175
// 3. google-chrome --headless=new --remote-debugging-port=9348 --user-data-dir=/tmp/p about:blank &
//    google-chrome --headless=new --remote-debugging-port=9349 --user-data-dir=/tmp/q about:blank &
// 4. node e2e/real-marking.mjs        (from the repo root, with .env present)
//
// It makes one temporary account and deletes it. It marks pen scribbles, so the result is
// "can't read": it checks the plumbing (progress steps, saving, reload, second browser, the
// changed-writing notice), not how good the marking is.
import { readFileSync } from "node:fs"
import { randomUUID } from "node:crypto"
const env = Object.fromEntries(readFileSync("/home/sl/Desktop/vscfile/skrrMath/.env", "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]))
const admin = (p, init = {}) => fetch(`${env.SUPABASE_URL}/auth/v1/admin${p}`, { ...init, headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "content-type": "application/json" } })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const check = (n, ok, x = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : "  " + x}`); ok ? pass++ : fail++ }
async function open(port) {
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
  const ws = new WebSocket(tabs.find((t) => t.type === "page").webSocketDebuggerUrl)
  await new Promise((r) => (ws.onopen = r))
  let id = 0; const pending = new Map()
  ws.onmessage = (m) => { const d = JSON.parse(m.data); pending.get(d.id)?.(d) }
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
  const ev = async (e) => (await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true })).result.result.value
  await send("Emulation.setDeviceMetricsOverride", { width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false })
  const type = async (t) => { await send("Input.insertText", { text: t }); await sleep(100) }
  const enter = () => send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 }).then(() => send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter" }))
  const panel = () => ev("document.querySelector('aside:last-of-type').innerText.replace(/\\n+/g,' | ')")
  const fillF = async (i, t) => { await ev(`document.querySelectorAll('[data-slot="sidebar-footer"] input')[${i}].focus()`); await send("Input.insertText", { text: t }) }
  const footerBtn = (t) => ev(`[...document.querySelectorAll('[data-slot="sidebar-footer"] button')].find(b=>b.textContent.trim()===${JSON.stringify(t)})?.click()`)
  const signIn = async (email, pw) => { await footerBtn("Sign in"); await sleep(300); await fillF(0, email); await fillF(1, pw); await footerBtn("Sign in"); await sleep(4500) }
  const openNote = (name) => ev(`[...document.querySelectorAll('[data-slot="sidebar-content"] button')].find(b=>b.textContent.trim()===${JSON.stringify(name)})?.click()`)
  const draw = async (yOff) => {
    const box = await ev("(()=>{const r=(document.querySelector('canvas.interactive')||document.querySelector('.excalidraw canvas')).getBoundingClientRect(); return {x:r.left,y:r.top}})()")
    await ev("document.querySelector('[data-testid=\"toolbar-freedraw\"]')?.click()"); await sleep(400)
    const y = box.y + yOff
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x + 160, y })
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: box.x + 160, y, button: "left", clickCount: 1 })
    for (let x = 0; x <= 220; x += 12) await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x + 160 + x, y: y + Math.sin(x / 15) * 12, button: "left", buttons: 1 })
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: box.x + 380, y, button: "left" })
  }
  return { send, ev, type, enter, panel, signIn, openNote, draw, goto: async (u) => { await send("Page.navigate", { url: u }); await sleep(3500) }, reload: async () => { await send("Page.reload"); await sleep(3500) }, close: () => ws.close() }
}
const email = `saved-${randomUUID().slice(0, 8)}@example.com`, password = randomUUID()
const user = await (await admin("/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true }) })).json()
const rows = async () => (await (await fetch(`${env.SUPABASE_URL}/rest/v1/pages?owner=eq.${user.id}`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } })).json())
try {
  const A = await open(9348)
  await A.goto("http://127.0.0.1:5175/"); await A.ev("localStorage.clear()"); await A.reload()
  await A.signIn(email, password)
  await A.ev("document.querySelector('[aria-label=\"Add a course\"]').click()"); await sleep(200); await A.type("Calculus"); await A.enter(); await sleep(600)
  await A.ev("document.querySelector('[aria-label=\"Add a note\"]').click()"); await sleep(200); await A.type("Test"); await A.enter(); await sleep(2500)
  await A.ev(`(async () => {
    const c = document.createElement('canvas'); c.width = 500; c.height = 100
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0,0,500,100); g.fillStyle = '#000'; g.font = '24px sans-serif'; g.fillText('Solve 2x + 6 = 14', 10, 55)
    const blob = await new Promise(r => c.toBlob(r, 'image/png'))
    const dt = new DataTransfer(); dt.items.add(new File([blob], 'q.png', { type: 'image/png' }))
    const t = document.querySelector('canvas.interactive') || document.querySelector('.excalidraw canvas')
    const r = t.getBoundingClientRect(); const o = { dataTransfer: dt, bubbles: true, cancelable: true, clientX: r.left + 150, clientY: r.top + 120 }
    t.dispatchEvent(new DragEvent('dragenter', o)); t.dispatchEvent(new DragEvent('dragover', o)); t.dispatchEvent(new DragEvent('drop', o))
  })()`)
  await sleep(2000)
  for (let l = 0; l < 3; l++) await A.draw(330 + l * 60)
  await sleep(1500)

  // press Mark and watch the progress text
  await A.ev("[...document.querySelectorAll('aside button')].find(b=>b.textContent.trim()==='Mark').click()")
  const seen = []
  let finished = false
  for (let i = 0; i < 100 && !finished; i++) {
    await sleep(1500)
    const t = await A.panel()
    const m = t.match(/(Starting|Reading your writing|Finding the lines|Solving the question[^|]*?|Comparing the two solutions|Marking line by line)\.\.\.\s*(\d+) s/)
    if (m && !seen.includes(m[1])) seen.push(m[1])
    finished = !/Marking\.\.\./.test(t) && !m
  }
  console.log("progress steps seen, in order:", JSON.stringify(seen))
  check("progress steps were shown while marking", seen.length >= 2, JSON.stringify(seen))
  const result = await A.panel()
  check("a result is shown", /AI-checked|Can't read|No error|Mistake/.test(result), result.slice(0, 200))
  await sleep(9000)
  const status = await A.ev("document.querySelector('[role=status]').innerText")
  check("the note is saved after marking", status === "Saved", status)
  const pages = await rows()
  check("the marking result is in the account", pages.length === 1 && Object.keys(pages[0].strokes?.marks ?? {}).length === 1, JSON.stringify(Object.keys(pages[0]?.strokes ?? {})))
  const m0 = Object.values(pages[0].strokes.marks)[0]
  check("the saved mark has the picture, the result, the stroke count and a time", m0.imageUrl.startsWith("data:image/png;base64,") && m0.result.status && typeof m0.strokes === "number" && m0.at, Object.keys(m0).join())
  console.log("saved picture size (KB):", Math.round(m0.imageUrl.length / 1024))

  // reload: the mark must come back
  await A.reload(); await A.openNote("Test"); await sleep(4000)
  const after = await A.panel()
  check("after a reload the mark is still there", after === result || (/AI-checked|Can't read|No error|Mistake/.test(after) && !/Mark all \| 1 question \| Question 1 \| Calculus · Test \| Mark \| (Write|Sign)/.test(after)), after.slice(0, 200))

  // a second browser sees it
  const B = await open(9349)
  await B.goto("http://127.0.0.1:5175/"); await B.ev("localStorage.clear()"); await B.reload()
  await B.signIn(email, password); await B.openNote("Test"); await sleep(4500)
  const other = await B.panel()
  check("a second browser shows the same mark", /AI-checked|Can't read|No error|Mistake/.test(other), other.slice(0, 200))

  // change the writing: the notice
  await A.draw(520); await sleep(1500)
  const stale = await A.panel()
  check("changing the writing shows the notice", stale.includes("You changed your writing after this was marked"), stale.slice(0, 260))
  A.close(); B.close()
} catch (e) { console.log("ERROR", e.message); fail++ } finally {
  await admin(`/users/${user.id}`, { method: "DELETE" })
  console.log("temporary user deleted")
}
console.log(`\n${pass} passed, ${fail} failed`)
