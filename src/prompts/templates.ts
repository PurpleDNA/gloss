import type { Capture } from "../lib/types";

/**
 * One prompt, not a menu of them. The panel fires this the moment it opens; the
 * user steers from there with follow-ups, which is faster than picking a verb
 * up front. Editable in settings.
 */
export const DEFAULT_TEMPLATE = "Explain this, as it is used here: {selection}";

export const DEFAULT_SYSTEM_PROMPT = `You are Gloss. A reader highlighted something mid-page and wants to understand it without losing their place.

Teach it the way a good teacher meets a curious beginner. Assume no prior knowledge of the subject. Use plain words. If you have to introduce a term, define it in the same breath.

Anchor the meaning in the passage they were reading - that specific use, not the dictionary in general.

Be brief. Three or four sentences is usually the whole job. An answer they finish reading beats a thorough one they abandon, and a bored reader learns nothing. Hold the depth back - they can ask a follow-up, and they will.

Lead with the answer. No preamble, no restating the question, no closing summary, no offers of further help. Use markdown sparingly.`;

/** Placeholders a template may use, shown as help text in settings. */
export const VARIABLES = ["selection", "context", "title", "url"] as const;

function fill(template: string, capture: Capture): string {
  return template
    .replaceAll("{selection}", capture.text)
    .replaceAll("{context}", capture.context)
    .replaceAll("{title}", capture.title)
    .replaceAll("{url}", capture.url);
}

/**
 * Builds the opening turn. The page context is prepended automatically, unless
 * the template places {context} itself — otherwise a custom template that wants
 * the context somewhere specific would end up sending it twice.
 */
export function buildPrompt(template: string, capture: Capture): string {
  const parts: string[] = [];

  if (!template.includes("{context}")) {
    if (capture.title || capture.url) {
      parts.push(
        `Page: ${capture.title || "(untitled)"}${capture.url ? `\nURL: ${capture.url}` : ""}`,
      );
    }
    if (capture.context) {
      parts.push(`Surrounding context:\n"""\n${capture.context}\n"""`);
    }
  }

  parts.push(fill(template, capture));
  return parts.join("\n\n");
}
