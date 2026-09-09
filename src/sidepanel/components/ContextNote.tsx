import { useState } from "preact/hooks";

/**
 * Makes the invisible part of the request visible: the surrounding page text
 * that goes out alongside the selection. Collapsed by default — it is
 * reassurance, not content.
 */
export function ContextNote({ context }: { context: string }) {
  const [open, setOpen] = useState(false);
  if (!context) return null;

  return (
    <div class="context-note">
      <button class="context-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span class="caret" data-open={open}>
          ›
        </span>
        {context.length.toLocaleString()} chars of page context sent
      </button>
      {open && <div class="context-body">{context}</div>}
    </div>
  );
}
