import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test as base, chromium, type BrowserContext, type Page } from "@playwright/test";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const DIST = resolve(HERE, "../../dist");

export interface GlossFixtures {
  context: BrowserContext;
  extensionId: string;
  /** A side panel, opened as a tab — same document, drivable by Playwright. */
  panel: Page;
  options: Page;
}

export const test = base.extend<GlossFixtures>({
  context: async ({}, use) => {
    const profile = await mkdtemp(join(tmpdir(), "gloss-e2e-"));
    // Extensions need a headed browser; WSLg provides the display.
    const context = await chromium.launchPersistentContext(profile, {
      headless: false,
      args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
    });
    await stubChromeApis(context);
    await use(context);
    await context.close();
    await rm(profile, { recursive: true, force: true });
  },

  extensionId: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
    await use(new URL(worker.url()).host);
  },

  panel: async ({ context, extensionId }, use) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await use(page);
  },

  options: async ({ context, extensionId }, use) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await use(page);
  },
});

export const expect = test.expect;

/**
 * Two browser-level dialogs would otherwise stop every run dead: the host
 * permission prompt, and the OAuth tab. Both are replaced with recording stubs,
 * so what the extension asked for is still asserted — just not clicked.
 */
async function stubChromeApis(context: BrowserContext) {
  await context.addInitScript(() => {
    const api = (globalThis as { chrome?: typeof chrome }).chrome;
    if (!api?.permissions) return;

    const w = window as unknown as Record<string, unknown>;
    w.__glossPermissionRequests = [];
    w.__glossAuthLaunches = [];

    api.permissions.request = async (p: chrome.permissions.Permissions) => {
      (w.__glossPermissionRequests as unknown[]).push(p);
      return !w.__glossDenyPermission;
    };

    // Everything the panel asks about is already granted, unless a test says not.
    const realContains = api.permissions.contains.bind(api.permissions);
    api.permissions.contains = async (p: chrome.permissions.Permissions) =>
      w.__glossDenyPermission ? false : ((await realContains(p)) as boolean) || true;

    if (api.identity) {
      // Kept so one spec can exercise the genuine API against a local server.
      w.__glossRealLaunch = api.identity.launchWebAuthFlow.bind(api.identity);
      api.identity.launchWebAuthFlow = async (opts: { url: string; interactive?: boolean }) => {
        (w.__glossAuthLaunches as unknown[]).push(opts.url);
        if (w.__glossCancelAuth) throw new Error("The user did not approve access.");
        return `${api.identity.getRedirectURL()}?code=e2e-auth-code`;
      };
    }
  });
}

/** Writes storage the way a configured install would already look. */
export async function seed(
  page: Page,
  state: { keys?: Record<string, string>; settings?: Record<string, unknown> },
) {
  await page.evaluate(async (s) => {
    for (const [id, key] of Object.entries(s.keys ?? {})) {
      await chrome.storage.local.set({ [`gloss:key:${id}`]: key });
    }
    if (s.settings) {
      const got = await chrome.storage.sync.get("gloss:settings");
      await chrome.storage.sync.set({
        "gloss:settings": { ...(got["gloss:settings"] ?? {}), ...s.settings },
      });
    }
  }, state);
  await page.reload();
}

/**
 * A real streaming server on Ollama's port, reached through the registry's
 * existing "ollama" provider. route.fulfill() sends a complete body and closes,
 * so it cannot model a stream that is still open — which is what stopping,
 * thinking states and mid-stream failures are all about.
 */
export async function startChatServer() {
  const { createServer } = await import("node:http");
  const responses: import("node:http").ServerResponse[] = [];
  const bodies: string[] = [];

  // Without these the browser refuses the request outright — the same reason a
  // real Ollama needs OLLAMA_ORIGINS=chrome-extension://*.
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "POST, OPTIONS",
  };

  const server = createServer((req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors);
      return res.end();
    }
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      bodies.push(body);
      res.writeHead(200, { ...cors, "content-type": "text/event-stream", "cache-control": "no-cache" });
      responses.push(res);
    });
  });
  await new Promise<void>((r) => server.listen(11434, "127.0.0.1", r));

  const live = () => responses[responses.length - 1];
  return {
    bodies,
    async waitForRequest() {
      const until = Date.now() + 7000;
      while (!responses.length && Date.now() < until) await new Promise((r) => setTimeout(r, 25));
      if (!responses.length) throw new Error("the extension never called the chat endpoint");
    },
    push(text: string) {
      live().write(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`);
    },
    finish() {
      live().write("data: [DONE]\n\n");
      live().end();
    },
    close: () =>
      new Promise<void>((r) => {
        for (const res of responses) res.destroy();
        server.close(() => r());
      }),
  };
}

/**
 * Fires a capture the way the background worker does when the user picks
 * "Ask Gloss": store it, then broadcast. Runs inside the extension's own
 * service worker, so the panel sees a genuine trigger.
 */
export async function trigger(
  context: BrowserContext,
  capture: { text: string; context?: string; url?: string; title?: string } | null,
  error?: "restricted" | "empty",
) {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  return worker.evaluate(
    async ([cap, err]: readonly [typeof capture, typeof error]) => {
      const pending = {
        id: crypto.randomUUID(),
        tabId: 1,
        capture: cap && { context: "", url: "", title: "", capturedAt: Date.now(), ...cap },
        error: err,
      };
      await chrome.storage.session.set({ "gloss:pending": pending });
      await chrome.runtime.sendMessage({ type: "gloss:pending", pending }).catch(() => {});
      return pending.id;
    },
    [capture, error] as const,
  );
}

/** An SSE body in the OpenAI chat-completions shape every mocked answer uses. */
export function sseBody(chunks: string[]): string {
  return (
    chunks.map((c) => `data: ${JSON.stringify({ choices: [{ delta: { content: c } }] })}\n\n`).join("") +
    "data: [DONE]\n\n"
  );
}
