import { vi } from "vitest";

type Changes = Record<string, chrome.storage.StorageChange>;
type StorageListener = (changes: Changes, area: string) => void;

/** One storage area, with the subset of the real API that Gloss actually calls. */
class Area {
  readonly data = new Map<string, unknown>();

  constructor(
    private readonly name: string,
    private readonly listeners: StorageListener[],
  ) {}

  get = vi.fn(async (keys?: string | string[] | Record<string, unknown> | null) => {
    const out: Record<string, unknown> = {};
    if (keys === null || keys === undefined) {
      for (const [k, v] of this.data) out[k] = v;
      return out;
    }
    const wanted = typeof keys === "string" ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
    for (const k of wanted) if (this.data.has(k)) out[k] = this.data.get(k);
    return out;
  });

  set = vi.fn(async (items: Record<string, unknown>) => {
    const changes: Changes = {};
    for (const [k, v] of Object.entries(items)) {
      changes[k] = { oldValue: this.data.get(k), newValue: v };
      // Structured-clone the way the real API does, so a test cannot accidentally
      // assert on an object the code under test still holds a reference to.
      this.data.set(k, structuredClone(v));
    }
    this.emit(changes);
  });

  remove = vi.fn(async (keys: string | string[]) => {
    const changes: Changes = {};
    for (const k of typeof keys === "string" ? [keys] : keys) {
      if (!this.data.has(k)) continue;
      changes[k] = { oldValue: this.data.get(k) };
      this.data.delete(k);
    }
    if (Object.keys(changes).length) this.emit(changes);
  });

  clear = vi.fn(async () => {
    this.data.clear();
  });

  private emit(changes: Changes) {
    for (const l of [...this.listeners]) l(changes, this.name);
  }
}

function event<T extends (...args: never[]) => void>() {
  const listeners: T[] = [];
  return {
    listeners,
    addListener: vi.fn((cb: T) => void listeners.push(cb)),
    removeListener: vi.fn((cb: T) => {
      const i = listeners.indexOf(cb);
      if (i !== -1) listeners.splice(i, 1);
    }),
    hasListener: vi.fn((cb: T) => listeners.includes(cb)),
    /** Test-only: run every registered listener. */
    emit: (...args: Parameters<T>) => listeners.map((l) => l(...args)),
  };
}

export type ChromeMock = ReturnType<typeof makeChrome>;

export function makeChrome() {
  const storageListeners: StorageListener[] = [];
  const onChanged = {
    addListener: vi.fn((cb: StorageListener) => void storageListeners.push(cb)),
    removeListener: vi.fn((cb: StorageListener) => {
      const i = storageListeners.indexOf(cb);
      if (i !== -1) storageListeners.splice(i, 1);
    }),
  };

  const grantedOrigins = new Set<string>();

  return {
    storage: {
      local: new Area("local", storageListeners),
      sync: new Area("sync", storageListeners),
      session: new Area("session", storageListeners),
      onChanged,
    },
    permissions: {
      grantedOrigins,
      contains: vi.fn(async (p: { origins?: string[] }) =>
        (p.origins ?? []).every((o) => grantedOrigins.has(o)),
      ),
      request: vi.fn(async (p: { origins?: string[] }) => {
        for (const o of p.origins ?? []) grantedOrigins.add(o);
        return true;
      }),
      onAdded: event<() => void>(),
      onRemoved: event<() => void>(),
    },
    identity: {
      getRedirectURL: vi.fn(() => "https://abcdefghijklmnop.chromiumapp.org/"),
      launchWebAuthFlow: vi.fn(
        async (_opts: { url: string; interactive?: boolean }) =>
          "https://abcdefghijklmnop.chromiumapp.org/?code=test-auth-code",
      ),
    },
    runtime: {
      id: "abcdefghijklmnop",
      lastError: undefined as { message: string } | undefined,
      getURL: vi.fn((p: string) => `chrome-extension://abcdefghijklmnop/${p}`),
      sendMessage: vi.fn(async () => undefined),
      openOptionsPage: vi.fn(),
      onMessage: event<(msg: unknown) => void>(),
      onInstalled: event<() => void>(),
    },
    tabs: { get: vi.fn(async (_id: number) => ({ url: "", title: "" })) },
    scripting: { executeScript: vi.fn(async () => [] as { result: unknown }[]) },
    contextMenus: {
      create: vi.fn(),
      removeAll: vi.fn((cb?: () => void) => cb?.()),
      onClicked: event<(info: unknown, tab: unknown) => void>(),
    },
    commands: { onCommand: event<(command: string, tab: unknown) => void>() },
    sidePanel: {
      open: vi.fn(async () => undefined),
      setPanelBehavior: vi.fn(async () => undefined),
    },
    windows: { create: vi.fn(async () => ({ id: 1 })), update: vi.fn(async () => undefined), onRemoved: event<(id: number) => void>() },
  };
}

/** Installs a fresh mock on globalThis and hands it back. */
export function installChrome(): ChromeMock {
  const mock = makeChrome();
  (globalThis as unknown as { chrome: unknown }).chrome = mock;
  return mock;
}
