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
