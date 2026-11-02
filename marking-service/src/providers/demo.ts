import { readFileSync } from "node:fs"
import { join } from "node:path"
import { parseMarkingResult } from "../../../shared/src/index.ts"
import type { Engine } from "../types.ts"

// Never calls an AI. Returns a saved example from fixtures/marking.
// The same example comes back for every request. That is the point of a demo.
export function createDemoEngine(
  fixturesDir = join(import.meta.dirname, "../../../fixtures/marking"),
  name = "sign-error-verified-user.json"
): Engine {
  const parsed = parseMarkingResult(JSON.parse(readFileSync(join(fixturesDir, name), "utf8")))
  if (!parsed.ok) throw new Error(`demo fixture ${name} is invalid: ${parsed.errors.join("; ")}`)
  const result = parsed.result
  return { mark: async () => structuredClone(result) }
}
