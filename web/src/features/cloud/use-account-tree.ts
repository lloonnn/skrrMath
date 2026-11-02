import * as React from "react"
import { mergeLocalIntoCloud, type PaperTree } from "@shared/index.ts"
import { uid } from "@/lib/uid"
import { fetchTree, insertCourse, insertYear } from "@/features/cloud/cloud"
import { uploadGuestWriting } from "@/features/cloud/upload-guest"

// The course and note list of a signed-in user. It lives in the account.
// On the first sign-in, the guest list in this browser is kept: whatever the
// account does not have yet is uploaded, then the browser copy is cleared.
export function useAccountTree(
  userId: string | null,
  localTree: PaperTree,
  clearLocal: () => void
) {
  const [state, setState] = React.useState<{
    userId: string
    tree: PaperTree
  } | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)

  // The latest guest list, for the sign-in upload.
  const localRef = React.useRef(localTree)
  React.useEffect(() => {
    localRef.current = localTree
  })

  const reload = React.useCallback(async () => {
    if (!userId) return
    try {
      const tree = await fetchTree()
      setState({ userId, tree })
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your notes.")
    }
  }, [userId])

  // Sign in: load the account, add the guest list, clear the browser copy.
  React.useEffect(() => {
    if (!userId) return
    let cancelled = false
    ;(async () => {
      try {
        const cloud = await fetchTree()
        const up = mergeLocalIntoCloud(cloud, localRef.current, uid)
        for (const c of up.newCourses) await insertCourse(c.id, c.name)
        for (const y of up.newYears) await insertYear(y.id, y.courseId, y.label)
        // Then the writing. A note that already had writing gets the guest copy as a new note.
        const w = await uploadGuestWriting(up.yearIdMap, up.merged)
        let tree = up.merged
        for (const c of w.copies)
          tree = tree.map((course) =>
            course.id === c.courseId
              ? {
                  ...course,
                  years: [...course.years, { id: c.id, year: c.label }],
                }
              : course
          )
        if (cancelled) return
        setState({ userId, tree })
        setError(null)
        if (w.copies.length)
          setNotice(
            `${w.copies.length} note(s) already had writing online. Your writing from this browser was kept as a new note.`
          )
        // If some writing could not be uploaded, keep the browser copy so a later
        // sign-in can try again.
        if (w.failed === 0) clearLocal()
        else
          setError(
            `${w.failed} note(s) of writing could not be uploaded and stay in this browser. Sign out and in to try again.`
          )
      } catch (e) {
        if (!cancelled)
          setError(
            e instanceof Error ? e.message : "Could not load your notes."
          )
      }
    })()
    return () => {
      cancelled = true
    }
    // clearLocal is stable enough: it only clears this browser's copy.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // Pick up changes made on another device when you come back to this tab.
  React.useEffect(() => {
    if (!userId) return
    const onShow = () => {
      if (document.visibilityState === "visible") void reload()
    }
    document.addEventListener("visibilitychange", onShow)
    return () => document.removeEventListener("visibilitychange", onShow)
  }, [userId, reload])

  const ready = userId !== null && state?.userId === userId
  return {
    ready,
    tree: ready ? state!.tree : null,
    setTree: (tree: PaperTree) => userId && setState({ userId, tree }),
    error,
    notice,
    clearError: () => {
      setError(null)
      setNotice(null)
    },
    reload,
  }
}
