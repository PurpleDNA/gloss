import type { Theme } from "../lib/theme";
import { DEFAULT_PROVIDER, getProvider } from "../providers/registry";

export interface Settings {
  providerId: string;
  /** Model per provider, so switching providers never leaves an invalid pair. */
  models: Record<string, string>;
  maxTokens: number;
  theme: Theme;
  /** Off means nothing is written to IndexedDB at all. */
  historyEnabled: boolean;
  /** Auto-delete threads older than this. 0 keeps them forever. */
  historyRetentionDays: number;
}

const KEY = "gloss:settings";

export const DEFAULTS: Settings = {
  providerId: DEFAULT_PROVIDER,
  models: {},
  maxTokens: 2048,
  theme: "system",
  historyEnabled: true,
  historyRetentionDays: 0,
};

export async function getSettings(): Promise<Settings> {
  const got = await chrome.storage.sync.get(KEY);
  const stored = (got[KEY] as Partial<Settings> | undefined) ?? {};
  return { ...DEFAULTS, ...stored, models: { ...(stored.models ?? {}) } };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.sync.set({ [KEY]: next });
  return next;
}

export async function resetSettings(): Promise<Settings> {
  await chrome.storage.sync.remove(KEY);
  return { ...DEFAULTS, models: {} };
}

/** The chosen model for a provider, falling back to that provider's default. */
export function modelFor(settings: Settings, providerId: string): string {
  return settings.models[providerId] || getProvider(providerId).defaultModel;
}
