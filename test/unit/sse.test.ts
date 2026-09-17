import { describe, expect, it } from "vitest";
import { sseEvents } from "../../src/lib/sse";

/** Builds a Response whose body streams the given chunks, byte-for-byte as given. */
function stream(...chunks: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const c of chunks) controller.enqueue(encoder.encode(c));
        controller.close();
      },
    }),
  );
}

async function collect(res: Response) {
  const out = [];
  for await (const ev of sseEvents(res)) out.push(ev);
  return out;
}

describe("sseEvents", () => {
  it("parses a simple event with a name", async () => {
    expect(await collect(stream("event: ping\ndata: hello\n\n"))).toEqual([
      { event: "ping", data: "hello" },
    ]);
  });

  it("yields data-only events with no event name", async () => {
    expect(await collect(stream("data: one\n\ndata: two\n\n"))).toEqual([
      { event: undefined, data: "one" },
      { event: undefined, data: "two" },
    ]);
  });

  it("reassembles an event split across network chunks", async () => {
    // The realistic failure: a provider flushes mid-JSON and a naive parser
    // either drops the tail or emits half a payload.
    const events = await collect(stream('data: {"a"', ':1}\n', "\ndata: second\n\n"));
    expect(events).toEqual([
      { event: undefined, data: '{"a":1}' },
      { event: undefined, data: "second" },
    ]);
  });

  it("emits nothing for a partial event that never terminates", async () => {
    expect(await collect(stream("data: truncated"))).toEqual([]);
  });

  it("normalises CRLF line endings", async () => {
    expect(await collect(stream("event: ping\r\ndata: hi\r\n\r\n"))).toEqual([
      { event: "ping", data: "hi" },
    ]);
  });

  it("joins multi-line data fields with newlines", async () => {
    expect(await collect(stream("data: line one\ndata: line two\n\n"))).toEqual([
      { event: undefined, data: "line one\nline two" },
    ]);
  });

  it("ignores comment and unknown fields", async () => {
    expect(await collect(stream(": keep-alive\n\ndata: real\n\n"))).toEqual([
      { event: undefined, data: "real" },
    ]);
  });

  it("returns immediately when the response has no body", async () => {
    expect(await collect(new Response(null))).toEqual([]);
  });
});
