import { sseEvents } from "../lib/sse";
import { ProviderError, type Adapter } from "./types";

export const streamAnthropic: Adapter = async function* (messages, opts) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": opts.apiKey,
      "anthropic-version": "2023-06-01",
      // Without this the API rejects browser-origin requests outright.
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens,
      system: opts.system,
      messages,
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
    if (ev.event === "content_block_delta") {
      const parsed = JSON.parse(ev.data);
      if (parsed.delta?.type === "text_delta") yield parsed.delta.text as string;
    } else if (ev.event === "error") {
      const parsed = JSON.parse(ev.data);
      throw new ProviderError(parsed.error?.message ?? "Stream error");
    }
  }
};
