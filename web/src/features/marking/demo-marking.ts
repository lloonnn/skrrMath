import fixture from "@fixtures/marking/ode-page2-demo.json"
import pageImage from "@fixtures/images/ode-page2-answer.jpeg"
import { parseMarkingResult, type MarkingResult } from "@shared/index.ts"

// The page image the demo marks. The owner's own handwritten work.
export const demoPageImage: string = pageImage

// Real marking costs money, so it will need a signed-in user (guest mode rule).
// The demo costs nothing and calls no AI, so a guest can use it. Set this to true
// when Mark is connected to the marking service.
export const MARK_NEEDS_SIGN_IN = false

// Demo mode: returns a saved example after a short pause. No AI, no network.
// Later this calls marking-service. The result is validated the same way.
export async function markDemo(): Promise<MarkingResult> {
  await new Promise((r) => setTimeout(r, 600))
  const parsed = parseMarkingResult(fixture)
  if (!parsed.ok) throw new Error("demo fixture is invalid")
  return parsed.result
}
