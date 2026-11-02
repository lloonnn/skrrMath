import * as React from "react"
import { PanelRight } from "lucide-react"

import {
  addCourse,
  addYear,
  findPaper,
  remove,
  rename,
  type Edit,
  type SceneBlock,
} from "@shared/index.ts"

import { Button } from "@/components/ui/button"
import { AppSidebar } from "@/components/app-sidebar"
import type { CourseActions } from "@/components/nav-courses"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { MarkingMargin } from "@/features/marking/marking-margin"
import type { SavedMarks } from "@/features/marking/saved-marks"
import { NoteCanvas, type Scene } from "@/features/canvas/note-canvas"
import { usePaperTree } from "@/features/papers/use-paper-tree"
import { useSession } from "@/features/auth/use-session"
import {
  deleteCourse,
  deleteYear,
  insertCourse,
  insertYear,
  renameCourse,
  renameYear,
} from "@/features/cloud/cloud"
import { useAccountTree } from "@/features/cloud/use-account-tree"
import {
  deleteGuestScene,
  useCloudNote,
  useGuestNote,
} from "@/features/cloud/use-cloud-note"
import { uid } from "@/lib/uid"

const STATUS_TEXT = {
  idle: "",
  waiting: "Unsaved changes",
  saving: "Saving...",
  saved: "Saved",
  error: "",
} as const

// A guest's writing is saved in this browser, so the header says where.
const GUEST_STATUS_TEXT = {
  ...STATUS_TEXT,
  saved: "Saved in this browser",
} as const

export function App() {
  const session = useSession()
  const userId = session?.user.id ?? null

  // A guest keeps the list in this browser. A signed-in user keeps it in the account.
  const [localTree, setLocalTree] = usePaperTree()
  const account = useAccountTree(userId, localTree, () => setLocalTree([]))
  const signedIn = userId !== null && account.ready
  const tree = signedIn && account.tree ? account.tree : localTree
  const setTree = signedIn ? account.setTree : setLocalTree

  const [activeNoteId, setActiveNoteId] = React.useState<string | null>(null)
  const [marginOpen, setMarginOpen] = React.useState(true)
  const [blocks, setBlocks] = React.useState<SceneBlock[]>([])
  // The note as it is now. Read when Mark is pressed, so it is a ref, not state.
  const latestScene = React.useRef<Scene | null>(null)
  // The marking results of the open note. They are saved with its writing.
  const latestMarks = React.useRef<{
    noteId: string | null
    marks: SavedMarks
  }>({
    noteId: null,
    marks: {},
  })
  const [syncMessage, setSyncMessage] = React.useState<string | null>(null)

  const activePaper = findPaper(tree, activeNoteId)
  // The writing of the open note: in the account when signed in, else in this browser.
  const cloudNote = useCloudNote(signedIn ? userId : null, activeNoteId)
  const guestNote = useGuestNote(userId === null, activeNoteId)
  const note = signedIn ? cloudNote : guestNote

  // The note as it should be saved: its writing plus the marks of questions that still
  // exist (a mark whose question image was deleted is dropped).
  function withMarks(scene: Scene, noteId: string): Scene {
    if (latestMarks.current.noteId !== noteId)
      latestMarks.current = { noteId, marks: note.initial?.marks ?? {} }
    const live = new Set(
      scene.elements
        .filter((e) => !e.isDeleted && e.type === "image")
        .map((e) => e.id)
    )
    const marks = Object.fromEntries(
      Object.entries(latestMarks.current.marks).filter(([id]) => live.has(id))
    )
    return { ...scene, marks }
  }

  // A question was marked or re-marked: save it with the note.
  function onMarks(marks: SavedMarks) {
    if (!activeNoteId) return
    latestMarks.current = { noteId: activeNoteId, marks }
    const base =
      latestScene.current ?? (note.initial ? { ...note.initial } : null)
    if (!base) return
    const full = withMarks(base, activeNoteId)
    latestScene.current = full
    note.onScene(full)
  }

  // Write a list change to the account. If it fails, say so and reload the true list.
  function toCloud(job: () => Promise<void>) {
    job().catch((e) => {
      setSyncMessage(
        e instanceof Error
          ? `Not saved online: ${e.message}`
          : "Not saved online."
      )
      void account.reload()
    })
  }

  function apply(
    edit: Edit,
    after?: () => void,
    cloud?: () => Promise<void>
  ): string | null {
    if (userId && !account.ready)
      return "Still loading your notes. Try again in a moment."
    if (!edit.ok) return edit.error
    setTree(edit.tree)
    setSyncMessage(null)
    after?.()
    if (signedIn && cloud) toCloud(cloud)
    return null
  }

  const actions: CourseActions = {
    addCourse: (input) => {
      const id = uid()
      const e = addCourse(tree, input, id)
      return apply(
        e,
        undefined,
        e.ok
          ? () => insertCourse(id, e.tree.find((c) => c.id === id)!.code)
          : undefined
      )
    },
    // A new note opens straight away.
    addYear: (courseId, input) => {
      const id = uid()
      const e = addYear(tree, courseId, input, id)
      return apply(
        e,
        () => {
          setBlocks([])
          setActiveNoteId(id)
        },
        e.ok
          ? () =>
              insertYear(
                id,
                courseId,
                e.tree.flatMap((c) => c.years).find((y) => y.id === id)!.year
              )
          : undefined
      )
    },
    rename: (id, input) => {
      const e = rename(tree, id, input)
      return apply(
        e,
        undefined,
        e.ok
          ? () => {
              const c = e.tree.find((x) => x.id === id)
              if (c) return renameCourse(id, c.code)
              return renameYear(
                id,
                e.tree.flatMap((x) => x.years).find((y) => y.id === id)!.year
              )
            }
          : undefined
      )
    },
    remove: (id) => {
      if (userId && !account.ready) return
      const wasCourse = tree.some((c) => c.id === id)
      const r = remove(tree, id)
      setTree(r.tree)
      r.removedNoteIds.forEach((p) => void deleteGuestScene(p))
      if (activeNoteId && r.removedNoteIds.includes(activeNoteId)) {
        setBlocks([])
        setActiveNoteId(null)
      }
      if (signedIn)
        toCloud(() => (wasCourse ? deleteCourse(id) : deleteYear(id)))
    },
  }

  const problem =
    syncMessage ??
    account.error ??
    (note.status === "error" ? `Not saved: ${note.error}` : null)
  const notice = problem ? null : account.notice

  return (
    <SidebarProvider
      style={{ "--sidebar-width": "19rem" } as React.CSSProperties}
    >
      <AppSidebar
        tree={tree}
        activeId={activePaper ? activeNoteId : null}
        onOpen={(id) => {
          latestScene.current = null
          setBlocks([])
          setActiveNoteId(id)
        }}
        actions={actions}
        session={session}
      />
      <SidebarInset>
        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-12 shrink-0 items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              {activePaper && (
                <span className="text-sm text-muted-foreground">
                  {activePaper.code} · {activePaper.year}
                </span>
              )}
              <span
                className={
                  "ml-auto text-xs " +
                  (problem ? "text-red-700" : "text-muted-foreground")
                }
                role="status"
              >
                {problem ??
                  notice ??
                  (activePaper
                    ? (signedIn ? STATUS_TEXT : GUEST_STATUS_TEXT)[note.status]
                    : "")}
              </span>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={
                  marginOpen ? "Close marking panel" : "Open marking panel"
                }
                title={
                  marginOpen ? "Close marking panel" : "Open marking panel"
                }
                onClick={() => setMarginOpen((o) => !o)}
              >
                <PanelRight />
              </Button>
            </header>
            <div className="min-h-0 flex-1">
              {activePaper && activeNoteId ? (
                note.ready ? (
                  <NoteCanvas
                    key={activeNoteId}
                    initial={note.initial}
                    onScene={(scene) => {
                      const full = withMarks(scene, activeNoteId)
                      latestScene.current = full
                      note.onScene(full)
                    }}
                    onBlocks={setBlocks}
                  />
                ) : (
                  <p className="p-6 text-sm text-muted-foreground">
                    Opening this note...
                  </p>
                )
              ) : (
                <p className="p-6 text-sm text-muted-foreground">
                  {userId && !account.ready
                    ? "Loading your notes..."
                    : tree.some((c) => c.years.length > 0)
                      ? "Open a note from the list on the left to write."
                      : "Add a course, then a note, in the list on the left. Then open the note to write."}
                </p>
              )}
            </div>
          </div>
          <MarkingMargin
            open={marginOpen}
            blocks={blocks}
            paper={activePaper}
            signedIn={session !== null}
            getScene={() => latestScene.current}
            noteKey={`${activeNoteId ?? "none"}:${note.ready ? "ready" : "loading"}`}
            initialMarks={note.initial?.marks ?? {}}
            onMarks={onMarks}
          />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default App
