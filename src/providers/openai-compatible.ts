import { sseEvents } from "../lib/sse";
import { ProviderError, type Adapter } from "./types";

/**
 * One adapter for every service that speaks the OpenAI chat-completions wire
 * format: OpenAI, OpenRouter, Groq, DeepSeek, Together, and a local Ollama.
 * Adding one of those is a registry entry, not a new file.
 */
export function openAICompatible(baseUrl: string, extraHeaders: Record<string, string> = {}): Adapter {
  return async function* (messages, opts) {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${opts.apiKey}`,
        ...extraHeaders,
      },
      body: JSON.stringify({
        model: opts.model,
        messages: [{ role: "system", content: opts.system }, ...messages],
        max_tokens: opts.maxTokens,
        stream: true,
      }),
      signal: opts.signal,
    });

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
      if (ev.data === "[DONE]") return;
      let parsed: any;
      try {
        parsed = JSON.parse(ev.data);
      } catch {
        continue; // keep-alive comments and padding
      }
      if (parsed.error?.message) throw new ProviderError(parsed.error.message);
      const delta = parsed.choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta) yield delta;
    }
  };
}
