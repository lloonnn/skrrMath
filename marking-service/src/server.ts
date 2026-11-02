import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http"
import { ConfigError, loadConfig, type Config } from "./config.ts"
import { bearerToken, createDevVerifier, type Verifier } from "./middleware/auth.ts"
import { createRateLimiter } from "./middleware/rate-limit.ts"
import { createModelEngine } from "./pipeline/mark.ts"
import { createDemoEngine } from "./providers/demo.ts"
import { createGoogleClient } from "./providers/google.ts"
import { ModelUnavailableError } from "./providers/types.ts"
import { markRequestSchema, type Engine } from "./types.ts"

export type Deps = { config: Config; engine: Engine; verify: Verifier; now?: () => number }

class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function readBody(req: IncomingMessage, max: number): Promise<string> {
  const declared = Number(req.headers["content-length"] ?? 0)
  if (declared > max) throw new HttpError(413, "request too large")
  const chunks: Buffer[] = []
  let size = 0
  for await (const c of req) {
    size += (c as Buffer).length
    if (size > max) throw new HttpError(413, "request too large")
    chunks.push(c as Buffer)
  }
  return Buffer.concat(chunks).toString("utf8")
}

export function buildServer({ config, engine, verify, now }: Deps): Server {
  const limiter = createRateLimiter(config.ratePerMinute, now)

  const send = (res: ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, {
      "content-type": "application/json",
      "access-control-allow-origin": config.allowedOrigin,
      "access-control-allow-headers": "authorization, content-type",
      "access-control-allow-methods": "POST, OPTIONS",
    })
    res.end(JSON.stringify(body))
  }

  return createServer(async (req, res) => {
    try {
      if (req.method === "OPTIONS") return send(res, 204, {})
      if (req.url !== "/api/mark") throw new HttpError(404, "not found")
      if (req.method !== "POST") throw new HttpError(405, "use POST")

      const token = bearerToken(req.headers.authorization)
      const user = token ? await verify(token) : null
      if (!user) throw new HttpError(401, "sign in first")

      if (!(req.headers["content-type"] ?? "").startsWith("application/json"))
        throw new HttpError(415, "send application/json")

      if (!limiter.allow(user.userId)) throw new HttpError(429, "too many markings, wait a minute")

      let json: unknown
      try {
        json = JSON.parse(await readBody(req, config.maxBodyBytes))
      } catch (e) {
        if (e instanceof HttpError) throw e
        throw new HttpError(400, "body is not valid JSON")
      }
      const parsed = markRequestSchema.safeParse(json)
      if (!parsed.success) throw new HttpError(422, "request has the wrong shape or file type")

      send(res, 200, await engine.mark(parsed.data))
    } catch (e) {
      if (e instanceof HttpError) return send(res, e.status, { error: e.message })
      if (e instanceof ModelUnavailableError) {
        console.error("model unavailable:", e.status)
        return send(res, 502, { error: e.message })
      }
      // Never log request bodies or keys.
      console.error("mark failed:", e instanceof Error ? e.name : "unknown error")
      send(res, 500, { error: "marking failed" })
    }
  })
}

export function engineFromConfig(config: Config): Engine {
  if (config.provider === "demo") return createDemoEngine()
  // loadConfig already checked the keys and the model.
  const client =
    config.provider === "replit"
      ? createGoogleClient(config.replitKey!, config.geminiModel!, { baseUrl: config.replitBaseUrl!, apiVersion: "" })
      : createGoogleClient(config.geminiApiKey!, config.geminiModel!)
  return createModelEngine(client, {
    solveRuns: config.solveRuns,
    model: config.geminiModel!,
  })
}

// Run only when started directly.
if (import.meta.filename === process.argv[1]) {
  try {
    const config = loadConfig(process.env)
    buildServer({
      config,
      engine: engineFromConfig(config),
      verify: createDevVerifier(config.devToken!),
    }).listen(config.port, () => console.log(`marking-service on :${config.port} (provider ${config.provider})`))
  } catch (e) {
    if (e instanceof ConfigError) {
      console.error(`Config error: ${e.message}`)
      process.exit(1)
    }
    throw e
  }
}
