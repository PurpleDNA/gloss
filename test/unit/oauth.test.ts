import { webcrypto } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { installChrome, type ChromeMock } from "../support/chrome-mock";
import { connectOpenRouter } from "../../src/lib/oauth";
import { getKey } from "../../src/store/keys";

const ORIGIN = "https://openrouter.ai/*";

let chrome: ChromeMock;
let fetchMock: ReturnType<typeof vi.fn>;

// jsdom ships a crypto without subtle; the extension runs in a real browser that has it.
if (!globalThis.crypto?.subtle) {
  vi.stubGlobal("crypto", webcrypto);
}

const authUrl = () =>
  new URL(chrome.identity.launchWebAuthFlow.mock.calls[0][0].url as string);
const exchangeBody = () => JSON.parse(fetchMock.mock.calls[0][1].body as string);

/** Recomputes the challenge the way OpenRouter's server will. */
async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

beforeEach(() => {
  chrome = installChrome();
  // A factory, not a fixed Response: a body can only be read once, and some
  // tests call the flow twice.
  fetchMock = vi
    .fn()
    .mockImplementation(async () => new Response(JSON.stringify({ key: "sk-or-v1-minted" }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

describe("connectOpenRouter", () => {
  describe("the happy path", () => {
    it("returns the minted key and stores it", async () => {
      expect(await connectOpenRouter(ORIGIN)).toBe("sk-or-v1-minted");
      expect(await getKey("openrouter")).toBe("sk-or-v1-minted");
    });

    it("grants host access before opening the auth tab", async () => {
      // Order matters: permissions.request needs the click gesture, and awaiting
      // the auth tab first would spend it.
      const order: string[] = [];
      chrome.permissions.request.mockImplementation(async () => {
        order.push("permission");
        return true;
      });
      chrome.identity.launchWebAuthFlow.mockImplementation(async () => {
        order.push("auth");
        return "https://abcdefghijklmnop.chromiumapp.org/?code=test-auth-code";
      });

      await connectOpenRouter(ORIGIN);
      expect(order).toEqual(["permission", "auth"]);
      expect(chrome.permissions.request).toHaveBeenCalledWith({ origins: [ORIGIN] });
    });

    it("opens OpenRouter's auth page with the extension's own redirect URL", async () => {
      await connectOpenRouter(ORIGIN);
      const url = authUrl();
      expect(url.origin + url.pathname).toBe("https://openrouter.ai/auth");
      expect(url.searchParams.get("callback_url")).toBe(chrome.identity.getRedirectURL());
      expect(url.searchParams.get("key_label")).toBe("Gloss");
      expect(chrome.identity.launchWebAuthFlow.mock.calls[0][0].interactive).toBe(true);
    });

    it("sends a verifier whose S256 hash is the challenge it advertised", async () => {
      // The whole security property of PKCE, checked end to end.
      await connectOpenRouter(ORIGIN);
      const url = authUrl();
      expect(url.searchParams.get("code_challenge_method")).toBe("S256");
      expect(await challengeFor(exchangeBody().code_verifier)).toBe(
        url.searchParams.get("code_challenge"),
      );
    });

    it("uses a base64url verifier of at least 43 characters, per RFC 7636", async () => {
      await connectOpenRouter(ORIGIN);
      const verifier = exchangeBody().code_verifier as string;
      expect(verifier.length).toBeGreaterThanOrEqual(43);
      expect(verifier).toMatch(/^[A-Za-z0-9\-_]+$/);
    });

    it("mints a fresh verifier on every attempt", async () => {
      await connectOpenRouter(ORIGIN);
      const first = exchangeBody().code_verifier;
      fetchMock.mockClear();
      await connectOpenRouter(ORIGIN);
      expect(exchangeBody().code_verifier).not.toBe(first);
    });

    it("posts the code from the redirect to the key endpoint", async () => {
      await connectOpenRouter(ORIGIN);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://openrouter.ai/api/v1/auth/keys");
      expect(init.method).toBe("POST");
      expect(exchangeBody()).toMatchObject({
        code: "test-auth-code",
        code_challenge_method: "S256",
      });
    });
  });

  describe("when it cannot finish", () => {
    it("stops if the user declines host access, without opening a tab", async () => {
      chrome.permissions.request.mockResolvedValue(false);
      await expect(connectOpenRouter(ORIGIN)).rejects.toThrow(/access to openrouter\.ai/);
      expect(chrome.identity.launchWebAuthFlow).not.toHaveBeenCalled();
      expect(await getKey("openrouter")).toBe("");
    });

    it("reports a cancelled sign-in plainly", async () => {
      chrome.identity.launchWebAuthFlow.mockRejectedValue(
        new Error("The user did not approve access."),
      );
      await expect(connectOpenRouter(ORIGIN)).rejects.toThrow("Connection cancelled.");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("throws when the redirect carries no code", async () => {
      chrome.identity.launchWebAuthFlow.mockResolvedValue(
        "https://abcdefghijklmnop.chromiumapp.org/?error=access_denied",
      );
      await expect(connectOpenRouter(ORIGIN)).rejects.toThrow(/no authorization code/);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("throws when the exchange is refused", async () => {
      fetchMock.mockResolvedValue(new Response("nope", { status: 403 }));
      await expect(connectOpenRouter(ORIGIN)).rejects.toThrow(/refused the exchange \(403\)/);
      expect(await getKey("openrouter")).toBe("");
    });

    it("throws when the exchange succeeds but carries no key", async () => {
      fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
      await expect(connectOpenRouter(ORIGIN)).rejects.toThrow(/no key/);
      expect(await getKey("openrouter")).toBe("");
    });

    it("leaves no key behind when the code has already expired", async () => {
      // OpenRouter codes are single-use and die after ten minutes.
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "expired" }), { status: 400 }));
      await expect(connectOpenRouter(ORIGIN)).rejects.toThrow();
      expect(await getKey("openrouter")).toBe("");
    });
  });
});
