// PDF export test. Needs Chrome and the poppler tools (pdfinfo), and a test server in DEMO mode
// (no AI, no sign-in needed):
//
// 1. cd web && MARK_MODE=demo npx vite --host 127.0.0.1 --port 5176 --strictPort
// 2. google-chrome --headless=new --remote-debugging-port=9350 --user-data-dir=/tmp/p about:blank &
// 3. node e2e/pdf-export.mjs        (from the repo root)
//
// It makes a note, adds a question and pen strokes, marks it with the demo example, exports the
// PDF with and without marks, and checks both are real A4 PDFs. Look at the pictures too:
// pdftoppm -r 70 -png <file>.pdf out (the folder is printed). Not part of the normal tests.
import { execFileSync } from "node:child_process"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { writeFileSync } from "node:fs"
const L = mkdtempSync(join(tmpdir(), "skrrmath-pdf-"))
console.log("PDFs are written to", L)
let pass = 0, fail = 0
const check = (n, ok, x = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : "  " + x}`); ok ? pass++ : fail++ }
const tabs = await (await fetch("http://127.0.0.1:9350/json")).json()
const ws = new WebSocket(tabs.find((t) => t.type === "page").webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0; const pending = new Map()
ws.onmessage = (m) => { const d = JSON.parse(m.data); pending.get(d.id)?.(d) }
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ev = async (e) => (await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true })).result.result.value
const type = async (t) => { await send("Input.insertText", { text: t }); await sleep(100) }
const enter = () => send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 }).then(() => send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter" }))
await send("Emulation.setDeviceMetricsOverride", { width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false })
await send("Page.navigate", { url: "http://127.0.0.1:5176/" }); await sleep(3500)
await ev("localStorage.clear()"); await send("Page.reload"); await sleep(3000)
await ev("window.__blobs = []; const o = URL.createObjectURL.bind(URL); URL.createObjectURL = (b) => { window.__blobs.push(b); return o(b) }")
await ev("document.querySelector('[aria-label=\"Add a course\"]').click()"); await sleep(200); await type("Calculus II"); await enter(); await sleep(500)
await ev("document.querySelector('[aria-label=\"Add a note\"]').click()"); await sleep(200); await type("2023 May"); await enter(); await sleep(2500)
// a question image (the ODE question as text) and some writing below it
await ev(`(async () => {
  const c = document.createElement('canvas'); c.width = 700; c.height = 110
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0,0,700,110); g.fillStyle = '#000'; g.font = '26px sans-serif'; g.fillText('23a) Solve x y^2 dy/dx = y^3 - x^3,', 14, 42); g.fillText('given that y(1) = 2.', 14, 84)
  const blob = await new Promise(r => c.toBlob(r, 'image/png'))
  const dt = new DataTransfer(); dt.items.add(new File([blob], 'q.png', { type: 'image/png' }))
  const t = document.querySelector('canvas.interactive') || document.querySelector('.excalidraw canvas')
  const r = t.getBoundingClientRect(); const o = { dataTransfer: dt, bubbles: true, cancelable: true, clientX: r.left + 150, clientY: r.top + 130 }
  t.dispatchEvent(new DragEvent('dragenter', o)); t.dispatchEvent(new DragEvent('dragover', o)); t.dispatchEvent(new DragEvent('drop', o))
})()`)
await sleep(2000)
const box = await ev("(()=>{const r=(document.querySelector('canvas.interactive')||document.querySelector('.excalidraw canvas')).getBoundingClientRect(); return {x:r.left,y:r.top}})()")
await ev("document.querySelector('[data-testid=\"toolbar-freedraw\"]')?.click()"); await sleep(400)
for (let l = 0; l < 3; l++) {
  const y = box.y + 330 + l * 55
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x + 460, y })
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: box.x + 460, y, button: "left", clickCount: 1 })
  for (let x = 0; x <= 260; x += 12) await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x + 460 + x, y: y + Math.sin(x / 14) * 12, button: "left", buttons: 1 })
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: box.x + 720, y, button: "left" })
}
await sleep(1000)
await sleep(1500)
const savedEls = JSON.stringify(await ev(`new Promise(r => { const q = indexedDB.open('skrrmath', 1); q.onsuccess = () => { const g = q.result.transaction('scenes').objectStore('scenes').getAll(); g.onsuccess = () => r(g.result.map(s => s.elements.map(e => e.type))) } })`))
check("the question image and the pen strokes are in the note", savedEls.includes("image") && savedEls.includes("freedraw"), savedEls)
const exportBtn = () => ev("(()=>{const b=document.querySelector('[aria-label=\"Export as PDF\"]'); return b ? {disabled: b.disabled} : null})()")
check("the Export button is on once there is a question", (await exportBtn())?.disabled === false)
await ev("[...document.querySelectorAll('aside button')].find(b=>b.textContent.trim()==='Mark').click()"); await sleep(2500)
check("the demo marks show in the panel", (await ev("document.querySelector('aside:last-of-type').innerText")).includes("Mistake on line 12"))
async function exportAs(label, file) {
  const before = await ev("window.__blobs.length")
  await ev("document.querySelector('[aria-label=\"Export as PDF\"]').click()"); await sleep(500)
  await ev(`[...document.querySelectorAll('[role=menuitem]')].find(e=>e.textContent.trim().startsWith(${JSON.stringify(label)}))?.click()`)
  for (let i = 0; i < 40 && (await ev("window.__blobs.length")) === before; i++) await sleep(500)
  const b64 = await ev(`new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(window.__blobs.at(-1)) })`)
  writeFileSync(`${L}/${file}`, Buffer.from(b64, "base64"))
  const info = execFileSync("pdfinfo", [`${L}/${file}`]).toString()
  check(`${label}: a real A4 PDF with at least one page`, /Pages:\s+[1-9]/.test(info) && info.includes("A4"), info.slice(0, 200))
  check(`${label}: has the note title`, info.includes("Calculus II - 2023 May"))
}
await exportAs("Marked PDF", "marked.pdf")
await exportAs("Clean PDF", "clean.pdf")
ws.close()
console.log(`\n${pass} passed, ${fail} failed`)
