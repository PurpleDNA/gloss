import { sseEvents } from "../lib/sse";
import { ProviderError, type Adapter } from "./types";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Google's native format. Deliberately not routed through their OpenAI
 * compatibility shim — that layer lags behind the real API, and this is 40 lines.
 */
export const streamGemini: Adapter = async function* (messages, opts) {
  const res = await fetch(
    `${BASE}/${encodeURIComponent(opts.model)}:streamGenerateContent?alt=sse`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": opts.apiKey,
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: opts.system }] },
        contents: messages.map((m) => ({
          // Gemini calls the assistant "model".
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: { maxOutputTokens: opts.maxTokens },
      }),
      signal: opts.signal,
    },
  );

  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error?.message) detail = body.error.message;
    } catch {
      /* non-JSON error body */
    }
    throw new ProviderError(detail, res.status);
  }

  for await (const ev of sseEvents(res)) {
    let parsed: any;
    try {
      parsed = JSON.parse(ev.data);
    } catch {
      continue;
    }
    if (parsed.error?.message) throw new ProviderError(parsed.error.message);
    for (const part of parsed.candidates?.[0]?.content?.parts ?? []) {
      if (typeof part.text === "string" && part.text) yield part.text;
    }
  }
};
