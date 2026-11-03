// A readable plain-text version of a LaTeX string, for places that cannot draw maths
// (the exported PDF). It is an approximation: simple things come out well, rare
// commands are left as they are. It never throws and never returns an empty string
// for a non-empty input.

const SUP: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", n: "ⁿ", i: "ⁱ",
}
const SUB: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋",
}
const SYMBOLS: Record<string, string> = {
  "\\cdot": "·", "\\times": "×", "\\pm": "±", "\\mp": "∓", "\\div": "÷",
  "\\infty": "∞", "\\int": "∫", "\\sum": "Σ", "\\prod": "Π", "\\partial": "∂",
  "\\pi": "π", "\\theta": "θ", "\\alpha": "α", "\\beta": "β", "\\gamma": "γ", "\\delta": "δ",
  "\\lambda": "λ", "\\mu": "μ", "\\sigma": "σ", "\\omega": "ω", "\\phi": "φ", "\\epsilon": "ε",
  "\\Rightarrow": "⇒", "\\rightarrow": "→", "\\to": "→", "\\Leftrightarrow": "⇔", "\\implies": "⇒",
  "\\leq": "≤", "\\le": "≤", "\\geq": "≥", "\\ge": "≥", "\\neq": "≠", "\\approx": "≈",
  "\\in": "∈", "\\forall": "∀", "\\exists": "∃", "\\ldots": "...", "\\dots": "...",
}

// The text inside the braces that start at s[i] (which must be "{"), and where it ends.
function group(s: string, i: number): { text: string; end: number } | null {
  if (s[i] !== "{") return null
  let depth = 0
  for (let j = i; j < s.length; j++) {
    if (s[j] === "{") depth++
    else if (s[j] === "}" && --depth === 0) return { text: s.slice(i + 1, j), end: j + 1 }
  }
  return null
}

// One argument: a {group}, or a single character or command.
function arg(s: string, i: number): { text: string; end: number } | null {
  while (s[i] === " ") i++
  if (i >= s.length) return null
  const g = group(s, i)
  if (g) return g
  if (s[i] === "\\") {
    const m = /^\\[A-Za-z]+/.exec(s.slice(i))
    return m ? { text: m[0], end: i + m[0].length } : { text: s.slice(i, i + 2), end: i + 2 }
  }
  return { text: s[i], end: i + 1 }
}

// A bit of text needs no brackets in a fraction if it is one word, or number, with
// optional super or subscripts.
const wrapIf = (t: string) => (/^[\w.\u00B2\u00B3\u00B9\u2070-\u209F]+$/.test(t) ? t : `(${t})`)

export function latexToText(tex: string): string {
  const out = convert(tex.replace(/\\left|\\right/g, "").replace(/\\[,;!: ]/g, " "))
  return out.replace(/\s+/g, " ").trim() || tex.trim()
}

function convert(s: string): string {
  let out = ""
  for (let i = 0; i < s.length; ) {
    const c = s[i]
    if (c === "\\") {
      const m = /^\\[A-Za-z]+/.exec(s.slice(i))
      const cmd = m ? m[0] : s.slice(i, i + 2)
      i += cmd.length
      if (cmd === "\\frac" || cmd === "\\dfrac" || cmd === "\\tfrac") {
        const a = arg(s, i)
        const b = a && arg(s, a.end)
        if (a && b) {
          out += `${wrapIf(convert(a.text))}/${wrapIf(convert(b.text))}`
          i = b.end
          continue
        }
      } else if (cmd === "\\sqrt") {
        let root = ""
        if (s[i] === "[") {
          const close = s.indexOf("]", i)
          if (close > 0) {
            root = s.slice(i + 1, close)
            i = close + 1
          }
        }
        const a = arg(s, i)
        if (a) {
          const inner = convert(a.text)
          out += root === "3" ? `∛(${inner})` : root ? `${convert(root)}√(${inner})` : `√(${inner})`
          i = a.end
          continue
        }
      } else if (cmd === "\\text" || cmd === "\\mathrm" || cmd === "\\textbf" || cmd === "\\operatorname") {
        const a = arg(s, i)
        if (a) {
          out += a.text
          i = a.end
          continue
        }
      } else if (cmd in SYMBOLS) {
        out += SYMBOLS[cmd]
        continue
      } else if (/^\\[A-Za-z]+$/.test(cmd)) {
        // \ln, \sin, \log, \lim ... become plain names. Unknown commands lose the backslash.
        out += cmd.slice(1)
        continue
      }
      out += cmd.slice(1)
      continue
    }
    if (c === "^" || c === "_") {
      const a = arg(s, i + 1)
      if (a) {
        const text = convert(a.text)
        const map = c === "^" ? SUP : SUB
        out += [...text].every((ch) => ch in map)
          ? [...text].map((ch) => map[ch]).join("")
          : `${c}(${text})`
        i = a.end
        continue
      }
    }
    if (c === "{" || c === "}") {
      i++
      continue
    }
    out += c
    i++
  }
  return out
}
