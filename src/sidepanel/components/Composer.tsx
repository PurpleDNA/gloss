import { useEffect, useRef, useState } from "preact/hooks";
import { speechSupported, startSpeech, type SpeechSession } from "../../lib/speech";
import { SendIcon, StopIcon, WaveIcon } from "./Icons";

interface Props {
  disabled: boolean;
  streaming: boolean;
  /** What the box invites: a follow-up, or the first thing said. */
  placeholder: string;
  /** Take the caret on open, so a paste lands in the box without a click. */
  autoFocus?: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}

export function Composer({ disabled, streaming, placeholder, autoFocus, onSend, onStop }: Props) {
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [speechError, setSpeechError] = useState("");

  const ref = useRef<HTMLTextAreaElement>(null);
  const session = useRef<SpeechSession | null>(null);
  /** Text already settled — interim results are appended to this, not to state. */
  const settled = useRef("");

  const grow = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
  };

  // The transcript grows on its own, so height has to follow state, not typing.
  useEffect(grow, [text]);

  useEffect(() => () => session.current?.stop(), []);

  // Only worth stealing focus once the box is usable — an autofocus on a
  // disabled textarea is dropped, and the key arrives a tick after the panel.
  useEffect(() => {
    if (autoFocus && !disabled) ref.current?.focus();
  }, [autoFocus, disabled]);

  const send = () => {
    const value = text.trim();
    if (!value || streaming || disabled) return;
    session.current?.stop();
    onSend(value);
    setText("");
    settled.current = "";
  };

  const toggleRecording = () => {
    if (recording) {
      session.current?.stop();
      return;
    }

    setSpeechError("");
    settled.current = text.trim();

    const started = startSpeech({
      onInterim: (chunk) => setText([settled.current, chunk].filter(Boolean).join(" ")),
      onFinal: (chunk) => {
        settled.current = [settled.current, chunk.trim()].filter(Boolean).join(" ");
        setText(settled.current);
      },
      onError: (message) => setSpeechError(message),
      onEnd: () => {
        session.current = null;
        setRecording(false);
        ref.current?.focus();
      },
    });

    if (!started) {
      setSpeechError("Voice input is not available in this browser.");
      return;
    }
    session.current = started;
    setRecording(true);
  };

  const hasText = Boolean(text.trim());
  const canRecord = speechSupported() && !disabled;

  return (
    <form
      class="composer"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <div class="pill" data-disabled={disabled}>
        <textarea
          ref={ref}
          rows={1}
          value={text}
          disabled={disabled}
          placeholder={
            disabled ? "Add a key in Settings" : recording ? "Listening…" : placeholder
          }
          onInput={(e) => {
            const value = (e.currentTarget as HTMLTextAreaElement).value;
            setText(value);
            // Typing over a transcript takes ownership of it.
            if (recording) settled.current = value;
          }}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter is a newline.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />

        {streaming ? (
          <button type="button" class="send" onClick={onStop} title="Stop" aria-label="Stop">
            <StopIcon />
          </button>
        ) : recording ? (
          <button
            type="button"
            class="send"
            data-recording="true"
            onClick={toggleRecording}
            title="Stop listening"
            aria-label="Stop listening"
          >
            <WaveIcon active />
          </button>
        ) : hasText ? (
          <button type="submit" class="send" disabled={disabled} title="Send" aria-label="Send">
            <SendIcon />
          </button>
        ) : (
          <button
            type="button"
            class="send"
            disabled={!canRecord}
            onClick={toggleRecording}
            title="Speak"
            aria-label="Speak"
          >
            <WaveIcon />
          </button>
        )}
      </div>

      {speechError && <p class="speech-error">{speechError}</p>}
    </form>
  );
}
