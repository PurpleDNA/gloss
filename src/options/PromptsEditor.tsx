import { useEffect, useState } from "preact/hooks";
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_TEMPLATE, VARIABLES } from "../prompts/templates";
import {
  getSystemPrompt,
  getTemplate,
  resetSystemPrompt,
  resetTemplate,
  saveSystemPrompt,
  saveTemplate,
} from "../store/prompts";

export function PromptsEditor({ onFlash }: { onFlash: (message: string) => void }) {
  const [template, setTemplate] = useState<string | null>(null);
  const [system, setSystem] = useState("");

  useEffect(() => {
    void (async () => {
      setTemplate(await getTemplate());
      setSystem(await getSystemPrompt());
    })();
  }, []);

  if (template === null) return null;

  return (
    <>
      <section>
        <h2>Opening question</h2>
        <p class="hint">
          Sent automatically the moment the panel opens. Placeholders:{" "}
          {VARIABLES.map((v) => (
            <code key={v}>{`{${v}}`}</code>
          ))}
          . The page context is added for you — unless the template uses{" "}
          <code>{"{context}"}</code>, in which case you place it yourself.
        </p>
        <textarea
          rows={3}
          value={template}
          onInput={(e) => setTemplate((e.currentTarget as HTMLTextAreaElement).value)}
          onChange={(e) =>
            void saveTemplate((e.currentTarget as HTMLTextAreaElement).value).then(() =>
              onFlash("Question saved"),
            )
          }
        />
        {!template.includes("{selection}") && (
          <p class="warn">
            This never uses <code>{"{selection}"}</code>, so the highlighted text will not reach the
            model.
          </p>
        )}
        <div class="row">
          <button
            class="ghost"
            disabled={template === DEFAULT_TEMPLATE}
            onClick={() =>
              void (async () => {
                setTemplate(await resetTemplate());
                onFlash("Question reset");
              })()
            }
          >
            Reset to default
          </button>
        </div>
      </section>

      <section>
        <h2>System prompt</h2>
        <p class="hint">
          Sets the voice and, more importantly, the length. The shipped version tells the model to
          teach a beginner in three or four sentences and hold detail back for follow-ups — if
          answers feel too thin or too long, this is the dial.
        </p>
        <textarea
          class="system-prompt"
          rows={12}
          value={system}
          onInput={(e) => setSystem((e.currentTarget as HTMLTextAreaElement).value)}
          onChange={(e) =>
            void saveSystemPrompt((e.currentTarget as HTMLTextAreaElement).value).then(() =>
              onFlash("System prompt saved"),
            )
          }
        />
        <div class="row">
          <button
            class="ghost"
            disabled={system === DEFAULT_SYSTEM_PROMPT}
            onClick={() =>
              void (async () => {
                setSystem(await resetSystemPrompt());
                onFlash("System prompt reset");
              })()
            }
          >
            Reset to default
          </button>
        </div>
      </section>
    </>
  );
}
