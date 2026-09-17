import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test } from "./fixtures";

/**
 * The one thing a mocked flow cannot answer: whether chrome.identity actually
 * works from inside the side panel document, rather than only from a tab or the
 * service worker. This runs the real API against a local redirect.
 */
let server: Server;
let origin: string;

test.beforeAll(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const back = url.searchParams.get("to");
    if (back) {
      res.writeHead(302, { location: `${back}?code=real-flow-code` });
      return res.end();
    }
    res.writeHead(404).end();
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.afterAll(() => new Promise<void>((r) => server.close(() => r())));

test("launchWebAuthFlow resolves from the side panel document", async ({ panel }) => {
  const result = await panel.evaluate(async (base: string) => {
    const redirect = chrome.identity.getRedirectURL();
    const launch = (window as any).__glossRealLaunch as typeof chrome.identity.launchWebAuthFlow;
    try {
      // interactive:false still follows redirects; it only forbids showing UI.
      const url = `${base}/auth?to=${encodeURIComponent(redirect)}`;
      return { ok: true, redirectTo: await launch({ url, interactive: false }) };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }, origin);

  expect(result.ok, `launchWebAuthFlow failed: ${result.error}`).toBe(true);
  expect(result.redirectTo).toContain("code=real-flow-code");
});

test("the redirect URL Chrome hands out is the one OpenRouter is given", async ({ panel }) => {
  const redirect = await panel.evaluate(() => chrome.identity.getRedirectURL());
  expect(redirect).toMatch(/^https:\/\/[a-p]{32}\.chromiumapp\.org\/$/);
});
