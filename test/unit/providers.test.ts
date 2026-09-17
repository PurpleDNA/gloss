import { beforeEach, describe, expect, it, vi } from "vitest";
import { streamAnthropic } from "../../src/providers/anthropic";
import { streamGemini } from "../../src/providers/gemini";
import { openAICompatible } from "../../src/providers/openai-compatible";
import { ProviderError, type ChatMessage } from "../../src/providers/types";
import { drain, sseResponse } from "../support/sse-response";

const messages: ChatMessage[] = [{ role: "user", content: "what is entropy" }];
const opts = {
  apiKey: "test-key",
  model: "test-model",
  system: "You are Gloss.",
  maxTokens: 2048,
  signal: new AbortController().signal,
};

let fetchMock: ReturnType<typeof vi.fn>;
const lastCall = () => ({
  url: fetchMock.mock.calls[0][0] as string,
  init: fetchMock.mock.calls[0][1] as RequestInit,
  body: JSON.parse(fetchMock.mock.calls[0][1].body as string),
  headers: fetchMock.mock.calls[0][1].headers as Record<string, string>,
});

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

describe("Anthropic adapter", () => {
  const frames = [
    'event: content_block_delta\ndata: {"delta":{"type":"text_delta","text":"Entropy "}}\n\n',
    'event: content_block_delta\ndata: {"delta":{"type":"text_delta","text":"is disorder."}}\n\n',
    "event: message_stop\ndata: {}\n\n",
  ];

  it("sends the documented request shape", async () => {
    fetchMock.mockResolvedValue(sseResponse(frames));
    await drain(streamAnthropic(messages, opts));
    const { url, body, headers, init } = lastCall();

    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(headers["x-api-key"]).toBe("test-key");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    // Without this header the API rejects every browser-origin request.
    expect(headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
    expect(body).toMatchObject({ model: "test-model", max_tokens: 2048, stream: true });
    // Anthropic takes the system prompt top-level, not as a message.
    expect(body.system).toBe("You are Gloss.");
    expect(body.messages).toEqual(messages);
    expect(init.signal).toBe(opts.signal);
  });

  it("streams text deltas and ignores other event types", async () => {
    fetchMock.mockResolvedValue(sseResponse(frames));
    expect(await drain(streamAnthropic(messages, opts))).toBe("Entropy is disorder.");
  });

  it("ignores non-text deltas such as thinking blocks", async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        'event: content_block_delta\ndata: {"delta":{"type":"thinking_delta","thinking":"hmm"}}\n\n',
        'event: content_block_delta\ndata: {"delta":{"type":"text_delta","text":"answer"}}\n\n',
      ]),
    );
    expect(await drain(streamAnthropic(messages, opts))).toBe("answer");
  });

  it("surfaces the API's own error message, with its status", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "credit balance is too low" } }), {
        status: 400,
        statusText: "Bad Request",
      }),
    );
    const err = await drain(streamAnthropic(messages, opts)).catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.message).toBe("credit balance is too low");
    expect(err.status).toBe(400);
  });

  it("falls back to the status line when the error body is not JSON", async () => {
    fetchMock.mockResolvedValue(new Response("<html>gateway</html>", { status: 502, statusText: "Bad Gateway" }));
    await expect(drain(streamAnthropic(messages, opts))).rejects.toThrow("502 Bad Gateway");
  });

  it("throws on a mid-stream error event", async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        'event: content_block_delta\ndata: {"delta":{"type":"text_delta","text":"partial"}}\n\n',
        'event: error\ndata: {"error":{"message":"overloaded"}}\n\n',
      ]),
    );
    await expect(drain(streamAnthropic(messages, opts))).rejects.toThrow("overloaded");
  });
});

describe("Gemini adapter", () => {
  const frames = [
    'data: {"candidates":[{"content":{"parts":[{"text":"Entropy "}]}}]}\n\n',
    'data: {"candidates":[{"content":{"parts":[{"text":"is disorder."}]}}]}\n\n',
  ];

  it("sends the documented request shape", async () => {
    fetchMock.mockResolvedValue(sseResponse(frames));
    await drain(streamGemini(messages, opts));
    const { url, body, headers } = lastCall();

    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/test-model:streamGenerateContent?alt=sse",
    );
    expect(headers["x-goog-api-key"]).toBe("test-key");
    expect(body.system_instruction).toEqual({ parts: [{ text: "You are Gloss." }] });
    expect(body.generationConfig).toEqual({ maxOutputTokens: 2048 });
  });

  it("renames the assistant role to Gemini's 'model'", async () => {
    fetchMock.mockResolvedValue(sseResponse(frames));
    await drain(
      streamGemini(
        [
          { role: "user", content: "q" },
          { role: "assistant", content: "a" },
          { role: "user", content: "follow-up" },
        ],
        opts,
      ),
    );
    expect(lastCall().body.contents.map((c: { role: string }) => c.role)).toEqual([
      "user",
      "model",
      "user",
    ]);
  });

  it("percent-encodes a model id so a slash cannot alter the path", async () => {
    fetchMock.mockResolvedValue(sseResponse(frames));
    await drain(streamGemini(messages, { ...opts, model: "models/evil" }));
    expect(lastCall().url).toContain("models%2Fevil:streamGenerateContent");
  });

  it("streams text parts", async () => {
    fetchMock.mockResolvedValue(sseResponse(frames));
    expect(await drain(streamGemini(messages, opts))).toBe("Entropy is disorder.");
  });

  it("concatenates multiple parts in one chunk", async () => {
    fetchMock.mockResolvedValue(
      sseResponse(['data: {"candidates":[{"content":{"parts":[{"text":"a"},{"text":"b"}]}}]}\n\n']),
    );
    expect(await drain(streamGemini(messages, opts))).toBe("ab");
  });

  it("skips malformed JSON frames rather than aborting the answer", async () => {
    fetchMock.mockResolvedValue(
      sseResponse(["data: not-json\n\n", 'data: {"candidates":[{"content":{"parts":[{"text":"ok"}]}}]}\n\n']),
    );
    expect(await drain(streamGemini(messages, opts))).toBe("ok");
  });

  it("surfaces an API error", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "API key not valid" } }), { status: 400 }),
    );
    await expect(drain(streamGemini(messages, opts))).rejects.toThrow("API key not valid");
  });

  it("throws on a mid-stream error payload", async () => {
    fetchMock.mockResolvedValue(sseResponse(['data: {"error":{"message":"quota exceeded"}}\n\n']));
    await expect(drain(streamGemini(messages, opts))).rejects.toThrow("quota exceeded");
  });
});

describe("OpenAI-compatible adapter", () => {
  const frames = [
    'data: {"choices":[{"delta":{"content":"Entropy "}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"is disorder."}}]}\n\n',
    "data: [DONE]\n\n",
  ];
  const adapter = openAICompatible("https://openrouter.ai/api/v1", { "X-Title": "Gloss" });

  it("sends the documented request shape, with the system prompt as message zero", async () => {
    fetchMock.mockResolvedValue(sseResponse(frames));
    await drain(adapter(messages, opts));
    const { url, body, headers, init } = lastCall();

    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(headers.authorization).toBe("Bearer test-key");
    expect(headers["X-Title"]).toBe("Gloss");
    expect(body.messages[0]).toEqual({ role: "system", content: "You are Gloss." });
    expect(body.messages.slice(1)).toEqual(messages);
    expect(body).toMatchObject({ model: "test-model", max_tokens: 2048, stream: true });
    expect(init.signal).toBe(opts.signal);
  });

  it("strips a trailing slash from the base URL", async () => {
    fetchMock.mockResolvedValue(sseResponse(frames));
    await drain(openAICompatible("http://localhost:11434/v1/")(messages, opts));
    expect(lastCall().url).toBe("http://localhost:11434/v1/chat/completions");
  });

  it("streams content deltas and stops at [DONE]", async () => {
    fetchMock.mockResolvedValue(
      sseResponse([...frames, 'data: {"choices":[{"delta":{"content":"after done"}}]}\n\n']),
    );
    expect(await drain(adapter(messages, opts))).toBe("Entropy is disorder.");
  });

  it("ignores role-only and empty deltas", async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        'data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":""}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"real"}}]}\n\n',
      ]),
    );
    expect(await drain(adapter(messages, opts))).toBe("real");
  });

  it("ignores reasoning-only deltas, which free models emit alongside content", async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        'data: {"choices":[{"delta":{"reasoning":"thinking out loud"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"answer"}}]}\n\n',
      ]),
    );
    expect(await drain(adapter(messages, opts))).toBe("answer");
  });

  it("skips keep-alive padding", async () => {
    fetchMock.mockResolvedValue(
      sseResponse(["data: keep-alive\n\n", 'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n']),
    );
    expect(await drain(adapter(messages, opts))).toBe("ok");
  });

  it("surfaces an API error with its status", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "No endpoints found for model" } }), {
        status: 404,
      }),
    );
    const err = await drain(adapter(messages, opts)).catch((e) => e);
    // The exact failure a stale free-model id produces.
    expect(err.message).toBe("No endpoints found for model");
    expect(err.status).toBe(404);
  });

  it("throws on a mid-stream error payload", async () => {
    fetchMock.mockResolvedValue(sseResponse(['data: {"error":{"message":"rate limited"}}\n\n']));
    await expect(drain(adapter(messages, opts))).rejects.toThrow("rate limited");
  });
});
