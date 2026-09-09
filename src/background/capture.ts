import type { Capture } from "../lib/types";

/**
 * Runs inside the page via chrome.scripting.executeScript, which serializes this
 * function to source. It must therefore stay entirely self-contained: no imports,
 * no closures, no module-scope references. Type-only imports are erased, so the
 * `Capture` annotation above is safe.
 */
export function captureSelection(): Capture | null {
  const sel = window.getSelection();
  const text = sel?.toString().trim() ?? "";
  if (!text || !sel) return null;

  const anchor = sel.anchorNode;
  let el: Element | null =
    anchor?.nodeType === 3 ? anchor.parentElement : (anchor as Element | null);

  // Climb until the ancestor carries enough prose to disambiguate the selection.
  while (el?.parentElement && (el.textContent?.length ?? 0) < 400) {
    el = el.parentElement;
  }

  let context = (el as HTMLElement | null)?.innerText ?? "";
  context = context.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

  // If the "context" is just the selection again, it adds nothing but tokens.
  if (context === text) context = "";

  const LIMIT = 2000;
  if (context.length > LIMIT) {
    // The climb lands on a large container whenever a paragraph has no wrapper
    // of its own. Slicing from the start would then return the top of the
    // article instead of the text around the selection, so centre the window on
    // wherever the selection actually sits.
    const needle = text.replace(/[ \t]+/g, " ").trim();
    let at = context.indexOf(needle);
    if (at === -1 && needle.length > 40) at = context.indexOf(needle.slice(0, 40));

    const centre = at === -1 ? 0 : at + Math.min(needle.length, LIMIT) / 2;
    let start = Math.max(0, Math.round(centre - LIMIT / 2));
    start = Math.min(start, Math.max(0, context.length - LIMIT));

    // Nudge both edges to word boundaries rather than cutting mid-word.
    if (start > 0) {
      const space = context.indexOf(" ", start);
      if (space !== -1 && space - start < 40) start = space + 1;
    }
    let end = Math.min(context.length, start + LIMIT);
    if (end < context.length) {
      const space = context.lastIndexOf(" ", end);
      if (space > start && end - space < 40) end = space;
    }

    context =
      (start > 0 ? "... " : "") +
      context.slice(start, end).trim() +
      (end < context.length ? " ..." : "");
  }

  return {
    text: text.slice(0, 8000),
    context,
    url: location.href,
    title: document.title,
    capturedAt: Date.now(),
  };
}
