// A tiny page builder for the exported PDF. Each page is drawn on a canvas (A4 at 150 dpi)
// and later put into the PDF as a picture. That keeps marks, ticks and maths symbols exact,
// with no font problems. The price: the text in the PDF cannot be selected or searched.

export const PAGE_W = 1240
export const PAGE_H = 1754
export const MARGIN = 90
const FONT =
  '"DejaVu Sans", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'

export type TextStyle = {
  size?: number
  color?: string
  bold?: boolean
  italic?: boolean
  gapAfter?: number
}

export const font = (size: number, bold = false, italic = false) =>
  `${italic ? "italic " : ""}${bold ? "bold " : ""}${size}px ${FONT}`

// Breaks text into lines no wider than maxWidth. A word longer than a line is cut.
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const lines: string[] = []
  for (const paragraph of text.split("\n")) {
    let line = ""
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const trial = line ? `${line} ${word}` : word
      if (ctx.measureText(trial).width <= maxWidth) {
        line = trial
        continue
      }
      if (line) lines.push(line)
      let rest = word
      while (ctx.measureText(rest).width > maxWidth && rest.length > 1) {
        let cut = rest.length - 1
        while (cut > 1 && ctx.measureText(rest.slice(0, cut)).width > maxWidth)
          cut--
        lines.push(rest.slice(0, cut))
        rest = rest.slice(cut)
      }
      line = rest
    }
    lines.push(line)
  }
  return lines
}

export class Doc {
  pages: HTMLCanvasElement[] = []
  private ctx!: CanvasRenderingContext2D
  y = MARGIN

  constructor() {
    this.newPage()
  }

  newPage() {
    const c = document.createElement("canvas")
    c.width = PAGE_W
    c.height = PAGE_H
    const ctx = c.getContext("2d")
    if (!ctx) throw new Error("Could not draw the page.")
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, PAGE_W, PAGE_H)
    this.pages.push(c)
    this.ctx = ctx
    this.y = MARGIN
  }

  // Start a new page unless "h" more fits on this one.
  ensure(h: number) {
    if (this.y + h > PAGE_H - MARGIN) this.newPage()
  }

  gap(h: number) {
    this.y += h
  }

  text(
    str: string,
    {
      size = 30,
      color = "#111111",
      bold = false,
      italic = false,
      gapAfter = 10,
    }: TextStyle = {}
  ) {
    // Measure with the right font first, so the lines break in the right places.
    this.ctx.font = font(size, bold, italic)
    const lines = wrapText(this.ctx, str, PAGE_W - 2 * MARGIN)
    const lineH = Math.round(size * 1.35)
    for (const line of lines) {
      this.ensure(lineH) // may start a new page, which has its own drawing context
      const ctx = this.ctx // read again after ensure(), not before
      ctx.font = font(size, bold, italic)
      ctx.fillStyle = color
      ctx.textBaseline = "top"
      ctx.fillText(line, MARGIN, this.y)
      this.y += lineH
    }
    this.y += gapAfter
  }

  // Draws a picture at the left margin, scaled down to fit. Never scaled up.
  image(
    img: CanvasImageSource & { width: number; height: number },
    maxW: number,
    maxH: number,
    border = true
  ) {
    const scale = Math.min(1, maxW / img.width, maxH / img.height)
    const w = Math.round(img.width * scale)
    const h = Math.round(img.height * scale)
    this.ensure(h + 20)
    this.ctx.drawImage(img, MARGIN, this.y, w, h)
    if (border) {
      this.ctx.strokeStyle = "#cccccc"
      this.ctx.lineWidth = 1
      this.ctx.strokeRect(MARGIN, this.y, w, h)
    }
    this.y += h + 20
  }

  rule() {
    this.ensure(30)
    this.ctx.strokeStyle = "#dddddd"
    this.ctx.lineWidth = 2
    this.ctx.beginPath()
    this.ctx.moveTo(MARGIN, this.y + 10)
    this.ctx.lineTo(PAGE_W - MARGIN, this.y + 10)
    this.ctx.stroke()
    this.y += 30
  }

  // The footer with the page number, drawn last on every page.
  numberPages(footer: string) {
    this.pages.forEach((c, i) => {
      const ctx = c.getContext("2d")!
      ctx.font = font(22)
      ctx.fillStyle = "#888888"
      ctx.textBaseline = "alphabetic"
      ctx.fillText(footer, MARGIN, PAGE_H - 40)
      const label = `${i + 1} / ${this.pages.length}`
      ctx.fillText(
        label,
        PAGE_W - MARGIN - ctx.measureText(label).width,
        PAGE_H - 40
      )
    })
  }
}
