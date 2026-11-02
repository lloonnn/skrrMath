// Reads settings from an env object. Fails at start with a clear message.
// No model name is written here. GEMINI_MODEL is the one place.

export type Config = {
  provider: "demo" | "google" | "replit"
  geminiApiKey: string | null
  geminiModel: string | null
  replitBaseUrl: string | null
  replitKey: string | null
  solveRuns: number
  auth: "dev" | "supabase"
  devToken: string | null
  supabaseUrl: string | null
  supabaseAnonKey: string | null
  allowedOrigin: string
  ratePerMinute: number
  maxBodyBytes: number
  port: number
}

export class ConfigError extends Error {}

function int(env: Record<string, string | undefined>, key: string, dflt: number): number {
  const raw = env[key]
  if (raw === undefined || raw === "") return dflt
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1) throw new ConfigError(`${key} must be a whole number of 1 or more`)
  return n
}

export function loadConfig(env: Record<string, string | undefined>): Config {
  const provider = env.AI_PROVIDER || "google"
  if (provider !== "demo" && provider !== "google" && provider !== "replit")
    throw new ConfigError(`AI_PROVIDER must be demo, google or replit (got "${provider}")`)

  if (provider === "google") {
    if (!env.GEMINI_API_KEY) throw new ConfigError("AI_PROVIDER=google needs GEMINI_API_KEY (a Google AI Studio key)")
    if (!env.GEMINI_MODEL) throw new ConfigError("AI_PROVIDER=google needs GEMINI_MODEL (the model name is one setting)")
  }
  if (provider === "replit") {
    if (!env.AI_INTEGRATIONS_GEMINI_BASE_URL || !env.AI_INTEGRATIONS_GEMINI_API_KEY)
      throw new ConfigError(
        "AI_PROVIDER=replit needs AI_INTEGRATIONS_GEMINI_BASE_URL and AI_INTEGRATIONS_GEMINI_API_KEY. Replit sets them when the Gemini integration is added to this Replit app."
      )
    if (!env.GEMINI_MODEL) throw new ConfigError("AI_PROVIDER=replit needs GEMINI_MODEL (the model name is one setting)")
  }

  const auth = env.MARK_AUTH || "dev"
  if (auth !== "dev" && auth !== "supabase") throw new ConfigError(`MARK_AUTH must be dev or supabase (got "${auth}")`)
  if (auth === "supabase" && (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY))
    throw new ConfigError("MARK_AUTH=supabase needs SUPABASE_URL and SUPABASE_ANON_KEY")
  if (auth === "dev" && !env.MARK_DEV_TOKEN) throw new ConfigError("MARK_AUTH=dev needs MARK_DEV_TOKEN (any long random string)")

  return {
    provider,
    geminiApiKey: env.GEMINI_API_KEY || null,
    geminiModel: env.GEMINI_MODEL || null,
    replitBaseUrl: env.AI_INTEGRATIONS_GEMINI_BASE_URL || null,
    replitKey: env.AI_INTEGRATIONS_GEMINI_API_KEY || null,
    solveRuns: int(env, "MARK_SOLVE_RUNS", 2),
    auth,
    devToken: env.MARK_DEV_TOKEN || null,
    supabaseUrl: env.SUPABASE_URL || null,
    supabaseAnonKey: env.SUPABASE_ANON_KEY || null,
    allowedOrigin: env.APP_URL || "http://localhost:5173",
    ratePerMinute: int(env, "MARK_RATE_PER_MIN", 10),
    maxBodyBytes: int(env, "MARK_MAX_BODY_BYTES", 8_000_000),
    port: int(env, "PORT", 3001),
  }
}
