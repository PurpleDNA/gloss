import { DEFAULT_SYSTEM_PROMPT, DEFAULT_TEMPLATE } from "../prompts/templates";

// Kept out of gloss:settings so the settings item stays comfortably under
// storage.sync's 8KB per-item cap even with a long custom template.
const TEMPLATE_KEY = "gloss:template";
const SYSTEM_KEY = "gloss:system";

export async function getTemplate(): Promise<string> {
  const got = await chrome.storage.sync.get(TEMPLATE_KEY);
  return (got[TEMPLATE_KEY] as string | undefined)?.trim() || DEFAULT_TEMPLATE;
}

export async function saveTemplate(text: string): Promise<void> {
  if (text.trim()) await chrome.storage.sync.set({ [TEMPLATE_KEY]: text });
  else await chrome.storage.sync.remove(TEMPLATE_KEY);
}

export async function resetTemplate(): Promise<string> {
  await chrome.storage.sync.remove(TEMPLATE_KEY);
  return DEFAULT_TEMPLATE;
}

export async function getSystemPrompt(): Promise<string> {
  const got = await chrome.storage.sync.get(SYSTEM_KEY);
  return (got[SYSTEM_KEY] as string | undefined)?.trim() || DEFAULT_SYSTEM_PROMPT;
}

export async function saveSystemPrompt(text: string): Promise<void> {
  if (text.trim()) await chrome.storage.sync.set({ [SYSTEM_KEY]: text });
  else await chrome.storage.sync.remove(SYSTEM_KEY);
}

export async function resetSystemPrompt(): Promise<string> {
  await chrome.storage.sync.remove(SYSTEM_KEY);
  return DEFAULT_SYSTEM_PROMPT;
}

export const PROMPT_KEYS = [TEMPLATE_KEY, SYSTEM_KEY];
