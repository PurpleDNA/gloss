// Keys live in storage.local and never in storage.sync — sync would ship them
// through Microsoft's sync servers to every signed-in device.
const PREFIX = "gloss:key:";

export async function getKey(providerId: string): Promise<string> {
  const k = PREFIX + providerId;
  const got = await chrome.storage.local.get(k);
  return (got[k] as string | undefined) ?? "";
}

export async function setKey(providerId: string, value: string): Promise<void> {
  const k = PREFIX + providerId;
  const trimmed = value.trim();
  if (trimmed) await chrome.storage.local.set({ [k]: trimmed });
  else await chrome.storage.local.remove(k);
}

export async function clearKey(providerId: string): Promise<void> {
  await chrome.storage.local.remove(PREFIX + providerId);
}

/** Which providers currently hold a key, for badges and the panel switcher. */
export async function getConfiguredProviders(): Promise<Set<string>> {
  const all = await chrome.storage.local.get(null);
  return new Set(
    Object.entries(all)
      .filter(([k, v]) => k.startsWith(PREFIX) && typeof v === "string" && v)
      .map(([k]) => k.slice(PREFIX.length)),
  );
}

export async function clearAllKeys(): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter((k) => k.startsWith(PREFIX));
  if (keys.length) await chrome.storage.local.remove(keys);
}

export const KEY_PREFIX = PREFIX;
