import fixture from "@fixtures/marking/ode-page2-demo.json"
import pageImage from "@fixtures/images/ode-page2-answer.jpeg"
import { parseMarkingResult, type MarkingResult } from "@shared/index.ts"

// The page image the demo marks. The owner's own handwritten work.
export const demoPageImage: string = pageImage

// Demo mode: returns a saved example after a short pause. No AI, no network.
// Later this calls marking-service. The result is validated the same way.
export async function markDemo(): Promise<MarkingResult> {
  await new Promise((r) => setTimeout(r, 600))
  const parsed = parseMarkingResult(fixture)
  if (!parsed.ok) throw new Error("demo fixture is invalid")
  return parsed.result
}
