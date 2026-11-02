import { GoogleGenAI, ThinkingLevel } from "@google/genai"
import type { ModelCall, ModelClient } from "./types.ts"

// Two ways in, same SDK. google: a Google AI Studio key. replit: the base URL and
// key that Replit injects for its Gemini integration (reported by Replit Agent,
// not checked by us against Replit's docs).
export function createGoogleClient(
  apiKey: string,
  model: string,
  httpOptions?: { baseUrl: string; apiVersion: string }
): ModelClient {
  const ai = new GoogleGenAI({ apiKey, ...(httpOptions ? { httpOptions } : {}) })
  return {
    async generate(call: ModelCall) {
      const parts = [
        ...call.images.map((i) => ({ inlineData: { mimeType: i.mimeType, data: i.base64 } })),
        { text: call.prompt },
      ]
      const res = await ai.models.generateContent({
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
      return res.text ?? ""
    },
  }
}
