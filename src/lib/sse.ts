export interface SSEEvent {
  event?: string;
  data: string;
}

/** Parses a text/event-stream response body incrementally. */
export async function* sseEvents(res: Response): AsyncGenerator<SSEEvent> {
  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

    let split: number;
    while ((split = buf.indexOf("\n\n")) !== -1) {
      const raw = buf.slice(0, split);
      buf = buf.slice(split + 2);

      let event: string | undefined;
      const data: string[] = [];
      for (const line of raw.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).trim());
      }
      if (data.length) yield { event, data: data.join("\n") };
    }
  }
}
