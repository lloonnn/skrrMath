import { GoogleGenAI, ThinkingLevel } from "@google/genai"
import { ModelUnavailableError, type ModelCall, type ModelClient } from "./types.ts"

// Two ways in, same SDK. google: a Google AI Studio key. replit: the base URL and
// key that Replit injects for its Gemini integration (reported by Replit Agent,
// not checked by us against Replit's docs).
export function createGoogleClient(
  apiKey: string,
  model: string,
  httpOptions?: { baseUrl: string; apiVersion: string }
): ModelClient {
  // Each model call is stopped after 90 s, so a hang cannot hold a request forever.
  const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: 90_000, ...(httpOptions ?? {}) } })
  return {
    async generate(call: ModelCall) {
      const parts = [
        ...call.images.map((i) => ({ inlineData: { mimeType: i.mimeType, data: i.base64 } })),
        { text: call.prompt },
      ]
      let res
      try {
        res = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts }],
        config: {
          systemInstruction: call.system,
          responseMimeType: "application/json",
          thinkingConfig: {
            thinkingLevel: call.thinking === "low" ? ThinkingLevel.LOW : ThinkingLevel.HIGH,
          },
        },
      })
      } catch (e) {
        const status = (e as { status?: number }).status
        if (status === 429 || status === 401 || status === 403 || status === 404)
          throw new ModelUnavailableError(status, `model call refused (${status}): check quota, key and model name`)
        if (status === 503)
          throw new ModelUnavailableError(status, "the model is busy (503): try again in a minute")
        if (/abort|timeout|timed out/i.test(`${(e as Error).name} ${(e as Error).message}`))
          throw new ModelUnavailableError(504, "the model took too long (over 90 s): try again")
        throw e
      }
      return res.text ?? ""
    },
  }
}
