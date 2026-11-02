import * as React from "react"
import type { Session } from "@supabase/supabase-js"

import { supabase } from "@/lib/supabase"

// The signed-in session, or null for a guest. Updates when you sign in or out.
export function useSession(): Session | null {
  const [session, setSession] = React.useState<Session | null>(null)
  React.useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) =>
      setSession(s)
    )
    return () => data.subscription.unsubscribe()
  }, [])
  return session
}
