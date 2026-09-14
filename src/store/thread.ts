import type { ChatMessage } from "../providers/types";

/**
 * The live thread, kept in storage.session so closing and reopening the panel
 * restores the answer instead of re-asking for it. Session scope is the right
 * lifetime: it survives a panel close, and clears when the browser quits.
 * Durable, browsable history is M5 and lives in IndexedDB.
 */
const KEY = "gloss:thread";

export interface StoredThread {
  /** The thread's id: the trigger's, or a minted one when nothing was selected. */
  id: string;
  /** Ties the thread to the trigger that produced it; absent for typed threads. */
  pendingId?: string;
  createdAt: number;
  messages: ChatMessage[];
}

export async function loadThread(): Promise<StoredThread | null> {
  const got = await chrome.storage.session.get(KEY);
  const thread = got[KEY] as Partial<StoredThread> | undefined;
  // Session storage can still hold a pre-`id` record from an older build; it
  // dies with the browser anyway, so drop it rather than migrate it.
  if (!thread?.id || !thread.messages) return null;
  return thread as StoredThread;
}

export async function saveThread(thread: StoredThread): Promise<void> {
  await chrome.storage.session.set({ [KEY]: thread });
}

export async function clearThread(): Promise<void> {
  await chrome.storage.session.remove(KEY);
}
