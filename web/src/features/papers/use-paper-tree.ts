import * as React from "react"
import { readTree, type PaperTree } from "@shared/index.ts"

const KEY = "skrrmath-papers"

// The list is kept in this browser only for now. It does not sync between the
// tablet and the laptop until sign-in and cloud save exist.
// Storage can be missing or full, so every access is guarded.
function load(): PaperTree {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? readTree(JSON.parse(raw)) : []
  } catch {
    return []
  }
}

export function usePaperTree(): [PaperTree, (tree: PaperTree) => void] {
  const [tree, setTree] = React.useState<PaperTree>(load)
  const update = (next: PaperTree) => {
    setTree(next)
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      // not saved this time
    }
  }
  return [tree, update]
}
