/** Host access is requested per provider, only when one is enabled. */
export function hasHostPermission(origin: string): Promise<boolean> {
  return chrome.permissions.contains({ origins: [origin] });
}

/** Must be called from a user gesture, or Chrome rejects it outright. */
export function requestHostPermission(origin: string): Promise<boolean> {
  return chrome.permissions.request({ origins: [origin] });
}
