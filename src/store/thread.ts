import type { ChatMessage } from "../providers/types";

/**
 * The live thread, kept in storage.session so closing and reopening the panel
 * restores the answer instead of re-asking for it. Session scope is the right
 * lifetime: it survives a panel close, and clears when the browser quits.
 * Durable, browsable history is M5 and lives in IndexedDB.
 */
const KEY = "gloss:thread";

export interface StoredThread {
  /** Ties the thread to the trigger that produced it. */
  pendingId: string;
  messages: ChatMessage[];
}

export async function loadThread(): Promise<StoredThread | null> {
  const got = await chrome.storage.session.get(KEY);
  return (got[KEY] as StoredThread | undefined) ?? null;
}

export async function saveThread(thread: StoredThread): Promise<void> {
  await chrome.storage.session.set({ [KEY]: thread });
}

export async function clearThread(): Promise<void> {
  await chrome.storage.session.remove(KEY);
}
