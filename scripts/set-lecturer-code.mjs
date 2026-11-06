// Stores the lecturer code from .env in the database, as a salted hash. Run it once, and again
// whenever you change LECTURER_CODE. People who give this code become lecturers.
//   node --env-file=.env scripts/set-lecturer-code.mjs
// It never prints the code.
const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: service, LECTURER_CODE: code } = process.env
if (!url || !service) {
  console.error("Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env")
  process.exit(1)
}
if (!code || code.length < 6) {
  console.error("Put LECTURER_CODE in .env first: any simple code, at least 6 characters.")
  process.exit(1)
}
const res = await fetch(`${url}/rest/v1/rpc/set_lecturer_code`, {
  method: "POST",
  headers: { apikey: service, authorization: `Bearer ${service}`, "content-type": "application/json" },
  body: JSON.stringify({ code }),
})
if (!res.ok) {
  console.error("Could not store the code:", res.status, (await res.text()).slice(0, 200))
  process.exit(1)
}
console.log("The lecturer code is stored (as a hash). Anyone who gives it becomes a lecturer.")
