import type { AddressInfo } from "node:net"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ConfigError, loadConfig } from "./config.ts"
import { createDevVerifier } from "./middleware/auth.ts"
import { createDemoEngine } from "./providers/demo.ts"
import { buildServer, engineFromConfig } from "./server.ts"
import type { Config } from "./config.ts"

const baseEnv = { AI_PROVIDER: "demo", MARK_DEV_TOKEN: "t" }
const img = { mimeType: "image/png", base64: "AAAA" }
const body = { blockImage: img, answerImage: img, tags: { course: "MATH101", question: "1" } }

describe("loadConfig", () => {
  it("accepts demo without a key", () => expect(loadConfig(baseEnv).provider).toBe("demo"))
  it("fails for google without a key", () =>
    expect(() => loadConfig({ ...baseEnv, AI_PROVIDER: "google", GEMINI_MODEL: "m" })).toThrow(/GEMINI_API_KEY/))
  it("fails for google without a model", () =>
    expect(() => loadConfig({ ...baseEnv, AI_PROVIDER: "google", GEMINI_API_KEY: "k" })).toThrow(/GEMINI_MODEL/))
  it("fails for an unknown provider", () =>
    expect(() => loadConfig({ ...baseEnv, AI_PROVIDER: "gpt" })).toThrow(ConfigError))
  it("fails for replit without the integration variables", () =>
    expect(() => loadConfig({ ...baseEnv, AI_PROVIDER: "replit", GEMINI_MODEL: "m" })).toThrow(/AI_INTEGRATIONS_GEMINI_BASE_URL/))
  it("fails for replit without a model", () =>
    expect(() =>
      loadConfig({ ...baseEnv, AI_PROVIDER: "replit", AI_INTEGRATIONS_GEMINI_BASE_URL: "u", AI_INTEGRATIONS_GEMINI_API_KEY: "k" })
    ).toThrow(/GEMINI_MODEL/))
  it("accepts replit with the integration variables and a model", () =>
    expect(
      loadConfig({ ...baseEnv, AI_PROVIDER: "replit", GEMINI_MODEL: "m", AI_INTEGRATIONS_GEMINI_BASE_URL: "u", AI_INTEGRATIONS_GEMINI_API_KEY: "k" }).provider
    ).toBe("replit"))
  it("needs a dev token", () => expect(() => loadConfig({ AI_PROVIDER: "demo" })).toThrow(/MARK_DEV_TOKEN/))
  it("rejects a bad number", () =>
    expect(() => loadConfig({ ...baseEnv, MARK_SOLVE_RUNS: "0" })).toThrow(/MARK_SOLVE_RUNS/))
})

describe("demo provider", () => {
  afterEach(() => vi.unstubAllGlobals())
  it("returns the fixture and makes no network call", async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)
    const engine = engineFromConfig(loadConfig(baseEnv))
    const r = await engine.mark(body as never)
    expect(r.model).toBe("demo")
    expect(r.reference_source).toBe("verified_user")
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

// A real server on a free port, with the demo engine behind it.
async function start(over: Partial<Config> = {}, clock?: { t: number }) {
  const config = { ...loadConfig(baseEnv), ...over }
  const verify = async (tok: string) => (tok.startsWith("user-") ? { userId: tok } : null)
  const server = buildServer({ config, engine: createDemoEngine(), verify, now: clock && (() => clock.t) })
  await new Promise<void>((r) => server.listen(0, r))
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/mark`
  const post = (o: { token?: string; type?: string; raw?: string; json?: unknown } = {}) =>
    fetch(url, {
      method: "POST",
      headers: {
        ...(o.token ? { authorization: `Bearer ${o.token}` } : {}),
        "content-type": o.type ?? "application/json",
      },
      body: o.raw ?? JSON.stringify(o.json ?? body),
    })
  return { server, post, url }
}

describe("POST /api/mark", () => {
  const servers: { close(): void }[] = []
  afterEach(() => servers.splice(0).forEach((s) => s.close()))
  const open = async (...a: Parameters<typeof start>) => {
    const s = await start(...a)
    servers.push(s.server)
    return s
  }

  it("401 without a token", async () => expect((await (await open()).post()).status).toBe(401))
  it("401 with a bad token", async () => expect((await (await open()).post({ token: "nope" })).status).toBe(401))
  it("200 with a good token", async () => expect((await (await open()).post({ token: "user-a" })).status).toBe(200))
  it("415 for a non-JSON body", async () =>
    expect((await (await open()).post({ token: "user-a", type: "text/plain" })).status).toBe(415))
  it("400 for broken JSON", async () =>
    expect((await (await open()).post({ token: "user-a", raw: "{" })).status).toBe(400))
  it("422 for a wrong file type", async () => {
    const bad = { ...body, blockImage: { mimeType: "application/pdf", base64: "AAAA" } }
    expect((await (await open()).post({ token: "user-a", json: bad })).status).toBe(422)
  })
  it("413 for an oversize body", async () =>
    expect((await (await open({ maxBodyBytes: 100 })).post({ token: "user-a" })).status).toBe(413))
  it("404 for another path", async () => {
    const { url } = await open()
    expect((await fetch(url.replace("/api/mark", "/other"), { method: "POST" })).status).toBe(404)
  })

  it("429 over the limit, other users unaffected, window resets", async () => {
    const clock = { t: 1_000_000 }
    const s = await start({ ratePerMinute: 2 }, clock)
    servers.push(s.server)
    expect((await s.post({ token: "user-a" })).status).toBe(200)
    expect((await s.post({ token: "user-a" })).status).toBe(200)
    expect((await s.post({ token: "user-a" })).status).toBe(429)
    expect((await s.post({ token: "user-b" })).status).toBe(200)
    clock.t += 61_000
    expect((await s.post({ token: "user-a" })).status).toBe(200)
  })
})

describe("dev verifier", () => {
  it("accepts only the exact token", async () => {
    const v = createDevVerifier("secret-token")
    expect(await v("secret-token")).toEqual({ userId: "dev" })
    expect(await v("secret-tokeN")).toBeNull()
    expect(await v("short")).toBeNull()
  })
})
