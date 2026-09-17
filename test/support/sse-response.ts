/** A fake text/event-stream response, one SSE frame per entry. */
export function sseResponse(frames: string[], init: ResponseInit = {}): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const f of frames) controller.enqueue(encoder.encode(f));
        controller.close();
      },
    }),
    { status: 200, headers: { "content-type": "text/event-stream" }, ...init },
  );
}

/** Drains an adapter into the string the panel would have rendered. */
export async function drain(gen: AsyncGenerator<string>): Promise<string> {
  let out = "";
  for await (const delta of gen) out += delta;
  return out;
}
