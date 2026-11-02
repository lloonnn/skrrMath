import { timingSafeEqual } from "node:crypto"

export type Verifier = (token: string) => Promise<{ userId: string } | null>

// Dev only: one shared token, one user. The Supabase check replaces this later.
export function createDevVerifier(expected: string): Verifier {
  const want = Buffer.from(expected)
  return async (token) => {
    const got = Buffer.from(token)
    return got.length === want.length && timingSafeEqual(got, want) ? { userId: "dev" } : null
  }
}

export function bearerToken(header: string | undefined): string | null {
  const m = /^Bearer (.+)$/.exec(header ?? "")
  return m ? m[1] : null
}

// The real check: ask Supabase who this token belongs to. Fails closed: any problem
// (bad token, expired token, Supabase unreachable) means "not signed in".
// The answer is remembered for a minute, so one marking does not ask many times.
export function createSupabaseVerifier(
  url: string,
  anonKey: string,
  fetchFn: typeof fetch = fetch,
  now: () => number = Date.now
): Verifier {
  const seen = new Map<string, { userId: string; until: number }>()
  return async (token) => {
    const hit = seen.get(token)
    if (hit && hit.until > now()) return { userId: hit.userId }
    try {
      const res = await fetchFn(`${url.replace(/\/$/, "")}/auth/v1/user`, {
        headers: { apikey: anonKey, authorization: `Bearer ${token}` },
      })
      if (!res.ok) return null
      const body = (await res.json()) as { id?: unknown }
      if (typeof body.id !== "string" || body.id === "") return null
      if (seen.size > 500) seen.clear()
      seen.set(token, { userId: body.id, until: now() + 60_000 })
      return { userId: body.id }
    } catch {
      return null
    }
  }
}
