import { latexToText, marginView, type MarkingResult } from "@shared/index.ts"
import { markedPicture, loadImage } from "@/features/export/draw-marks"
import { Doc, PAGE_W, MARGIN } from "@/features/export/page-canvas"

// One question as it goes into the PDF.
export type ExportItem = {
  number: number
  // The pasted question image, as a data URL. null if it could not be drawn.
  question: string | null
  // What is written below it now, as a data URL. null if nothing is written.
  answerUrl: string | null
  // The marking, if the question was marked.
  mark: {
    result: MarkingResult
    imageUrl: string // the picture the marks belong to
    writingChanged: boolean
    answerChanged: boolean
  } | null
}

const RED = "#b91c1c"
const GREY = "#666666"
const CONTENT_W = PAGE_W - 2 * MARGIN
// The answer picture is kept short enough that the marking text fits under it on the same page.
const ANSWER_MAX_H = 700

// Builds the PDF. With "withMarks" false it is the clean paper: the questions and your
// writing, with no marks and no marking text.
export async function buildPdf(opts: {
  title: string
  subtitle: string
  items: ExportItem[]
  withMarks: boolean
}): Promise<Blob> {
  const { title, subtitle, items, withMarks } = opts
  const doc = new Doc()

  doc.text(title, { size: 52, bold: true, gapAfter: 8 })
  doc.text(subtitle, { size: 28, color: GREY, gapAfter: 8 })
  if (withMarks)
    doc.text(
      'Marks are made by an AI and are not certain. "AI-checked" means it marked from its own reasoning. "Checked against your answer" means it used the answer you gave.',
      { size: 24, color: GREY, italic: true, gapAfter: 10 }
    )
  doc.rule()

  if (items.length === 0)
    doc.text("There are no questions in this note yet.", {
      size: 30,
      color: GREY,
    })

  for (const [i, item] of items.entries()) {
    if (i > 0) doc.newPage()
    doc.text(`Question ${item.number}`, { size: 40, bold: true, gapAfter: 12 })

    if (item.question) doc.image(await loadImage(item.question), CONTENT_W, 380)
    else
      doc.text("(The question image could not be drawn.)", {
        size: 26,
        color: GREY,
        italic: true,
      })

    doc.text("Your answer", { size: 24, color: GREY, gapAfter: 6 })
    const view = withMarks && item.mark ? marginView(item.mark.result) : null
    if (view && item.mark) {
      doc.image(
        await markedPicture(item.mark.imageUrl, item.mark.result, view.label),
        CONTENT_W,
        ANSWER_MAX_H
      )
    } else if (item.answerUrl) {
      doc.image(
        await markedPicture(item.answerUrl, null, ""),
        CONTENT_W,
        ANSWER_MAX_H
      )
    } else {
      doc.text("Nothing is written below this question.", {
        size: 26,
        color: GREY,
        italic: true,
      })
    }

    if (!withMarks) continue
    if (!view || !item.mark) {
      doc.text("Not marked.", { size: 28, color: GREY, italic: true })
      continue
    }
    const sign = view.mark === "tick" ? "✓ " : view.mark === "cross" ? "✗ " : ""
    doc.text(sign + view.headline, {
      size: 36,
      bold: true,
      color: RED,
      gapAfter: 6,
    })
    if (view.detail) doc.text(view.detail, { size: 28, color: GREY })
    // Without line positions, the notes cannot sit beside the lines, so they are listed.
    if (!item.mark.result.lines.some((l) => l.box))
      for (const n of view.notes) doc.text(n.text, { size: 28, color: RED })
    if (view.answer) {
      doc.text(view.answer.by === "ai" ? "Expected answer" : "Correct answer", {
        size: 24,
        color: GREY,
        gapAfter: 4,
      })
      doc.text(latexToText(view.answer.latex), { size: 34 })
    }
    doc.text(view.summary, { size: 30 })
    doc.text(view.label, { size: 26, color: GREY, italic: true })
    if (item.mark.writingChanged)
      doc.text(
        "Your writing changed after this was marked, so the marks may not match it.",
        { size: 24, color: GREY, italic: true }
      )
    if (item.mark.answerChanged)
      doc.text("Your correct answer changed after this was marked.", {
        size: 24,
        color: GREY,
        italic: true,
      })
  }

  doc.numberPages(`skrrMath · ${title}`)

  // jsPDF is big, so it is only loaded when you export.
  const { jsPDF } = await import("jspdf")
  const pdf = new jsPDF({ unit: "pt", format: "a4", compress: true })
  pdf.setProperties({ title, subject: subtitle, creator: "skrrMath" })
  const w = pdf.internal.pageSize.getWidth()
  const h = pdf.internal.pageSize.getHeight()
  doc.pages.forEach((page, i) => {
    if (i > 0) pdf.addPage()
    pdf.addImage(page.toDataURL("image/jpeg", 0.9), "JPEG", 0, 0, w, h)
  })
  return pdf.output("blob")
}
