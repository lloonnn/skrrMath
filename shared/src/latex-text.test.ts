import { describe, expect, it } from "vitest"
import { latexToText } from "./latex-text.ts"

describe("latexToText", () => {
  it.each([
    ["y^3 = 8x^3 - 3x^3 \\ln|x|", "y³ = 8x³ - 3x³ ln|x|"],
    ["y^{3} = 8 x^{3} - 3 x^{3} \\ln|x|", "y³ = 8 x³ - 3 x³ ln|x|"],
    ["\\frac{u^3}{3} = -\\ln|x| + C_1", "u³/3 = -ln|x| + C₁"],
    ["\\left(\\frac{y}{x}\\right)^3 = 3\\ln|x| + C", "(y/x)³ = 3ln|x| + C"],
    ["x = \\frac{5 \\pm \\sqrt{25 - 24}}{2}", "x = (5 ± √(25 - 24))/2"],
    ["y = \\sqrt[3]{8x^3 - 3x^3 \\ln x}", "y = ∛(8x³ - 3x³ ln x)"],
    ["\\int u^2 du = \\int -\\frac{1}{x} dx", "∫ u² du = ∫ -1/x dx"],
    ["x = 3 \\text{ or } x = 2", "x = 3 or x = 2"],
    ["2^{n-1}", "2ⁿ⁻¹"],
    ["e^{x^2}", "e^(x²)"],
    ["\\frac{a+b}{c}", "(a+b)/c"],
  ])("%s", (input, want) => {
    expect(latexToText(input)).toBe(want)
  })
  it("never returns nothing for a real input", () => {
    for (const t of ["\\", "{", "}}}", "\\frac", "\\frac{1}", "^", "_{", "\\sqrt", "x^", "\\unknowncommand{x}"])
      expect(latexToText(t).length).toBeGreaterThan(0)
  })
  it("does not hang or throw on odd input", () => {
    expect(() => latexToText("{".repeat(2000) + "x" + "}".repeat(2000))).not.toThrow()
    expect(() => latexToText("\\frac{".repeat(300))).not.toThrow()
  })
  it("leaves plain text alone", () => expect(latexToText("hello world")).toBe("hello world"))
})
