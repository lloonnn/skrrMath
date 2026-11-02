// In memory, per user, fixed one-minute window. Resets when the service restarts.
export function createRateLimiter(perMinute: number, now: () => number = Date.now) {
  const hits = new Map<string, { start: number; count: number }>()
  return {
    allow(userId: string): boolean {
      const t = now()
      const h = hits.get(userId)
      if (!h || t - h.start >= 60_000) {
        hits.set(userId, { start: t, count: 1 })
        return true
      }
      if (h.count >= perMinute) return false
      h.count++
      return true
    },
  }
}
