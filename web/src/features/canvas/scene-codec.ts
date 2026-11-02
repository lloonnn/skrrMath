import type { Scene } from "@/features/canvas/note-canvas"

// What is stored for a note (in the account or in this browser): the live elements
// and the images they use. Never the view (zoom, scroll).
export type Stored = { elements: unknown[]; files: unknown }

export function toStored(scene: Scene): Stored {
  return {
    elements: scene.elements.filter((e) => !e.isDeleted),
    files: scene.files,
  }
}

// Stored data is untrusted: it may be old, cut short, or edited by hand.
export function fromStored(data: unknown): Scene | undefined {
  const s = data as { elements?: unknown; files?: unknown } | null
  if (!s || !Array.isArray(s.elements)) return undefined
  return {
    elements: s.elements as Scene["elements"],
    files: (s.files ?? {}) as Scene["files"],
  }
}

// Changes only when something on the canvas changed. Excalidraw reports on every
// pan and zoom too, and once when it loads. This keeps those from saving.
export const signature = (scene: Scene) =>
  scene.elements.map((e) => `${e.id}:${e.version}`).join(",")
