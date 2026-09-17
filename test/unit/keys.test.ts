import { beforeEach, describe, expect, it } from "vitest";
import { installChrome, type ChromeMock } from "../support/chrome-mock";
import { clearAllKeys, clearKey, getConfiguredProviders, getKey, setKey } from "../../src/store/keys";

let chrome: ChromeMock;
beforeEach(() => {
  chrome = installChrome();
});

describe("key storage", () => {
  it("round-trips a key", async () => {
    await setKey("anthropic", "sk-ant-123");
    expect(await getKey("anthropic")).toBe("sk-ant-123");
  });

  it("returns an empty string for a provider with no key", async () => {
    expect(await getKey("openai")).toBe("");
  });

  it("trims surrounding whitespace from a pasted key", async () => {
    await setKey("openai", "  sk-abc\n");
    expect(await getKey("openai")).toBe("sk-abc");
  });

  it("treats a blank value as a deletion", async () => {
    await setKey("openai", "sk-abc");
    await setKey("openai", "   ");
    expect(await getKey("openai")).toBe("");
    expect(chrome.storage.local.data.has("gloss:key:openai")).toBe(false);
  });

  it("never writes a key to sync storage", async () => {
    // Deliberate: sync would ship keys to every signed-in device.
    await setKey("anthropic", "sk-ant-123");
    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
    expect(chrome.storage.sync.data.size).toBe(0);
    expect(chrome.storage.local.data.has("gloss:key:anthropic")).toBe(true);
  });

  it("deletes one provider's key without touching the others", async () => {
    await setKey("anthropic", "a");
    await setKey("gemini", "g");
    await clearKey("anthropic");
    expect(await getKey("anthropic")).toBe("");
    expect(await getKey("gemini")).toBe("g");
  });

  describe("getConfiguredProviders", () => {
    it("lists only providers holding a non-empty key", async () => {
      await setKey("anthropic", "a");
      await setKey("gemini", "g");
      expect(await getConfiguredProviders()).toEqual(new Set(["anthropic", "gemini"]));
    });

    it("ignores unrelated storage entries", async () => {
      await chrome.storage.local.set({ "gloss:something-else": "x", other: "y" });
      await setKey("openai", "o");
      expect(await getConfiguredProviders()).toEqual(new Set(["openai"]));
    });

    it("is empty on a fresh install", async () => {
      expect(await getConfiguredProviders()).toEqual(new Set());
    });
  });

  it("clears every key at once, leaving other data alone", async () => {
    await setKey("anthropic", "a");
    await setKey("gemini", "g");
    await chrome.storage.local.set({ "gloss:other": "keep" });
    await clearAllKeys();
    expect(await getConfiguredProviders()).toEqual(new Set());
    expect(chrome.storage.local.data.get("gloss:other")).toBe("keep");
  });
});
