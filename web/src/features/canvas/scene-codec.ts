import type { Scene } from "@/features/canvas/note-canvas"
import { marksSignature, readMarks } from "@/features/marking/saved-marks"
import {
  readReferences,
  referencesSignature,
} from "@/features/marking/reference"
import { labelsSignature, readLabels } from "@/features/marking/labels"

// What is stored for a note (in the account or in this browser): the live elements
// and the images they use. Never the view (zoom, scroll).
export type Stored = {
  elements: unknown[]
  files: unknown
  marks?: unknown
  references?: unknown
  labels?: unknown
}

export function toStored(scene: Scene): Stored {
  const stored: Stored = {
    elements: scene.elements.filter((e) => !e.isDeleted),
    files: scene.files,
  }
  if (scene.marks && Object.keys(scene.marks).length > 0)
    stored.marks = scene.marks
  if (scene.references && Object.keys(scene.references).length > 0)
    stored.references = scene.references
  if (scene.labels && Object.keys(scene.labels).length > 0)
    stored.labels = scene.labels
  return stored
}

// Stored data is untrusted: it may be old, cut short, or edited by hand.
export function fromStored(data: unknown): Scene | undefined {
  const s = data as {
    elements?: unknown
    files?: unknown
    marks?: unknown
    references?: unknown
    labels?: unknown
  } | null
  if (!s || !Array.isArray(s.elements)) return undefined
  return {
    elements: s.elements as Scene["elements"],
    files: (s.files ?? {}) as Scene["files"],
    marks: readMarks(s.marks),
    references: readReferences(s.references),
    labels: readLabels(s.labels),
  }
}

// Changes only when something on the canvas changed. Excalidraw reports on every
// pan and zoom too, and once when it loads. This keeps those from saving.
export const signature = (scene: Scene) =>
  scene.elements.map((e) => `${e.id}:${e.version}`).join(",") +
  "#" +
  marksSignature(scene.marks) +
  "#" +
  referencesSignature(scene.references) +
  "#" +
  labelsSignature(scene.labels)
