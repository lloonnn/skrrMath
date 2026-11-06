import { describe, expect, it } from "vitest"
import { markingLabel } from "../../../shared/src/index.ts"
import type { ModelCall, ModelClient } from "../providers/types.ts"
import { ModelUnavailableError } from "../providers/types.ts"
import { markRequestSchema, type MarkRequest } from "../types.ts"
import { markWithModel } from "./mark.ts"
import { Jimp } from "jimp"
import { CROPS_SYSTEM, EQUIV_SYSTEM, LOCATE_SYSTEM, MARK_SYSTEM, SOLVE_SYSTEM, TRANSCRIBE_SYSTEM } from "./prompts.ts"

const img = { mimeType: "image/png" as const, base64: "AAAA" }
const req = (extra: Partial<MarkRequest> = {}): MarkRequest => ({
  blockImage: img,
  answerImage: img,
  tags: { course: "MATH101", question: "1" },
  ...extra,
})
const opts = { solveRuns: 2, model: "mock-model" }

type Step = "transcribe" | "solve" | "mark" | "equiv" | "locate" | "crops"
const stepOf = (c: ModelCall): Step =>
  c.system === TRANSCRIBE_SYSTEM ? "transcribe" : c.system === SOLVE_SYSTEM ? "solve" : c.system === EQUIV_SYSTEM ? "equiv" : c.system === LOCATE_SYSTEM ? "locate" : c.system === CROPS_SYSTEM ? "crops" : (c.system === MARK_SYSTEM ? "mark" : (() => { throw new Error("unknown step") })())

// A scripted model. Each step has a queue of replies. The last one repeats.
function mock(input: Partial<Record<Step, string[]>>) {
  const script = { locate: ["[]"], crops: ["[]"], equiv: [JSON.stringify({ equivalent: false })], ...input } as Record<Step, string[]>
  return mockFull(script)
}
function mockFull(script: Record<Step, string[]>) {
  const calls: Step[] = []
  const prompts: { step: Step; prompt: string }[] = []
  const used: Record<Step, number> = { transcribe: 0, solve: 0, mark: 0, equiv: 0, locate: 0, crops: 0 }
  const client: ModelClient = {
    async generate(call) {
      const s = stepOf(call)
      calls.push(s)
      prompts.push({ step: s, prompt: call.prompt })
      const q = script[s]
      return q[Math.min(used[s]++, q.length - 1)]
    },
  }
  return { client, calls, prompts }
}

const line = (n: number, latex: string, readable = true) => ({ n, latex, readable })
const transcription = (lines = [line(1, "3x - 5 = 10"), line(2, "3x = 10 - 5"), line(3, "3x = 5"), line(4, "x = 5/3")]) =>
  JSON.stringify({ question_restated: "Solve 3x - 5 = 10.", lines })
const solve = (a: string) => JSON.stringify({ final_answer_latex: a })
const ml = (n: number, verdict: string, comment = "") => ({ n, verdict, comment, correct_latex: null })
const markOut = (lines: unknown[], over: Record<string, unknown> = {}) =>
  JSON.stringify({
    lines,
    error_type: "sign",
    final_answer: { matches_reference: "no", student_latex: "x = 5/3", reference_latex: "x = 5" },
    method_ok: true,
    summary: "One slip.",
    ...over,
  })
const okLines = [ml(1, "ok"), ml(2, "error", "Sign slip"), ml(3, "follows_from_error"), ml(4, "follows_from_error")]

const locateFor = (n: number) =>
  JSON.stringify(Array.from({ length: n }, (_, i) => ({ text: `l${i + 1}`, box_2d: [i * 200 + 50, 100, i * 200 + 150, 900] })))

describe("a lecturer's answer book", () => {
  const book = { kind: "text" as const, text: "Q1: x = 4. Q2: x = 5.", book: true as const }
  const bookOut = (match?: "found" | "not_found") => markOut(okLines, match ? { book_match: match } : {})
  it("is described to the model as a book to find the question in", async () => {
    const { client, prompts } = mock({ transcribe: [transcription()], solve: [solve("x")], mark: [bookOut("found")] })
    await markWithModel(client, req({ verifiedAnswer: book }), opts)
    const p = prompts.find((x) => x.step === "mark")!.prompt
    expect(p).toContain("ANSWER BOOK")
    expect(p).toContain("book_match")
    expect(p).toContain("Q1: x = 4")
    expect(p).not.toContain("ONE correct solution")
  })
  it("is labelled as a lecturer's solution, and the AI does not solve the question", async () => {
    const { client, calls } = mock({ transcribe: [transcription()], solve: [solve("x")], mark: [bookOut("found")] })
    const r = await markWithModel(client, req({ verifiedAnswer: book }), opts)
    expect(calls).not.toContain("solve")
    expect(r.reference_source).toBe("verified_bank")
    expect(markingLabel(r)).toBe("Checked against a lecturer's solution")
  })
  it("a book that is a picture is sent as an extra picture", async () => {
    const seen: number[] = []
    const { client } = mock({ transcribe: [transcription()], solve: [solve("x")], mark: [bookOut("found")] })
    const spy = { generate: async (c: Parameters<typeof client.generate>[0]) => { if (c.system === MARK_SYSTEM) seen.push(c.images.length); return client.generate(c) } }
    await markWithModel(spy, req({ verifiedAnswer: { kind: "image", image: img, book: true } }), opts)
    expect(seen).toEqual([3])
  })
  it("marks without the book when the question is not in it", async () => {
    const { client, calls } = mock({ transcribe: [transcription()], solve: [solve("x=5"), solve("x=5")], mark: [bookOut("not_found"), bookOut()] })
    const r = await markWithModel(client, req({ verifiedAnswer: book }), opts)
    expect(calls).toContain("solve") // the AI solved it itself
    expect(r.reference_source).toBe("ai_solved")
    expect(markingLabel(r)).toBe("AI-checked")
  })
  it("does not claim a lecturer's solution for the student's own answer", async () => {
    const { client } = mock({ transcribe: [transcription()], solve: [solve("x")], mark: [markOut(okLines)] })
    const r = await markWithModel(client, req({ verifiedAnswer: { kind: "text", text: "x = 5" } }), opts)
    expect(r.reference_source).toBe("verified_user")
  })
  it("a book of 30000 characters is accepted by the request check", () => {
    expect(markRequestSchema.safeParse({ blockImage: img, answerImage: img, tags: { course: "T", question: "1" }, verifiedAnswer: { kind: "text", text: "x".repeat(30000), book: true } }).success).toBe(true)
    expect(markRequestSchema.safeParse({ blockImage: img, answerImage: img, tags: { course: "T", question: "1" }, verifiedAnswer: { kind: "text", text: "x".repeat(30001), book: true } }).success).toBe(false)
  })
})

describe("a reference answer is one route, not the only one", () => {
  it("tells the model so when the student gave a reference", async () => {
    const { client, prompts } = mock({ transcribe: [transcription()], solve: [solve("x")], mark: [markOut(okLines)] })
    await markWithModel(client, req({ verifiedAnswer: { kind: "text", text: "x = 5" } }), opts)
    const markPrompt = prompts.find((p) => p.step === "mark")!.prompt
    expect(markPrompt).toContain("ONE correct solution")
    expect(markPrompt).toContain("different valid method")
    expect(markPrompt).toContain("x = 5")
  })
  it("does not add that note when the AI solved it itself", async () => {
    const { client, prompts } = mock({ transcribe: [transcription()], solve: [solve("x=5"), solve("x=5")], mark: [markOut(okLines)] })
    await markWithModel(client, req(), opts)
    expect(prompts.find((p) => p.step === "mark")!.prompt).not.toContain("ONE correct solution")
  })
  it("sends a pasted image reference as a third picture", async () => {
    const seen: number[] = []
    const { client } = mock({ transcribe: [transcription()], solve: [solve("x")], mark: [markOut(okLines)] })
    const spy = { generate: async (c: Parameters<typeof client.generate>[0]) => { if (c.system === MARK_SYSTEM) seen.push(c.images.length); return client.generate(c) } }
    await markWithModel(spy, req({ verifiedAnswer: { kind: "image", image: img } }), opts)
    expect(seen).toEqual([3])
  })
  it("labels the result as checked against the student's own answer", async () => {
    const { client } = mock({ transcribe: [transcription()], solve: [solve("x")], mark: [markOut(okLines)] })
    const r = await markWithModel(client, req({ verifiedAnswer: { kind: "text", text: "x = 5" } }), opts)
    expect(markingLabel(r)).toBe("Checked against your answer")
  })
})

// A real, small, white picture, so that cutting lines out of it really runs.
async function whitePng(): Promise<string> {
  const img = new Jimp({ width: 400, height: 300, color: 0xffffffff })
  return (await img.getBuffer("image/png")).toString("base64")
}

describe("each line is read as its own picture", () => {
  const boxesFor = (n: number) =>
    JSON.stringify(Array.from({ length: n }, (_, i) => ({ text: `l${i + 1}`, box_2d: [i * 250 + 100, 100, i * 250 + 200, 900] })))
  const rd = (n: number, extra: Partial<Record<string, unknown>> = {}) =>
    JSON.stringify({ question_restated: "Solve 3x - 5 = 10.", lines: Array.from({ length: n }, (_, i) => ({ n: i + 1, latex: `line ${i + 1}`, readable: true, ...extra })) })
  const withImage = async () => req({ answerImage: { mimeType: "image/png", base64: await whitePng() } })

  it("sends the question and one picture per line, in one call", async () => {
    const seen: number[] = []
    const { client } = mock({ locate: [boxesFor(4)], crops: [rd(4)], solve: [solve("x=5")], mark: [markOut(okLines)] })
    const spy = { generate: async (c: Parameters<typeof client.generate>[0]) => { if (c.system === CROPS_SYSTEM) seen.push(c.images.length); return client.generate(c) } }
    await markWithModel(spy, await withImage(), opts)
    expect(seen).toEqual([5]) // 1 question + 4 lines
  })
  it("uses the line-by-line reading as the transcription, and its boxes", async () => {
    const { client, calls } = mock({ locate: [boxesFor(4)], crops: [rd(4)], solve: [solve("x=5")], mark: [markOut(okLines)] })
    const r = await markWithModel(client, await withImage(), opts)
    expect(calls).not.toContain("transcribe") // the whole page was not read
    expect(r.lines.map((l) => l.latex)).toEqual(["line 1", "line 2", "line 3", "line 4"])
    expect(r.lines.every((l) => l.box !== null)).toBe(true)
    expect(r.lines[0].box).toEqual([80, 80, 220, 920]) // each box matches its line, 2 percent added
  })
  it("reads the page as a whole when the pictures cannot be cut", async () => {
    // the default test picture is not a real image, so cutting fails
    const { client, calls } = mock({ locate: [boxesFor(4)], transcribe: [transcription()], solve: [solve("x=5")], mark: [markOut(okLines)] })
    const r = await markWithModel(client, req(), opts)
    expect(calls).toContain("transcribe")
    expect(calls).not.toContain("crops")
    expect(r.status).toBe("marked")
    expect(r.lines.every((l) => l.box !== null)).toBe(true) // still matched by order, 4 and 4
  })
  it("reads the page as a whole when locating finds nothing", async () => {
    const { client, calls } = mock({ locate: ["[]"], transcribe: [transcription()], solve: [solve("x=5")], mark: [markOut(okLines)] })
    await markWithModel(client, await withImage(), opts)
    expect(calls).toContain("transcribe")
    expect(calls).not.toContain("crops")
  })
  it("tries the line-by-line reading once more when it has the wrong number of lines", async () => {
    const { client, calls } = mock({ locate: [boxesFor(4)], crops: [rd(3), rd(4)], solve: [solve("x=5")], mark: [markOut(okLines)] })
    const r = await markWithModel(client, await withImage(), opts)
    expect(calls.filter((c) => c === "crops")).toHaveLength(2)
    expect(calls).not.toContain("transcribe") // the second try worked, so the page is not read whole
    expect(r.lines.map((l) => l.latex)).toEqual(["line 1", "line 2", "line 3", "line 4"])
  })
  it("reads the page as a whole when both line-by-line replies have the wrong number of lines", async () => {
    const { client, calls } = mock({ locate: [boxesFor(4)], crops: [rd(3)], transcribe: [transcription()], solve: [solve("x=5")], mark: [markOut(okLines)] })
    const r = await markWithModel(client, await withImage(), opts)
    expect(calls.filter((c) => c === "crops")).toHaveLength(2)
    expect(calls).toContain("transcribe")
    expect(r.lines.map((l) => l.latex)).toEqual(["3x - 5 = 10", "3x = 10 - 5", "3x = 5", "x = 5/3"])
  })
  it("keeps a line the model could not read as unreadable", async () => {
    const reply = JSON.stringify({ question_restated: "q", lines: [{ n: 1, latex: "a", readable: true }, { n: 2, latex: "", readable: false }, { n: 3, latex: "c", readable: true }] })
    const { client } = mock({ locate: [boxesFor(3)], crops: [reply], solve: [solve("x")], mark: [markOut([ml(1, "ok"), ml(2, "ok"), ml(3, "ok")], { error_type: null })] })
    const r = await markWithModel(client, await withImage(), opts)
    expect(r.lines[1]).toMatchObject({ verdict: "unreadable", readable: false })
  })
  it("reads the page as a whole when the line-by-line reading gives no usable reply", async () => {
    // the "crops" reply is left as the mock default, which is not a valid reply
    const two = JSON.stringify([{ text: "a", box_2d: [100, 100, 200, 900] }, { text: "b", box_2d: [400, 100, 500, 900] }])
    const { client, calls } = mock({ locate: [two], transcribe: [transcription([line(1, "a"), line(2, "b")])], solve: [solve("x")], mark: [markOut([ml(1, "ok"), ml(2, "ok")], { error_type: null })] })
    await markWithModel(client, await withImage(), opts)
    expect(calls).toContain("crops")
    expect(calls).toContain("transcribe")
  })
})

describe("progress steps", () => {
  const steps = async (script: Parameters<typeof mock>[0], r: Partial<MarkRequest> = {}) => {
    const { client } = mock(script)
    const seen: string[] = []
    await markWithModel(client, req(r), opts, (s) => seen.push(s.n ? `${s.step} ${s.n}/${s.of}` : s.step))
    return seen
  }
  it("reports each step in order when the AI solves the question", async () => {
    expect(await steps({ transcribe: [transcription()], solve: [solve("x=5"), solve("x=5")], mark: [markOut(okLines)] })).toEqual([
      "locating", "reading", "solving 1/2", "solving 2/2", "marking",
    ])
  })
  it("adds a comparing step only when the two answers are written differently", async () => {
    const seen = await steps({ transcribe: [transcription()], solve: [solve("x=5"), solve("x = five")], equiv: [JSON.stringify({ equivalent: true })], mark: [markOut(okLines)] })
    expect(seen).toEqual(["locating", "reading", "solving 1/2", "solving 2/2", "comparing", "marking"])
  })
  it("skips solving when a verified answer is given", async () => {
    expect(await steps({ transcribe: [transcription()], solve: [solve("x")], mark: [markOut(okLines)] }, { verifiedAnswer: { kind: "text", text: "x = 5" } })).toEqual([
      "locating", "reading", "marking",
    ])
  })
  it("works without a listener", async () => {
    const { client } = mock({ transcribe: [transcription()], solve: [solve("x=5")], mark: [markOut(okLines)] })
    await expect(markWithModel(client, req(), opts)).resolves.toMatchObject({ status: "marked" })
  })
})

describe("markWithModel", () => {
  it("puts a padded box on each line when the counts match", async () => {
    const { client } = mock({ transcribe: [transcription()], solve: [solve("x=5")], mark: [markOut(okLines)], locate: [locateFor(4)] })
    const r = await markWithModel(client, req(), opts)
    expect(r.lines.every((l) => l.box !== null)).toBe(true)
    expect(r.lines[0].box).toEqual([30, 80, 170, 920]) // 2 percent added on each side
    expect(r.lines[3].box).toEqual([630, 80, 770, 920])
  })
  it("gives no boxes when the count differs, and still marks", async () => {
    const { client } = mock({ transcribe: [transcription()], solve: [solve("x=5")], mark: [markOut(okLines)], locate: [locateFor(3)] })
    const r = await markWithModel(client, req(), opts)
    expect(r.status).toBe("marked")
    expect(r.lines.every((l) => l.box === null)).toBe(true)
  })
  it("keeps marking when the locate step fails", async () => {
    const { client } = mock({ transcribe: [transcription()], solve: [solve("x=5")], mark: [markOut(okLines)], locate: ["oops"] })
    const r = await markWithModel(client, req(), opts)
    expect(r.status).toBe("marked")
    expect(r.lines.every((l) => l.box === null)).toBe(true)
  })
  it("clamps padding to the 0 to 1000 scale", async () => {
    const one = JSON.stringify([{ text: "a", box_2d: [0, 0, 1000, 1000] }])
    const { client } = mock({ transcribe: [transcription([line(1, "x = 5")])], solve: [solve("x=5")], mark: [markOut([ml(1, "ok")], { error_type: null })], locate: [one] })
    expect((await markWithModel(client, req(), opts)).lines[0].box).toEqual([0, 0, 1000, 1000])
  })
  it("pads a zero-size box into a small valid one", async () => {
    const bad = JSON.stringify([{ text: "a", box_2d: [500, 500, 500, 500] }])
    const { client } = mock({ transcribe: [transcription([line(1, "x = 5")])], solve: [solve("x=5")], mark: [markOut([ml(1, "ok")], { error_type: null })], locate: [bad] })
    const r = await markWithModel(client, req(), opts)
    expect(r.lines[0].box).toEqual([480, 480, 520, 520])
  })
  it("marks the first error, labels it AI-checked, and keeps the literal text", async () => {
    const { client } = mock({ transcribe: [transcription()], solve: [solve("x=5")], mark: [markOut(okLines)] })
    const r = await markWithModel(client, req(), opts)
    expect(r.status).toBe("marked")
    expect(r.first_error_line).toBe(2)
    expect(r.lines.map((l) => l.verdict)).toEqual(["ok", "error", "follows_from_error", "follows_from_error"])
    expect(r.lines[1].latex).toBe("3x = 10 - 5") // the student's slip, not corrected
    expect(r.solve_runs_agree).toBe(true)
    expect(markingLabel(r)).toBe("AI-checked")
    expect(r.model).toBe("mock-model")
  })

  it("uses a verified answer without solving", async () => {
    const { client, calls } = mock({ transcribe: [transcription()], solve: [solve("x")], mark: [markOut(okLines)] })
    const r = await markWithModel(client, req({ verifiedAnswer: { kind: "text", text: "x = 5" } }), opts)
    expect(calls).not.toContain("solve")
    expect(r.reference_source).toBe("verified_user")
    expect(r.solve_runs_agree).toBeNull()
    expect(markingLabel(r)).not.toBe("AI-checked")
  })

  it("keeps the first error when the model marks two", async () => {
    const lines = [ml(1, "ok"), ml(2, "error"), ml(3, "error"), ml(4, "error")]
    const { client } = mock({ transcribe: [transcription()], solve: [solve("x=5")], mark: [markOut(lines)] })
    const r = await markWithModel(client, req(), opts)
    expect(r.lines.filter((l) => l.verdict === "error").map((l) => l.n)).toEqual([2])
    expect(r.lines.slice(2).map((l) => l.verdict)).toEqual(["follows_from_error", "follows_from_error"])
  })

  it("returns unsure and does not judge the answer when the solves disagree", async () => {
    const { client } = mock({ transcribe: [transcription()], solve: [solve("x=5"), solve("x=7")], mark: [markOut(okLines)] })
    const r = await markWithModel(client, req(), opts)
    expect(r.status).toBe("unsure")
    expect(r.solve_runs_agree).toBe(false)
    expect(r.final_answer.matches_reference).toBe("unknown")
    expect(r.final_answer.reference_latex).toBeNull()
  })

  it("treats differently written but equivalent answers as agreeing", async () => {
    const { client, calls } = mock({
      transcribe: [transcription()], solve: [solve("y=x(8-3\\ln x)^{1/3}"), solve("y=\\sqrt[3]{8x^3-3x^3\\ln x}")],
      equiv: [JSON.stringify({ equivalent: true })], mark: [markOut(okLines)],
    })
    const r = await markWithModel(client, req(), opts)
    expect(r.status).toBe("marked")
    expect(r.solve_runs_agree).toBe(true)
    expect(calls.filter((c) => c === "equiv")).toHaveLength(1)
  })

  it("does not ask the equivalence check when the text already matches", async () => {
    const { client, calls } = mock({ transcribe: [transcription()], solve: [solve("x = 5"), solve("x=5")], mark: [markOut(okLines)] })
    await markWithModel(client, req(), opts)
    expect(calls).not.toContain("equiv")
  })

  it("counts a broken equivalence check as disagreement", async () => {
    const { client } = mock({ transcribe: [transcription()], solve: [solve("x=5"), solve("x=7")], equiv: ["oops"], mark: [markOut(okLines)] })
    expect((await markWithModel(client, req(), opts)).status).toBe("unsure")
  })

  it("treats a failed solve run as disagreement, not agreement", async () => {
    const { client } = mock({ transcribe: [transcription()], solve: [solve("x=5"), "not json"], mark: [markOut(okLines)] })
    const r = await markWithModel(client, req(), opts)
    expect(r.status).toBe("unsure")
  })

  it("does not invent an error when none is named", async () => {
    const lines = [ml(1, "ok"), ml(2, "ok"), ml(3, "follows_from_error"), ml(4, "ok")]
    const { client } = mock({ transcribe: [transcription()], solve: [solve("x=5")], mark: [markOut(lines, { error_type: "sign" })] })
    const r = await markWithModel(client, req(), opts)
    expect(r.first_error_line).toBeNull()
    expect(r.error_type).toBeNull()
    expect(r.lines.some((l) => l.verdict === "follows_from_error")).toBe(false)
  })

  it("leaves an unreadable line unmarked even if the model judged it", async () => {
    const t = transcription([line(1, "3x - 5 = 10"), line(2, "", false), line(3, "x = 5")])
    const lines = [ml(1, "ok"), ml(2, "ok"), ml(3, "ok")]
    const { client } = mock({ transcribe: [t], solve: [solve("x=5")], mark: [markOut(lines, { error_type: null })] })
    const r = await markWithModel(client, req(), opts)
    expect(r.lines[1]).toMatchObject({ readable: false, verdict: "unreadable", correct_latex: null })
  })

  it("marks a line unreadable when the mark step is unsure about it", async () => {
    const lines = [ml(1, "ok"), ml(2, "unreadable"), ml(3, "ok"), ml(4, "ok")]
    const { client } = mock({ transcribe: [transcription()], solve: [solve("x=5")], mark: [markOut(lines, { error_type: null })] })
    const r = await markWithModel(client, req(), opts)
    expect(r.lines[1].verdict).toBe("unreadable")
    expect(r.lines[1].readable).toBe(false)
  })

  it("retries broken JSON once, then succeeds", async () => {
    const { client, calls } = mock({ transcribe: [transcription()], solve: [solve("x=5")], mark: ["{oops", markOut(okLines)] })
    const r = await markWithModel(client, req(), opts)
    expect(r.status).toBe("marked")
    expect(calls.filter((c) => c === "mark")).toHaveLength(2)
  })

  it("passes a quota error up instead of calling the answer unreadable", async () => {
    const calls: number[] = []
    const client: ModelClient = { generate: async () => { calls.push(1); throw new ModelUnavailableError(429, "quota") } }
    await expect(markWithModel(client, req(), opts)).rejects.toBeInstanceOf(ModelUnavailableError)
    expect(calls).toHaveLength(1) // no retry
  })

  it("returns unreadable after one retry of broken JSON", async () => {
    const { client, calls } = mock({ transcribe: ["{oops"], solve: [solve("x")], mark: [markOut(okLines)] })
    const r = await markWithModel(client, req(), opts)
    expect(r.status).toBe("unreadable")
    expect(calls).toEqual(["locate", "transcribe", "transcribe"])
  })

  it("returns unreadable when every line is unreadable", async () => {
    const t = transcription([line(1, "", false), line(2, "", false)])
    const { client } = mock({ transcribe: [t], solve: [solve("x=5")], mark: [markOut([ml(1, "ok"), ml(2, "ok")], { error_type: null })] })
    const r = await markWithModel(client, req(), opts)
    expect(r.status).toBe("unreadable")
    expect(r.first_error_line).toBeNull()
    expect(r.lines.some((l) => l.verdict === "ok" || l.verdict === "error")).toBe(false)
  })

  it("never returns a result the shared schema rejects", async () => {
    const { client } = mock({ transcribe: [transcription([line(1, "a"), line(1, "b")])], solve: [solve("x")], mark: [markOut([ml(1, "ok")])] })
    const r = await markWithModel(client, req(), opts)
    expect(r.status).toBe("unreadable") // duplicate line numbers fail validation
  })
})
