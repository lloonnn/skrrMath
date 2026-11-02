// Cloud save test: two browsers stand in for a laptop and a tablet, with one
// temporary account (made and deleted by this script). Not part of the normal tests,
// because it needs the network, the Supabase keys, Chrome and the dev server.
//
// 1. cd web && npm run dev                      (the app on http://localhost:5173)
// 2. google-chrome --headless=new --remote-debugging-port=9345 --user-data-dir=/tmp/a about:blank &
//    google-chrome --headless=new --remote-debugging-port=9346 --user-data-dir=/tmp/b about:blank &
// 3. node e2e/cloud-save.mjs                    (run from the repo root, with .env present)
//
// It never prints keys.
import { readFileSync } from "node:fs"
import { randomUUID } from "node:crypto"
const env = Object.fromEntries(readFileSync("/home/sl/Desktop/vscfile/skrrMath/.env", "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]))
const admin = (p, init = {}) => fetch(`${env.SUPABASE_URL}/auth/v1/admin${p}`, { ...init, headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "content-type": "application/json" } })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  " + extra}`); ok ? pass++ : fail++ }

async function open(port, w = 1500) {
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
  const ws = new WebSocket(tabs.find((t) => t.type === "page").webSocketDebuggerUrl)
  await new Promise((r) => (ws.onopen = r))
  let id = 0; const pending = new Map()
  ws.onmessage = (m) => { const d = JSON.parse(m.data); pending.get(d.id)?.(d) }
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
  const ev = async (e) => (await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true })).result.result.value
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: 1000, deviceScaleFactor: 1, mobile: false })
  const type = async (t) => { await send("Input.insertText", { text: t }); await sleep(100) }
  const enter = () => send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 }).then(() => send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter" }))
  const goto = async (url) => { await send("Page.navigate", { url }); await sleep(3500) }
  const list = () => ev("document.querySelector('[data-slot=\"sidebar-content\"]')?.innerText.replace(/\\n+/g,' | ')")
  const footer = () => ev("document.querySelector('[data-slot=\"sidebar-footer\"]')?.innerText.replace(/\\n+/g,' | ')")
  const click = (sel) => ev(`document.querySelector(${JSON.stringify(sel)})?.click()`)
  const clickText = (scope, t) => ev(`[...document.querySelectorAll(${JSON.stringify(scope + " button")})].find(b=>b.textContent.trim()===${JSON.stringify(t)})?.click()`)
  const fill = async (i, text) => { await ev(`document.querySelectorAll('[data-slot="sidebar-footer"] input')[${i}].focus()`); await send("Input.insertText", { text }) }
  const dropImage = (y) => ev(`(async () => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 100
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0,0,400,100); g.fillStyle = '#000'; g.font = '20px sans-serif'; g.fillText('Cloud question', 10, 50)
    const blob = await new Promise(r => c.toBlob(r, 'image/png'))
    const dt = new DataTransfer(); dt.items.add(new File([blob], 'q.png', { type: 'image/png' }))
    const t = document.querySelector('canvas.interactive') || document.querySelector('.excalidraw canvas')
    const r = t.getBoundingClientRect(); const o = { dataTransfer: dt, bubbles: true, cancelable: true, clientX: r.left + 200, clientY: r.top + ${y} }
    t.dispatchEvent(new DragEvent('dragenter', o)); t.dispatchEvent(new DragEvent('dragover', o)); t.dispatchEvent(new DragEvent('drop', o))
  })()`)
  const signIn = async (email, password) => {
    await clickText('[data-slot="sidebar-footer"]', "Sign in"); await sleep(300)
    await fill(0, email); await fill(1, password)
    await clickText('[data-slot="sidebar-footer"]', "Sign in"); await sleep(4000)
  }
  const addCourse = async (name) => { await click('[aria-label="Add a course"]'); await sleep(200); await type(name); await enter(); await sleep(400) }
  const addNote = async (name) => { await click('[aria-label="Add a note"]'); await sleep(200); await type(name); await enter(); await sleep(900) }
  return { send, ev, type, enter, goto, list, footer, click, clickText, signIn, addCourse, addNote, dropImage, close: () => ws.close() }
}

const email = `cloud-${randomUUID().slice(0, 8)}@example.com`, password = randomUUID()
const user = await (await admin("/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true }) })).json()
const rows = async (table, q = "") => (await (await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?owner=eq.${user.id}${q}`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } })).json())
try {
  // ---- laptop: guest first, then sign in
  const A = await open(9345)
  await A.goto("http://localhost:5173/")
  await A.ev("localStorage.clear()"); await A.send("Page.reload"); await sleep(3000)
  await A.addCourse("Local Course"); await A.click('[aria-label="Add a note"]'); await sleep(200); await A.type("Old Note"); await A.enter(); await sleep(800)
  check("guest list is in the browser", (await A.list()).includes("Old Note"))
  await A.dropImage(150); await sleep(3000)
  check("guest writing says it is saved in this browser", (await A.ev("document.querySelector('[role=status]').innerText")) === "Saved in this browser", await A.ev("document.querySelector('[role=status]').innerText"))
  await A.send("Page.reload"); await sleep(3500)
  await A.ev(`[...document.querySelectorAll('[data-slot="sidebar-content"] button')].find(b=>b.textContent.trim()==='Old Note')?.click()`); await sleep(2500)
  check("guest writing survives a reload", (await A.ev("document.querySelector('aside:last-of-type').innerText")).includes("Question 1"))
  check("nothing in the account yet", (await rows("courses")).length === 0)
  await A.signIn(email, password)
  check("after sign-in the guest course is still shown", (await A.list()).includes("Local Course") && (await A.list()).includes("Old Note"), await A.list())
  const c1 = await rows("courses"), y1 = await rows("years")
  check("guest course was uploaded to the account", c1.length === 1 && c1[0].name === "Local Course", JSON.stringify(c1))
  check("guest note was uploaded to the account", y1.length === 1 && y1[0].label === "Old Note")
  check("browser copy was cleared", (await A.ev("localStorage.getItem('skrrmath-papers')")) === "[]")
  const guestPages = await rows("pages")
  check("the guest's writing was uploaded to the account", guestPages.length === 1 && guestPages[0].strokes?.elements?.some((e) => e.type === "image"), JSON.stringify(guestPages).slice(0, 100))
  check("the guest's writing is gone from this browser", (await A.ev(`new Promise(r => { const q = indexedDB.open('skrrmath', 1); q.onsuccess = () => { const t = q.result.transaction('scenes').objectStore('scenes').count(); t.onsuccess = () => r(t.result) } })`)) === 0)
  await A.click('[aria-label="Close marking panel"]'); await sleep(200); await A.click('[aria-label="Open marking panel"]')

  // ---- laptop: new course and note, with a question image
  await A.addCourse("Calculus"); 
  await A.ev(`[...document.querySelectorAll('[aria-label="Add a note"]')].pop().click()`); await sleep(200); await A.type("2023"); await A.enter(); await sleep(2500)
  check("new note opened with a canvas", await A.ev("!!document.querySelector('.excalidraw')"))
  await A.dropImage(150); await sleep(1500)
  check("question shows in the panel", (await A.ev("document.querySelector('aside:last-of-type').innerText")).includes("Question 1"))
  check("header says unsaved or saving right after", /Unsaved|Saving|Saved/.test(await A.ev("document.querySelector('[role=status]').innerText")))
  await sleep(9000)
  check("header says Saved", (await A.ev("document.querySelector('[role=status]').innerText")) === "Saved", await A.ev("document.querySelector('[role=status]').innerText"))
  const pages = await rows("pages")
  check("the writing is in the account", pages.length === 2 && Array.isArray(pages[0].strokes?.elements) && pages.every((p) => p.strokes.elements.some((e) => e.type === "image")), JSON.stringify(pages).slice(0, 120))

  // ---- tablet: a second browser, same account
  const B = await open(9346, 1180)
  await B.goto("http://localhost:5173/")
  await B.ev("localStorage.clear()"); await B.send("Page.reload"); await sleep(3000)
  check("second device starts as a guest with an empty list", (await B.list()).includes("No courses yet"))
  await B.addCourse("local course"); await B.click('[aria-label="Add a note"]'); await sleep(200); await B.type("old note"); await B.enter(); await sleep(800)
  await B.dropImage(150); await sleep(3000)
  await B.signIn(email, password)
  await sleep(3500) // the upload of the guest writing takes a moment
  const l = await B.list()
  check("second device shows all the notes", l.includes("Local Course") && l.includes("Old Note") && l.includes("Calculus") && l.includes("2023"), l)
  check("the same-named guest note was not duplicated as a course", (await rows("courses")).filter((c) => c.name.toLowerCase() === "local course").length === 1)
  check("the guest's writing was kept as a new note because the account's note had writing", l.includes("(from this browser)"), l)
  check("both writings are in the account", (await rows("pages")).length === 3, String((await rows("pages")).length))
  check("the header tells the person what happened", (await B.ev("document.querySelector('[role=status]').innerText")).includes("kept as a new note"), await B.ev("document.querySelector('[role=status]').innerText"))
  await B.ev(`[...document.querySelectorAll('[data-slot="sidebar-content"] button')].find(b=>b.textContent.trim()==='2023')?.click()`); await sleep(4000)
  check("second device opens the note with the question image", (await B.ev("document.querySelector('aside:last-of-type').innerText")).includes("Question 1"), await B.ev("document.querySelector('aside:last-of-type').innerText.slice(0,100)"))

  // ---- rename and delete reach the account
  await B.ev(`document.querySelector('[aria-label="Options for Old Note"]').click()`); await sleep(500)
  await B.ev(`[...document.querySelectorAll('[role=menuitem]')].find(e=>e.textContent.trim()==='Rename').click()`); await sleep(300)
  await B.ev(`document.querySelector('[data-slot="sidebar-content"] input').select()`); await B.type("Renamed note"); await B.enter(); await sleep(1500)
  check("rename is saved in the account", (await rows("years")).some((y) => y.label === "Renamed note"))
  B.ev("window.confirm = () => true")
  await B.ev(`document.querySelector('[aria-label="Options for Renamed note"]').click()`); await sleep(500)
  await B.ev(`[...document.querySelectorAll('[role=menuitem]')].find(e=>e.textContent.trim()==='Delete').click()`); await sleep(1500)
  check("delete is saved in the account", !(await rows("years")).some((y) => y.label === "Renamed note"))

  // ---- laptop picks up the change when it comes back to the tab
  await A.ev("document.dispatchEvent(new Event('visibilitychange'))"); await sleep(2500)
  check("the laptop sees the rename and delete after refocusing", !(await A.list()).includes("Renamed") && !/Old Note(?! \(from)/.test(await A.list()) && (await A.list()).includes("(from this browser)"), await A.list())

  // ---- sign out
  await A.clickText('[data-slot="sidebar-footer"]', "Sign out"); await sleep(1500)
  check("after sign-out the browser list is empty (it lives in the account)", (await A.list()).includes("No courses yet"), await A.list())
  A.close(); B.close()
} catch (e) {
  console.log("ERROR", e.message); fail++
} finally {
  await admin(`/users/${user.id}`, { method: "DELETE" })
  console.log("temporary user deleted (its rows go with it)")
}
console.log(`\n${pass} passed, ${fail} failed`)
