import { useEffect, useRef } from "preact/hooks";
import { markdown } from "../../lib/markdown";
import { ContextNote } from "./ContextNote";
import type { ChatMessage } from "../../providers/types";

interface Props {
  messages: ChatMessage[];
  streaming: boolean;
  /** Shown in place of the first turn, whose real content is the built prompt. */
  selection?: string;
  /** Surrounding page text riding along with the first turn, if any. */
  context?: string;
}

export function Thread({ messages, streaming, selection, context }: Props) {
  const end = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  // Follow the stream, but stop fighting the user the moment they scroll up.
  useEffect(() => {
    if (pinned.current) end.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const onScroll = (e: Event) => {
    const el = e.currentTarget as HTMLElement;
    pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  };

  if (!messages.length) return null;

  return (
    <div class="thread" onScroll={onScroll}>
      {messages.map((m, i) =>
        m.role === "user" ? (
          i === 0 ? (
            <div key={i} class="first-turn">
              <div class="msg user">{selection ?? m.content}</div>
              {context && <ContextNote context={context} />}
            </div>
          ) : (
            <div key={i} class="msg user">
              {m.content}
            </div>
          )
        ) : (
          <div
            key={i}
            class="msg assistant"
            dangerouslySetInnerHTML={{
              __html: m.content
                ? markdown(m.content)
                : streaming
                  ? '<p class="pulse">Thinking</p>'
                  : "",
            }}
          />
        ),
      )}
      <div ref={end} />
    </div>
  );
}
