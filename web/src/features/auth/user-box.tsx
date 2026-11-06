import * as React from "react"
import type { Session } from "@supabase/supabase-js"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabase"

// The bottom of the left panel. A guest sees "Sign in". Signed in shows the real
// account and "Sign out". Cloud save comes next. For now the list stays in this browser.
export function UserBox({
  session,
  onOpenLecturer,
}: {
  session: Session | null
  onOpenLecturer: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [message, setMessage] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  if (!supabase) {
    return (
      <p className="px-2 py-2 text-xs text-muted-foreground">
        Guest. Your notes stay in this browser.
      </p>
    )
  }

  if (session) {
    return (
      <div className="flex flex-col gap-1 px-2 py-2">
        <p className="truncate text-sm font-medium">{session.user.email}</p>
        <Button size="sm" variant="outline" onClick={onOpenLecturer}>
          Lecturer
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => supabase!.auth.signOut()}
        >
          Sign out
        </Button>
      </div>
    )
  }

  async function google() {
    setMessage(null)
    const { error } = await supabase!.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    })
    if (error) setMessage(error.message)
  }

  async function withPassword(create: boolean) {
    if (!email.trim() || !password) {
      setMessage("Type your email and password.")
      return
    }
    setBusy(true)
    setMessage(null)
    const creds = { email: email.trim(), password }
    const { data, error } = create
      ? await supabase!.auth.signUp({
          ...creds,
          // The confirmation link comes back to the address you are using now (laptop or
          // tablet). That address must also be listed under Redirect URLs in Supabase.
          options: { emailRedirectTo: window.location.origin },
        })
      : await supabase!.auth.signInWithPassword(creds)
    setBusy(false)
    if (error) setMessage(error.message)
    else if (create && !data.session)
      setMessage("Check your email to confirm, then sign in.")
  }

  if (!open) {
    return (
      <div className="flex flex-col gap-1 px-2 py-2">
        <p className="text-center text-xs text-muted-foreground">
          Sign in to save them online.
        </p>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          Sign in
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 px-2 py-2">
      <Button size="sm" onClick={google}>
        Continue with Google
      </Button>
      <p className="text-center text-xs text-muted-foreground">or</p>
      <Input
        type="email"
        autoComplete="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Input
        type="password"
        autoComplete="current-password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && withPassword(false)}
      />
      <div className="flex gap-1">
        <Button
          size="sm"
          className="flex-1"
          disabled={busy}
          onClick={() => withPassword(false)}
        >
          Sign in
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          disabled={busy}
          onClick={() => withPassword(true)}
        >
          Create account
        </Button>
      </div>
      {message && <p className="text-xs text-red-700">{message}</p>}
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </div>
  )
}
