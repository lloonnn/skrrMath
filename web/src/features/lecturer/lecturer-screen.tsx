import * as React from "react"

import { paperParts } from "@shared/index.ts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  addBook,
  changeBook,
  claimLecturer,
  isLecturer,
  listMyBooks,
  withdrawBook,
  type Book,
  type BookContent,
} from "@/features/lecturer/lecturer-api"
import { imageToReference } from "@/features/marking/reference"
import { uid } from "@/lib/uid"

const MAX_TEXT = 30000

const CLAIM_MESSAGE = {
  wrong_code: "That code is not right.",
  locked: "Too many wrong tries. Try again in an hour.",
  not_set: "Lecturer sign-up is not set up yet.",
} as const

// The lecturer area: give the code to become a lecturer, then add one answer book per paper.
export function LecturerScreen({
  userId,
  onClose,
}: {
  userId: string
  onClose: () => void
}) {
  const [lecturer, setLecturer] = React.useState<boolean | null>(null)
  const [books, setBooks] = React.useState<Book[]>([])
  const [message, setMessage] = React.useState<string | null>(null)

  // Bumping "tick" loads everything again (after the code is accepted, or a book changes).
  const [tick, setTick] = React.useState(0)
  const reload = React.useCallback(() => setTick((t) => t + 1), [])

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const is = await isLecturer()
        const mine = is ? await listMyBooks(userId) : []
        if (cancelled) return
        setLecturer(is)
        setBooks(mine)
      } catch (e) {
        if (!cancelled)
          setMessage(e instanceof Error ? e.message : "Could not load.")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId, tick])

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6 text-sm">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">Lecturer</h1>
        <Button size="sm" variant="outline" onClick={onClose}>
          Back to notes
        </Button>
      </div>
      {message && <p className="text-red-700">{message}</p>}
      {lecturer === null && <p className="text-muted-foreground">Loading...</p>}
      {lecturer === false && (
        <ClaimBox onDone={reload} setMessage={setMessage} />
      )}
      {lecturer && (
        <>
          <BookForm onSaved={reload} setMessage={setMessage} />
          <BookList books={books} onChanged={reload} setMessage={setMessage} />
        </>
      )}
    </div>
  )
}

function ClaimBox({
  onDone,
  setMessage,
}: {
  onDone: () => void
  setMessage: (m: string | null) => void
}) {
  const [code, setCode] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  async function go() {
    if (!code.trim()) return
    setBusy(true)
    setMessage(null)
    try {
      const r = await claimLecturer(code)
      if (r === "lecturer") onDone()
      else setMessage(CLAIM_MESSAGE[r])
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not check the code.")
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex max-w-sm flex-col gap-2">
      <p className="text-muted-foreground">
        Give the lecturer code to add answer books.
      </p>
      <Input
        type="password"
        autoComplete="off"
        placeholder="Lecturer code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && void go()}
      />
      <Button size="sm" disabled={busy} onClick={() => void go()}>
        Continue
      </Button>
    </div>
  )
}

// Add the answer book for a paper. If you already have a live one for it, it is changed.
function BookForm({
  onSaved,
  setMessage,
}: {
  onSaved: () => void
  setMessage: (m: string | null) => void
}) {
  const [course, setCourse] = React.useState("")
  const [exam, setExam] = React.useState("")
  const [text, setText] = React.useState("")
  const [image, setImage] = React.useState<BookContent | null>(null)
  const [busy, setBusy] = React.useState(false)
  const file = React.useRef<HTMLInputElement>(null)
  const parts = paperParts({ courseCode: course, exam })

  async function pick(f: File) {
    try {
      const ref = await imageToReference(f, uid())
      if (ref.kind === "image")
        setImage({ kind: "image", base64: ref.base64, mimeType: ref.mimeType })
      setText("")
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not add that picture.")
    }
  }

  async function save() {
    setMessage(null)
    if (!parts.course)
      return setMessage(
        "The course code should be letters then numbers, like UECM2353."
      )
    if (!parts.exam) return setMessage("Type the exam, like 2023 May.")
    const content: BookContent | null =
      image ?? (text.trim() ? { kind: "text", text } : null)
    if (!content) return setMessage("Add the solutions as text or a picture.")
    setBusy(true)
    try {
      await addBook(parts.course, parts.exam, content)
      setCourse("")
      setExam("")
      setText("")
      setImage(null)
      onSaved()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="flex max-w-2xl flex-col gap-2">
      <h2 className="font-medium">Add an answer book</h2>
      <p className="text-muted-foreground">
        One book per paper, with all its solutions. Every signed-in student can
        read it.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Input
          aria-label="Course code"
          placeholder="Course code, like UECM2353"
          value={course}
          onChange={(e) => setCourse(e.target.value)}
        />
        <Input
          aria-label="Exam"
          placeholder="Exam, like 2023 May"
          value={exam}
          onChange={(e) => setExam(e.target.value)}
        />
      </div>
      {(course || exam) && (
        <p className="text-xs text-muted-foreground" data-testid="paper-key">
          {parts.course && parts.exam
            ? `Students whose course is named ${parts.course} and whose note is named like "${parts.exam}" get this book.`
            : `Needs: ${[!parts.course && "course code", !parts.exam && "exam"].filter(Boolean).join(", ")}.`}
        </p>
      )}
      {image ? (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">
            A picture of the solutions is added.
          </span>
          <Button size="sm" variant="outline" onClick={() => setImage(null)}>
            Remove picture
          </Button>
        </div>
      ) : (
        <>
          <textarea
            aria-label="Solutions"
            rows={10}
            maxLength={MAX_TEXT}
            placeholder="Paste or type the solutions: Q1: ..., Q2: ..."
            className="w-full resize-y rounded-md border bg-background p-2"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <input
            ref={file}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ""
              if (f) void pick(f)
            }}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => file.current?.click()}
          >
            Add a picture instead
          </Button>
        </>
      )}
      <div>
        <Button size="sm" disabled={busy} onClick={() => void save()}>
          Save the book
        </Button>
      </div>
    </section>
  )
}

function BookList({
  books,
  onChanged,
  setMessage,
}: {
  books: Book[]
  onChanged: () => void
  setMessage: (m: string | null) => void
}) {
  const [editing, setEditing] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState("")
  // A new picture chosen while changing a book. It replaces the old text or picture.
  const [draftImage, setDraftImage] = React.useState<BookContent | null>(null)
  const changeFile = React.useRef<HTMLInputElement>(null)

  async function run(job: () => Promise<void>) {
    setMessage(null)
    try {
      await job()
      onChanged()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "That did not work.")
    }
  }

  if (books.length === 0)
    return (
      <p className="text-muted-foreground">You have no answer books yet.</p>
    )
  return (
    <section className="flex max-w-2xl flex-col gap-3">
      <h2 className="font-medium">Your answer books</h2>
      {books.map((b) => (
        <div
          key={b.id}
          className="flex flex-col gap-2 border-b pb-3"
          data-testid="book"
        >
          <div className="flex items-center justify-between gap-2">
            <span>
              <strong>{b.course_code}</strong> · {b.exam}
              <span className="ml-2 text-xs text-muted-foreground">
                version {b.version}
                {b.withdrawn ? " · withdrawn" : ""}
              </span>
            </span>
            {!b.withdrawn && (
              <span className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditing(b.id)
                    setDraft(b.answer_text ?? "")
                    setDraftImage(null)
                  }}
                >
                  Change
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Withdraw the book for ${b.course_code} ${b.exam}? Students will no longer get it.`
                      )
                    )
                      void run(() => withdrawBook(b.id))
                  }}
                >
                  Withdraw
                </Button>
              </span>
            )}
          </div>
          {b.answer_image && (
            <img
              alt="The solutions"
              className="max-h-48 w-full border object-contain"
              src={`data:${b.answer_image_type};base64,${b.answer_image}`}
            />
          )}
          {editing === b.id ? (
            <>
              {draftImage ? (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    A new picture will replace the solutions.
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDraftImage(null)}
                  >
                    Remove picture
                  </Button>
                </div>
              ) : (
                <>
                  <textarea
                    aria-label="Change the solutions"
                    rows={10}
                    maxLength={MAX_TEXT}
                    placeholder={
                      b.answer_image
                        ? "Type text to replace the picture, or add a new picture"
                        : ""
                    }
                    className="w-full resize-y rounded-md border bg-background p-2"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  <input
                    ref={changeFile}
                    type="file"
                    accept="image/*"
                    aria-label="New picture"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      e.target.value = ""
                      if (!f) return
                      imageToReference(f, uid())
                        .then((ref) => {
                          if (ref.kind === "image")
                            setDraftImage({
                              kind: "image",
                              base64: ref.base64,
                              mimeType: ref.mimeType,
                            })
                        })
                        .catch((err) =>
                          setMessage(
                            err instanceof Error
                              ? err.message
                              : "Could not add that picture."
                          )
                        )
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => changeFile.current?.click()}
                  >
                    Add a picture instead
                  </Button>
                </>
              )}
              <div className="flex gap-1">
                <Button
                  size="sm"
                  disabled={!draftImage && !draft.trim()}
                  onClick={() =>
                    void run(async () => {
                      await changeBook(
                        b.id,
                        draftImage ?? { kind: "text", text: draft }
                      )
                      setEditing(null)
                      setDraftImage(null)
                    })
                  }
                >
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            b.answer_text && (
              <p className="line-clamp-3 whitespace-pre-wrap text-muted-foreground">
                {b.answer_text}
              </p>
            )
          )}
        </div>
      ))}
    </section>
  )
}
