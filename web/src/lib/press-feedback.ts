// A touch screen has no hover, and :active is not reliable on every tablet.
// So the pressed button gets a data-pressed mark while a finger or pen is down,
// and a style in index.css shows it. A mouse is left alone, it has real hover.
// The mark stays for at least 150 ms, so a quick tap still flashes.
const MIN_MS = 150

export function installPressFeedback() {
  const down = new Map<number, { el: Element; at: number }>()

  const release = (e: PointerEvent) => {
    const hit = down.get(e.pointerId)
    if (!hit) return
    down.delete(e.pointerId)
    const wait = Math.max(0, MIN_MS - (performance.now() - hit.at))
    setTimeout(() => hit.el.removeAttribute("data-pressed"), wait)
  }

  document.addEventListener(
    "pointerdown",
    (e) => {
      if (e.pointerType === "mouse") return
      const el = (e.target as Element | null)?.closest(
        "button, [role='menuitem'], [role='button']"
      )
      if (!el || (el as HTMLButtonElement).disabled) return
      el.setAttribute("data-pressed", "")
      down.set(e.pointerId, { el, at: performance.now() })
    },
    { passive: true }
  )
  document.addEventListener("pointerup", release, { passive: true })
  document.addEventListener("pointercancel", release, { passive: true })
}
