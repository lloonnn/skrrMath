// Test of "Your correct answer" (the verified-answer area). Needs the network, the Supabase
// keys, a Google key, Chrome and two test servers, and it makes a real model call. Not part of
// the normal tests. Same setup as e2e/real-marking.mjs (steps 1 to 4, but run this file).
//
// It marks pen scribbles against the typed answer "x = 4", so it checks the plumbing (the label,
// saving, reload, the notice, pasting a picture), not how good the marking is.
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

  // open "Your correct answer" and type a reference
  const trig = () => A.ev("[...document.querySelectorAll('aside button')].find(b=>b.textContent.includes('Your correct answer'))?.click()")
  await trig(); await sleep(400)
  check("the correct-answer area opens with a text box", await A.ev("!!document.querySelector('aside textarea')"))
  await A.ev("document.querySelector('aside textarea').focus()"); await A.send("Input.insertText", { text: "x = 4" }); await sleep(600)
  await A.ev("[...document.querySelectorAll('aside button')].find(b=>b.textContent.trim()==='Mark').click()")
  let done = false
  for (let i = 0; i < 100 && !done; i++) { await sleep(2000); const t = await A.panel(); done = !/\.\.\.\s*\d+ s/.test(t) && !/Marking\.\.\./.test(t) }
  const result = await A.panel()
  check("the result says it was checked against your answer", result.includes("Checked against your answer"), result.slice(0, 260))
  await sleep(9000)
  check("the note is saved after marking", (await A.ev("document.querySelector('[role=status]').innerText")) === "Saved")
  const pages = await rows()
  const refs = pages[0]?.strokes?.references ?? {}
  check("the typed answer is saved in the account", Object.values(refs).some((r) => r.kind === "text" && r.text === "x = 4"), JSON.stringify(refs).slice(0, 120))
  const mark = Object.values(pages[0]?.strokes?.marks ?? {})[0]
  check("the saved mark remembers which answer it used", !!mark?.refRev, JSON.stringify(Object.keys(mark ?? {})))

  // reload: the typed answer and the mark come back
  await A.reload(); await A.openNote("Test"); await sleep(4500)
  check("after a reload the area is open and the text is still there", (await A.ev("document.querySelector('aside textarea')?.value")) === "x = 4")
  check("after a reload the mark is still there", (await A.panel()).includes("Checked against your answer"))

  // change the reference: the notice
  await A.ev("document.querySelector('aside textarea').focus()"); await A.send("Input.insertText", { text: " or x = 5" }); await sleep(800)
  check("changing the answer shows the notice", (await A.panel()).includes("Your correct answer changed after this was marked"), (await A.panel()).slice(0, 220))

  // paste a picture into the area
  await A.ev(`(async () => {
    const c = document.createElement('canvas'); c.width = 300; c.height = 80
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0,0,300,80); g.fillStyle = '#000'; g.font = '24px sans-serif'; g.fillText('x = 4', 10, 50)
    const blob = await new Promise(r => c.toBlob(r, 'image/png'))
    const dt = new DataTransfer(); dt.items.add(new File([blob], 'ref.png', { type: 'image/png' }))
    document.querySelector('aside textarea').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  })()`)
  await sleep(1500)
  check("a pasted picture becomes the answer", await A.ev("!!document.querySelector('aside img[alt=\"Your correct answer\"]')") && !(await A.ev("!!document.querySelector('aside textarea')")))
  await sleep(9000)
  const pages2 = await rows()
  check("the picture answer is saved in the account", Object.values(pages2[0]?.strokes?.references ?? {}).some((r) => r.kind === "image" && r.base64.length > 100))
  await A.ev("[...document.querySelectorAll('aside button')].find(b=>b.textContent.includes('Remove the picture'))?.click()"); await sleep(1200)
  check("removing the picture brings the text box back, empty", (await A.ev("document.querySelector('aside textarea')?.value")) === "")
  A.close()
} catch (e) { console.log("ERROR", e.message); fail++ } finally {
  await admin(`/users/${user.id}`, { method: "DELETE" })
  console.log("temporary user deleted")
}
console.log(`\n${pass} passed, ${fail} failed`)
