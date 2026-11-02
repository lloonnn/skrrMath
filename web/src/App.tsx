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
import { NoteCanvas, type Scene } from "@/features/canvas/note-canvas"
import { usePaperTree } from "@/features/papers/use-paper-tree"
import { useSession } from "@/features/auth/use-session"
import { uid } from "@/lib/uid"

export function App() {
  const session = useSession()
  const [tree, setTree] = usePaperTree()
  const [activeNoteId, setActiveNoteId] = React.useState<string | null>(null)
  const [marginOpen, setMarginOpen] = React.useState(true)
  const [blocks, setBlocks] = React.useState<SceneBlock[]>([])
  // Each note's writing, kept in memory while the page is open.
  const [scenes] = React.useState(() => new Map<string, Scene>())

  const activePaper = findPaper(tree, activeNoteId)

  function apply(edit: Edit, after?: () => void): string | null {
    if (!edit.ok) return edit.error
    setTree(edit.tree)
    after?.()
    return null
  }

  const actions: CourseActions = {
    addCourse: (input) => apply(addCourse(tree, input, uid())),
    // A new note opens straight away.
    addYear: (courseId, input) => {
      const id = uid()
      return apply(addYear(tree, courseId, input, id), () => {
        setBlocks([])
        setActiveNoteId(id)
      })
    },
    rename: (id, input) => apply(rename(tree, id, input)),
    remove: (id) => {
      const r = remove(tree, id)
      setTree(r.tree)
      r.removedNoteIds.forEach((p) => scenes.delete(p))
      if (activeNoteId && r.removedNoteIds.includes(activeNoteId)) {
        setBlocks([])
        setActiveNoteId(null)
      }
    },
  }

  return (
    <SidebarProvider
      style={{ "--sidebar-width": "19rem" } as React.CSSProperties}
    >
      <AppSidebar
        tree={tree}
        activeId={activePaper ? activeNoteId : null}
        onOpen={(id) => {
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
              <Button
                size="icon-sm"
                variant="ghost"
                className="ml-auto"
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
                <NoteCanvas
                  key={activeNoteId}
                  initial={scenes.get(activeNoteId)}
                  onScene={(scene) => scenes.set(activeNoteId, scene)}
                  onBlocks={setBlocks}
                />
              ) : (
                <p className="p-6 text-sm text-muted-foreground">
                  {tree.some((c) => c.years.length > 0)
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
          />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default App
