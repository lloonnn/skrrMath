// Access test for the lecturer solutions (phase 2 of docs/LECTURER-PLAN.md). Needs the network and
// the Supabase keys, so it is not part of the normal tests:
//   node --env-file=.env scripts/bank-rls-test.mjs
// It makes temporary accounts (two students, two lecturers) and deletes them at the end.
// The part that tests the lecturer code only runs when LECTURER_CODE is in .env AND it has been
// stored with scripts/set-lecturer-code.mjs. It never prints keys or the code.
import { randomUUID } from "node:crypto"

const { SUPABASE_URL: url, SUPABASE_ANON_KEY: anon, SUPABASE_SERVICE_ROLE_KEY: service, LECTURER_CODE: lecturerCode } = process.env
if (!url || !anon || !service) {
  console.error("Needs SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in .env")
  process.exit(1)
}

const admin = (path, init = {}) =>
  fetch(`${url}/auth/v1/admin${path}`, { ...init, headers: { apikey: service, authorization: `Bearer ${service}`, "content-type": "application/json", ...init.headers } })

async function makeUser(tag) {
  const email = `bank-${tag}-${randomUUID().slice(0, 8)}@example.com`
  const password = randomUUID()
  const r = await admin("/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true }) })
  if (!r.ok) throw new Error(`could not create ${tag}: ${r.status}`)
  const user = await r.json()
  const t = await fetch(`${url}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: anon, "content-type": "application/json" }, body: JSON.stringify({ email, password }) })
  if (!t.ok) throw new Error(`could not sign in ${tag}: ${t.status}`)
  return { id: user.id, token: (await t.json()).access_token }
}

// A request as one person, nobody (no token), or the service role (who can do anything).
async function as(who, method, path, body, extra = {}) {
  const headers = { apikey: who === "service" ? service : anon, "content-type": "application/json", prefer: "return=representation", ...extra }
  const token = who === "service" ? service : who?.token
  if (token) headers.authorization = `Bearer ${token}`
  const r = await fetch(`${url}/rest/v1/${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  let json = null
  try { json = await r.json() } catch { /* empty body */ }
  return { status: r.status, json, rows: Array.isArray(json) ? json : null }
}
const rpc = (who, name, args) => as(who, "POST", `rpc/${name}`, args)

let failed = 0
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  " + detail}`)
  if (!ok) failed++
}
const refused = (r) => r.status >= 400
const empty = (r) => Array.isArray(r.rows) && r.rows.length === 0
const key = (n) => ({ course_code: "TEST" + (1000 + n), exam: "2099 may", question: "1a" + n })
const text = (t = "x = 4") => ({ answer_text: t })

const users = []
try {
  const S1 = await makeUser("s1"); users.push(S1)
  const S2 = await makeUser("s2"); users.push(S2)
  const L1 = await makeUser("l1"); users.push(L1)
  const L2 = await makeUser("l2"); users.push(L2)
  // The two lecturers are made by the service role, without the code, so this part does not depend on it.
  for (const L of [L1, L2]) await as("service", "POST", "profiles", { id: L.id, role: "lecturer" })

  console.log("-- roles")
  check("a student cannot make themselves a lecturer (insert)", refused(await as(S1, "POST", "profiles", { id: S1.id, role: "lecturer" })))
  check("a student cannot change a role (update)", empty(await as(S1, "PATCH", `profiles?id=eq.${S1.id}`, { role: "lecturer" })) || refused(await as(S1, "PATCH", `profiles?id=eq.${S1.id}`, { role: "lecturer" })))
  check("a lecturer cannot change their own role away and back (update)", refused(await as(L1, "PATCH", `profiles?id=eq.${L1.id}`, { role: "student" })) || empty(await as(L1, "PATCH", `profiles?id=eq.${L1.id}`, { role: "student" })))
  check("a lecturer can read their own profile", (await as(L1, "GET", `profiles?id=eq.${L1.id}`)).rows?.[0]?.role === "lecturer")
  check("a student cannot read a lecturer's profile", empty(await as(S1, "GET", `profiles?id=eq.${L1.id}`)))
  check("a signed-out visitor cannot read profiles", refused(await as(null, "GET", "profiles")) || empty(await as(null, "GET", "profiles")))
  check("is_lecturer is true for a lecturer", (await rpc(L1, "is_lecturer", {})).json === true)
  check("is_lecturer is false for a student", (await rpc(S1, "is_lecturer", {})).json === false)
  check("nobody can read the stored code hash (signed in)", refused(await as(S1, "GET", "app_secrets")) || empty(await as(S1, "GET", "app_secrets")))
  check("nobody can read the stored code hash (signed out)", refused(await as(null, "GET", "app_secrets")) || empty(await as(null, "GET", "app_secrets")))
  check("nobody can read the claim attempts", refused(await as(S1, "GET", "lecturer_claim_attempts")) || empty(await as(S1, "GET", "lecturer_claim_attempts")))
  check("a student cannot call set_lecturer_code", refused(await rpc(S1, "set_lecturer_code", { code: "a-new-long-code-123" })))
  check("a signed-out visitor cannot call claim_lecturer", refused(await rpc(null, "claim_lecturer", { code: "x" })))

  console.log("-- adding and reading solutions")
  check("a student cannot add a solution", refused(await as(S1, "POST", "bank_solutions", { ...key(1), ...text() })))
  check("a signed-out visitor cannot add a solution", refused(await as(null, "POST", "bank_solutions", { ...key(1), ...text() })))
  const add = await as(L1, "POST", "bank_solutions", { ...key(1), ...text("x = 4") })
  check("a lecturer can add a solution", add.status === 201, JSON.stringify(add.json).slice(0, 150))
  const sol = add.rows?.[0]
  check("it starts at version 1 and is stamped with the lecturer", sol?.version === 1 && sol?.lecturer === L1.id)
  check("student 1 can read it", (await as(S1, "GET", `bank_solutions?id=eq.${sol?.id}`)).rows?.length === 1)
  check("student 2 can read it", (await as(S2, "GET", `bank_solutions?course_code=eq.${key(1).course_code}`)).rows?.length === 1)
  check("another lecturer can read it", (await as(L2, "GET", `bank_solutions?id=eq.${sol?.id}`)).rows?.length === 1)
  check("a signed-out visitor cannot read it", refused(await as(null, "GET", "bank_solutions")) || empty(await as(null, "GET", "bank_solutions")))

  console.log("-- who can change it")
  check("a student cannot change it", empty(await as(S1, "PATCH", `bank_solutions?id=eq.${sol?.id}`, text("hacked"))) || refused(await as(S1, "PATCH", `bank_solutions?id=eq.${sol?.id}`, text("hacked"))))
  check("a student cannot delete it", empty(await as(S1, "DELETE", `bank_solutions?id=eq.${sol?.id}`)) || refused(await as(S1, "DELETE", `bank_solutions?id=eq.${sol?.id}`)))
  check("another lecturer cannot change it", empty(await as(L2, "PATCH", `bank_solutions?id=eq.${sol?.id}`, text("hacked"))) || refused(await as(L2, "PATCH", `bank_solutions?id=eq.${sol?.id}`, text("hacked"))))
  check("even its own lecturer cannot delete it", empty(await as(L1, "DELETE", `bank_solutions?id=eq.${sol?.id}`)) || refused(await as(L1, "DELETE", `bank_solutions?id=eq.${sol?.id}`)))
  check("it is unchanged after all that", (await as(S1, "GET", `bank_solutions?id=eq.${sol?.id}`)).rows?.[0]?.answer_text === "x = 4")
  check("a lecturer cannot add a solution as another lecturer", refused(await as(L1, "POST", "bank_solutions", { ...key(2), ...text(), lecturer: L2.id })))
  check("a second live solution for the same key is refused", refused(await as(L2, "POST", "bank_solutions", { ...key(1), ...text("y = 5") })))
  check("a different key is fine for another lecturer", (await as(L2, "POST", "bank_solutions", { ...key(3), ...text("z = 6") })).status === 201)

  console.log("-- the author changes it")
  const upd = await as(L1, "PATCH", `bank_solutions?id=eq.${sol?.id}`, text("x = 4 (checked)"))
  check("the author can change it", upd.rows?.[0]?.answer_text === "x = 4 (checked)", JSON.stringify(upd.json).slice(0, 150))
  check("the version went up by one", upd.rows?.[0]?.version === 2)
  check("the key cannot be changed", refused(await as(L1, "PATCH", `bank_solutions?id=eq.${sol?.id}`, { question: "9z" })))
  check("the author cannot be changed", refused(await as(L1, "PATCH", `bank_solutions?id=eq.${sol?.id}`, { lecturer: L2.id })))

  console.log("-- the shape of a solution")
  check("a course code that is not cleaned is refused", refused(await as(L1, "POST", "bank_solutions", { ...key(4), course_code: "uecm2323", ...text() })))
  check("an exam that is not cleaned is refused", refused(await as(L1, "POST", "bank_solutions", { ...key(4), exam: "May 2099", ...text() })))
  check("a question with a space is refused", refused(await as(L1, "POST", "bank_solutions", { ...key(4), question: "23 a", ...text() })))
  check("a solution with no text and no picture is refused", refused(await as(L1, "POST", "bank_solutions", { ...key(4) })))
  check("a solution with both text and a picture is refused", refused(await as(L1, "POST", "bank_solutions", { ...key(4), ...text(), answer_image: "AAAA", answer_image_type: "image/png" })))
  check("a picture without its type is refused", refused(await as(L1, "POST", "bank_solutions", { ...key(4), answer_image: "AAAA" })))
  check("a picture solution is accepted", (await as(L1, "POST", "bank_solutions", { ...key(5), answer_image: "AAAA", answer_image_type: "image/png" })).status === 201)
  check("a very long text is refused", refused(await as(L1, "POST", "bank_solutions", { ...key(4), answer_text: "x".repeat(5001) })))

  console.log("-- withdrawing")
  const wd = await as(L1, "PATCH", `bank_solutions?id=eq.${sol?.id}`, { withdrawn: true })
  check("the author can withdraw it", wd.rows?.[0]?.withdrawn === true && wd.rows?.[0]?.version === 3, JSON.stringify(wd.json).slice(0, 150))
  check("students no longer see it", empty(await as(S1, "GET", `bank_solutions?id=eq.${sol?.id}`)))
  check("another lecturer no longer sees it", empty(await as(L2, "GET", `bank_solutions?id=eq.${sol?.id}`)))
  check("the author still sees their withdrawn one", (await as(L1, "GET", `bank_solutions?id=eq.${sol?.id}`)).rows?.length === 1)
  check("another lecturer can now add a live one for that key", (await as(L2, "POST", "bank_solutions", { ...key(1), ...text("x = 4, by the second lecturer") })).status === 201)
  check("a lecturer cannot add a solution that is already withdrawn", refused(await as(L1, "POST", "bank_solutions", { ...key(6), ...text(), withdrawn: true })))

  console.log("-- a lecturer who loses the role")
  await as("service", "PATCH", `profiles?id=eq.${L2.id}`, { role: "student" })
  check("a person who is no longer a lecturer cannot change their solution", empty(await as(L2, "PATCH", `bank_solutions?lecturer=eq.${L2.id}`, text("late edit"))) || refused(await as(L2, "PATCH", `bank_solutions?lecturer=eq.${L2.id}`, text("late edit"))))
  check("and cannot add a new one", refused(await as(L2, "POST", "bank_solutions", { ...key(7), ...text() })))

  console.log("-- the lecturer code")
  // Which code to test with. If a real code is stored and LECTURER_CODE is in .env, that one.
  // If NO code is stored at all, a throwaway random code is stored for the test and removed after,
  // so nothing is left behind. If a code is stored but LECTURER_CODE is not in .env, this part is skipped.
  const probe = await rpc(S1, "claim_lecturer", { code: "definitely-not-the-code" })
  let code = lecturerCode
  let temporary = false
  if (probe.json === "not_set" && !lecturerCode) {
    code = "test-code-" + randomUUID()
    temporary = true
    const set = await rpc("service", "set_lecturer_code", { code })
    if (set.status >= 400) throw new Error("could not store the throwaway code: " + set.status)
  } else if (probe.json === "not_set") {
    console.log("SKIP  the code in .env has not been stored yet. Run: node --env-file=.env scripts/set-lecturer-code.mjs")
    code = null
  } else if (!lecturerCode) {
    console.log("SKIP  a code is stored but LECTURER_CODE is not in .env, so claiming is not tested")
    code = null
  }
  if (code) {
    try {
      const wrong = await rpc(S1, "claim_lecturer", { code: "definitely-not-the-code" })
      check("a wrong code is refused", wrong.json === "wrong_code", JSON.stringify(wrong.json))
      check("a wrong code does not make a lecturer", (await rpc(S1, "is_lecturer", {})).json === false)
      // Keep giving wrong codes until it locks. Five wrong tries in an hour lock it, and the
      // first try above (before the code was stored) may or may not have been counted.
      let wrongTries = 1
      let last = "wrong_code"
      for (let i = 0; i < 10 && last === "wrong_code"; i++) {
        last = (await rpc(S1, "claim_lecturer", { code: "wrong-" + i })).json
        if (last === "wrong_code") wrongTries++
      }
      check("it locks the person after about five wrong tries", last === "locked" && wrongTries >= 4 && wrongTries <= 5, `result ${last} after ${wrongTries} wrong tries`)
      check("even the right code is refused while locked", (await rpc(S1, "claim_lecturer", { code })).json === "locked")
      check("a different person with the right code becomes a lecturer", (await rpc(S2, "claim_lecturer", { code })).json === "lecturer")
      check("and is_lecturer is then true for them", (await rpc(S2, "is_lecturer", {})).json === true)
      check("and they can then add a solution", (await as(S2, "POST", "bank_solutions", { ...key(8), ...text() })).status === 201)
      check("being locked did not stop an existing lecturer's rights", (await as(L1, "POST", "bank_solutions", { ...key(9), ...text() })).status === 201)
      check("a code under 6 characters cannot be stored", (await rpc("service", "set_lecturer_code", { code: "short" })).status >= 400)
      // The limit across all people: 30 wrong tries in an hour lock everyone, even a person with no tries.
      const rowsToAdd = Array.from({ length: 30 }, () => ({ user_id: S1.id, ok: false }))
      await as("service", "POST", "lecturer_claim_attempts", rowsToAdd)
      check("after 30 wrong tries by anyone, a new person is locked too", (await rpc(L2, "claim_lecturer", { code })).json === "locked")
        } finally {
      if (temporary) {
        const del = await as("service", "DELETE", "app_secrets?name=eq.lecturer_code_hash")
        console.log(temporary ? `      (the throwaway code was removed again: ${del.status < 300 ? "yes" : "NO, remove the row 'lecturer_code_hash' from app_secrets"})` : "")
      }
    }
  }
} catch (e) {
  console.log("ERROR", e.message)
  failed++
} finally {
  for (const u of users) await admin(`/users/${u.id}`, { method: "DELETE" })
  console.log(`Removed ${users.length} temporary users (their solutions and records go with them).`)
}
console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) FAILED.`)
process.exit(failed === 0 ? 0 : 1)
