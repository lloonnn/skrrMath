// Access test with two accounts. Needs the network and the Supabase keys, so it is
// not part of the normal tests. Run it by hand:
//   node --env-file=.env scripts/rls-test.mjs
// It makes two temporary users in the project, tries to read and change each
// other's rows, then deletes both users (their rows go with them).
// It never prints keys.
import { randomUUID } from "node:crypto"

const { SUPABASE_URL: url, SUPABASE_ANON_KEY: anon, SUPABASE_SERVICE_ROLE_KEY: service } = process.env
if (!url || !anon || !service) {
  console.error("Needs SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in .env")
  process.exit(1)
}

const admin = (path, init = {}) =>
  fetch(`${url}/auth/v1/admin${path}`, {
    ...init,
    headers: { apikey: service, authorization: `Bearer ${service}`, "content-type": "application/json", ...init.headers },
  })

async function makeUser(tag) {
  const email = `rls-${tag}-${randomUUID().slice(0, 8)}@example.com`
  const password = randomUUID()
  const r = await admin("/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true }) })
  if (!r.ok) throw new Error(`could not create user ${tag}: ${r.status}`)
  const user = await r.json()
  const t = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anon, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  if (!t.ok) throw new Error(`could not sign in ${tag}: ${t.status}`)
  return { id: user.id, token: (await t.json()).access_token }
}

// A request as one user (or as nobody, with no token). Returns status and rows.
async function as(who, method, path, body) {
  const r = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: anon,
      ...(who ? { authorization: `Bearer ${who.token}` } : {}),
      "content-type": "application/json",
      prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  let rows = null
  try { rows = await r.json() } catch { /* empty body */ }
  return { status: r.status, rows }
}

let failed = 0
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  " + detail}`)
  if (!ok) failed++
}
const none = (r) => Array.isArray(r.rows) && r.rows.length === 0
const refused = (r) => r.status >= 400 // RLS violation (403) or similar

const users = []
try {
  const A = await makeUser("a"); users.push(A)
  const B = await makeUser("b"); users.push(B)

  const course = randomUUID(), year = randomUUID(), page = randomUUID()
  check("A adds a course", (await as(A, "POST", "courses", { id: course, name: "Calculus II" })).status === 201)
  check("A adds a year", (await as(A, "POST", "years", { id: year, course_id: course, label: "2023/24" })).status === 201)
  check("A adds a page (the note of that year)", (await as(A, "POST", "pages", { id: page, year_id: year, strokes: { a: 1 } })).status === 201)
  check("A reads their own course", (await as(A, "GET", `courses?id=eq.${course}`)).rows?.length === 1)

  for (const t of ["courses", "years", "pages"])
    check(`B cannot read A's ${t}`, none(await as(B, "GET", t)))
  check("nobody (signed out) cannot read courses", refused(await as(null, "GET", "courses")) || none(await as(null, "GET", "courses")))
  check("nobody (signed out) cannot add a course", refused(await as(null, "POST", "courses", { id: randomUUID(), name: "x" })))

  const upd = await as(B, "PATCH", `courses?id=eq.${course}`, { name: "hacked" })
  check("B cannot rename A's course", none(upd) || refused(upd))
  const del = await as(B, "DELETE", `courses?id=eq.${course}`)
  check("B cannot delete A's course", none(del) || refused(del))
  check("A's course is unchanged", (await as(A, "GET", `courses?id=eq.${course}`)).rows?.[0]?.name === "Calculus II")

  check("B cannot add a year under A's course", refused(await as(B, "POST", "years", { id: randomUUID(), course_id: course, label: "2099" })))
  check("B cannot add a page under A's year", refused(await as(B, "POST", "pages", { id: randomUUID(), year_id: year })))
  check("the papers table is gone", refused(await as(A, "GET", "papers")))
  check("B cannot add a course as A", refused(await as(B, "POST", "courses", { id: randomUUID(), name: "x", owner: A.id })))

  const mine = randomUUID()
  check("B can add their own course", (await as(B, "POST", "courses", { id: mine, name: "Mine" })).status === 201)
  check("B cannot hand their own course to A", refused(await as(B, "PATCH", `courses?id=eq.${mine}`, { owner: A.id })))
  check("A cannot see B's course", none(await as(A, "GET", `courses?id=eq.${mine}`)))
  check("A can rename their own course", (await as(A, "PATCH", `courses?id=eq.${course}`, { name: "Renamed" })).rows?.[0]?.name === "Renamed")
  check("deleting a course removes its years and pages", await (async () => {
    await as(A, "DELETE", `courses?id=eq.${course}`)
    const [y, g] = await Promise.all(["years", "pages"].map((t) => as(A, "GET", t)))
    return none(y) && none(g)
  })())
} catch (e) {
  console.log("ERROR", e.message)
  failed++
} finally {
  for (const u of users) await admin(`/users/${u.id}`, { method: "DELETE" })
  console.log(`Removed ${users.length} temporary users.`)
}
console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) FAILED.`)
process.exit(failed === 0 ? 0 : 1)
