import * as React from "react"
import katex from "katex"
import "katex/dist/katex.min.css"

// Draws a LaTeX string as maths. KaTeX does not run links or scripts unless
// "trust" is on, and it is off here. A bad string shows as red source text.
// output "html" skips KaTeX's hidden MathML copy, which showed the maths twice
// when copied. The source goes in aria-label for screen readers.
export function Latex({ tex }: { tex: string }) {
  const html = React.useMemo(
    () =>
      katex.renderToString(tex, {
        throwOnError: false,
        trust: false,
        output: "html",
      }),
    [tex]
  )
  return (
    <span
      role="img"
      aria-label={tex}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
