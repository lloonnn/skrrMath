import { createClient } from "@supabase/supabase-js"

// null when the two values are not in .env. The app still works as a guest.
export const supabase =
  __SUPABASE_URL__ && __SUPABASE_ANON_KEY__
    ? createClient(__SUPABASE_URL__, __SUPABASE_ANON_KEY__)
    : null
