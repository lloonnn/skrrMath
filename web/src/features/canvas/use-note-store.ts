import * as React from "react"

import type { Scene } from "@/features/canvas/note-canvas"
import { signature } from "@/features/canvas/scene-codec"

export type SaveStatus = "idle" | "waiting" | "saving" | "saved" | "error"

// Where a note's writing lives. A guest: this browser. A signed-in user: the account.
export type NoteStorage = {
  // "token" carries anything the storage needs back on save (the account's page id).
  load: (
    noteId: string
  ) => Promise<{ scene: Scene | undefined; token?: string }>
  save: (noteId: string, scene: Scene, token?: string) => Promise<void>
  delayMs: number
}

type Loaded = { noteId: string; token?: string; initial: Scene | undefined }

// Opens a note, and saves changes a short time after you stop writing. Latest save
// wins: there is no merge. When you leave a note, an unsaved change is saved first.
// Pass enabled = false to switch it off (for example while sign-in is loading).
export function useNoteStore(
  storage: NoteStorage,
  enabled: boolean,
  noteId: string | null
) {
  const [loaded, setLoaded] = React.useState<Loaded | null>(null)
  const [status, setStatus] = React.useState<SaveStatus>("idle")
  const [error, setError] = React.useState<string | null>(null)

  const pending = React.useRef<{
    noteId: string
    token?: string
    scene: Scene
  } | null>(null)
  const timer = React.useRef<number | undefined>(undefined)
  const savedSig = React.useRef("")

  const flush = React.useCallback(async () => {
    window.clearTimeout(timer.current)
    const p = pending.current
    if (!p) return
    pending.current = null
    setStatus("saving")
    try {
      await storage.save(p.noteId, p.scene, p.token)
      savedSig.current = signature(p.scene)
      setStatus("saved")
      setError(null)
    } catch (e) {
      setStatus("error")
      setError(e instanceof Error ? e.message : "Could not save.")
    }
  }, [storage])

  React.useEffect(() => {
    if (!enabled || !noteId) return
    let cancelled = false
    storage
      .load(noteId)
      .then(({ scene, token }) => {
        if (cancelled) return
        savedSig.current = scene ? signature(scene) : ""
        setLoaded({ noteId, token, initial: scene })
        setStatus("idle")
        setError(null)
      })
      .catch((e) => {
        if (cancelled) return
        setStatus("error")
        setError(e instanceof Error ? e.message : "Could not open this note.")
      })
    return () => {
      cancelled = true
      void flush()
    }
  }, [storage, enabled, noteId, flush])

  // Leaving the tab: save now.
  React.useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush()
    }
    document.addEventListener("visibilitychange", onHide)
    return () => document.removeEventListener("visibilitychange", onHide)
  }, [flush])

  const ready = enabled && loaded !== null && loaded.noteId === noteId

  function onScene(scene: Scene) {
    if (!ready || !loaded) return
    if (signature(scene) === savedSig.current && !pending.current) return
    pending.current = { noteId: loaded.noteId, token: loaded.token, scene }
    setStatus("waiting")
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void flush(), storage.delayMs)
  }

  return {
    ready,
    initial: ready ? loaded.initial : undefined,
    status,
    error,
    onScene,
  }
}
