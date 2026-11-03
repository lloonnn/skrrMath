import * as React from "react"
import {
  ChevronRightIcon,
  FileTextIcon,
  FolderIcon,
  MoreHorizontalIcon,
  PlusIcon,
} from "lucide-react"

import { effectiveCourseCode, type PaperTree } from "@shared/index.ts"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { SidebarGroup, SidebarGroupLabel } from "@/components/ui/sidebar"

// Each action returns an error message, or null when it worked.
export type CourseActions = {
  addCourse: (input: string) => string | null
  addYear: (courseId: string, input: string) => string | null
  rename: (id: string, input: string) => string | null
  // The course code used to find a course's questions. Empty clears it.
  setCourseCode: (courseId: string, input: string) => string | null
  remove: (id: string) => void
}

type Editing =
  | { kind: "add-course" }
  | { kind: "add-year"; courseId: string }
  | { kind: "rename"; id: string; initial: string }
  | { kind: "course-code"; courseId: string; initial: string }

// The list is course, then year. A year is the note you write in.
export function NavCourses({
  tree,
  activeId,
  onOpen,
  actions,
}: {
  tree: PaperTree
  activeId: string | null
  onOpen: (yearId: string) => void
  actions: CourseActions
}) {
  const [editing, setEditing] = React.useState<Editing | null>(null)
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set())

  const toggle = (id: string) =>
    setCollapsed((s) => {
      const n = new Set(s)
      if (!n.delete(id)) n.add(id)
      return n
    })

  function submit(input: string): string | null {
    if (!editing) return null
    const error =
      editing.kind === "add-course"
        ? actions.addCourse(input)
        : editing.kind === "add-year"
          ? actions.addYear(editing.courseId, input)
          : editing.kind === "course-code"
            ? actions.setCourseCode(editing.courseId, input)
            : actions.rename(editing.id, input)
    if (error === null) setEditing(null)
    return error
  }

  const renameText = editing?.kind === "rename" ? editing.initial : ""
  const isRenaming = (id: string) =>
    editing?.kind === "rename" && editing.id === id
  const addingYearTo = (courseId: string) =>
    editing?.kind === "add-year" && editing.courseId === courseId
  const settingCode = (courseId: string) =>
    editing?.kind === "course-code" && editing.courseId === courseId
  const cancel = () => setEditing(null)

  // The row's buttons stay visible, because a tablet has no hover.
  const optionsMenu = (
    id: string,
    label: string,
    courseCode?: { initial: string }
  ) => (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size="icon-xs"
            variant="ghost"
            className="pointer-coarse:size-10 pointer-coarse:[&_svg]:size-5"
            aria-label={`Options for ${label}`}
          />
        }
      >
        <MoreHorizontalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => setEditing({ kind: "rename", id, initial: label })}
        >
          Rename
        </DropdownMenuItem>
        {courseCode && (
          <DropdownMenuItem
            onClick={() =>
              setEditing({
                kind: "course-code",
                courseId: id,
                initial: courseCode.initial,
              })
            }
          >
            Course code
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            if (window.confirm(`Delete ${label} and everything inside it?`))
              actions.remove(id)
          }}
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const row =
    "flex items-center gap-1 rounded-md py-0.5 pr-1 text-sm transition-colors hover:bg-foreground/10 active:bg-foreground/15 pointer-coarse:min-h-11"
  const rowMain =
    "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1 text-left"

  return (
    <SidebarGroup>
      <div className="flex items-center justify-between">
        <SidebarGroupLabel>Courses</SidebarGroupLabel>
        <Button
          size="icon-xs"
          variant="ghost"
          className="pointer-coarse:size-10 pointer-coarse:[&_svg]:size-5"
          aria-label="Add a course"
          title="Add a course"
          onClick={() => setEditing({ kind: "add-course" })}
        >
          <PlusIcon />
        </Button>
      </div>

      {editing?.kind === "add-course" && (
        <InlineForm
          placeholder="Course"
          submitLabel="Add"
          onSubmit={submit}
          onCancel={cancel}
        />
      )}

      {tree.length === 0 && editing?.kind !== "add-course" && (
        <p className="px-2 py-1 text-xs text-muted-foreground">
          No courses yet. Press + to add one.
        </p>
      )}

      {tree.map((course) => (
        <div key={course.id}>
          {isRenaming(course.id) ? (
            <InlineForm
              initial={renameText}
              submitLabel="Save"
              onSubmit={submit}
              onCancel={cancel}
            />
          ) : (
            <div className={row}>
              <button
                type="button"
                className={rowMain}
                onClick={() => toggle(course.id)}
                aria-expanded={!collapsed.has(course.id)}
              >
                <ChevronRightIcon
                  className={
                    "size-4 shrink-0 transition-transform " +
                    (collapsed.has(course.id) ? "" : "rotate-90")
                  }
                />
                <FolderIcon className="size-4 shrink-0" />
                {/* A long name wraps onto a second line instead of being cut off. */}
                <span className="min-w-0 break-words">
                  {course.code}
                  {course.courseCode && (
                    <span className="block text-xs text-muted-foreground">
                      {course.courseCode}
                    </span>
                  )}
                </span>
              </button>
              <Button
                size="icon-xs"
                variant="ghost"
                className="pointer-coarse:size-10 pointer-coarse:[&_svg]:size-5"
                aria-label="Add a note"
                title="Add a note"
                onClick={() => {
                  setCollapsed((s) => {
                    const n = new Set(s)
                    n.delete(course.id)
                    return n
                  })
                  setEditing({ kind: "add-year", courseId: course.id })
                }}
              >
                <PlusIcon />
              </Button>
              {optionsMenu(course.id, course.code, {
                initial: effectiveCourseCode(course) ?? "",
              })}
            </div>
          )}

          {settingCode(course.id) && (
            <InlineForm
              initial={editing?.kind === "course-code" ? editing.initial : ""}
              placeholder="Course code, like UECM2353"
              submitLabel="Save"
              allowEmpty
              onSubmit={submit}
              onCancel={cancel}
            />
          )}

          {!collapsed.has(course.id) && (
            <div className="ml-3 border-l pl-2">
              {addingYearTo(course.id) && (
                <InlineForm
                  placeholder="Note name"
                  submitLabel="Add"
                  onSubmit={submit}
                  onCancel={cancel}
                />
              )}
              {course.years.map((year) =>
                isRenaming(year.id) ? (
                  <InlineForm
                    key={year.id}
                    initial={renameText}
                    submitLabel="Save"
                    onSubmit={submit}
                    onCancel={cancel}
                  />
                ) : (
                  <div
                    key={year.id}
                    className={
                      row +
                      (year.id === activeId
                        ? " bg-foreground/10 font-medium"
                        : "")
                    }
                  >
                    <button
                      type="button"
                      className={rowMain}
                      onClick={() => onOpen(year.id)}
                    >
                      <FileTextIcon className="size-4 shrink-0" />
                      <span className="min-w-0 break-words">{year.year}</span>
                    </button>
                    {optionsMenu(year.id, year.year)}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      ))}
    </SidebarGroup>
  )
}

// A text box on its own line, with Add or Save and Cancel under it.
// Enter submits. Escape cancels.
function InlineForm({
  initial = "",
  placeholder,
  submitLabel,
  allowEmpty = false,
  onSubmit,
  onCancel,
}: {
  initial?: string
  placeholder?: string
  submitLabel: string
  allowEmpty?: boolean
  onSubmit: (input: string) => string | null
  onCancel: () => void
}) {
  const [value, setValue] = React.useState(initial)
  const [error, setError] = React.useState<string | null>(null)

  function go() {
    if (!allowEmpty && value.trim() === "") return
    setError(onSubmit(value))
  }

  return (
    <div className="flex flex-col gap-1 px-1 py-1">
      <Input
        autoFocus
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          setValue(e.target.value)
          setError(null)
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") go()
          if (e.key === "Escape") onCancel()
        }}
        className="h-8 pointer-coarse:h-10"
      />
      <div className="flex gap-1">
        <Button size="sm" className="flex-1 pointer-coarse:h-10" onClick={go}>
          {submitLabel}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="flex-1 pointer-coarse:h-10"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  )
}
