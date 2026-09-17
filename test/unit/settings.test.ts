import { beforeEach, describe, expect, it } from "vitest";
import { installChrome, type ChromeMock } from "../support/chrome-mock";
import { DEFAULTS, getSettings, modelFor, resetSettings, saveSettings } from "../../src/store/settings";
import { PROVIDERS, getProvider } from "../../src/providers/registry";

let chrome: ChromeMock;
beforeEach(() => {
  chrome = installChrome();
});

describe("settings", () => {
  it("returns the defaults on a fresh install", async () => {
    expect(await getSettings()).toEqual(DEFAULTS);
  });

  it("merges a stored partial over the defaults", async () => {
    // A record written by an older build lacks the newer fields entirely.
    await chrome.storage.sync.set({ "gloss:settings": { providerId: "gemini" } });
    const s = await getSettings();
    expect(s.providerId).toBe("gemini");
    expect(s.maxTokens).toBe(DEFAULTS.maxTokens);
    expect(s.historyEnabled).toBe(DEFAULTS.historyEnabled);
  });

  it("patches one field and leaves the rest", async () => {
    await saveSettings({ theme: "dark" });
    const s = await saveSettings({ providerId: "openai" });
    expect(s.theme).toBe("dark");
    expect(s.providerId).toBe("openai");
  });

  it("lives in sync storage, so preferences follow the user", async () => {
    await saveSettings({ theme: "dark" });
    expect(chrome.storage.sync.data.has("gloss:settings")).toBe(true);
    expect(chrome.storage.local.data.size).toBe(0);
  });

  it("resets back to the defaults", async () => {
    await saveSettings({ theme: "dark", models: { openai: "gpt-4o" } });
    expect(await resetSettings()).toEqual(DEFAULTS);
    expect(await getSettings()).toEqual(DEFAULTS);
  });

  it("does not share the defaults' models object between reads", async () => {
    const a = await getSettings();
    a.models.openai = "mutated";
    expect((await getSettings()).models).toEqual({});
  });

  describe("modelFor", () => {
    it("falls back to the provider's default when unset", async () => {
      const s = await getSettings();
      expect(modelFor(s, "anthropic")).toBe(getProvider("anthropic").defaultModel);
    });

    it("prefers an explicit choice", async () => {
      const s = await saveSettings({ models: { anthropic: "claude-opus-5" } });
      expect(modelFor(s, "anthropic")).toBe("claude-opus-5");
    });

    it("falls back when the stored choice is blank", async () => {
      // The settings UI writes "" while the Custom… field is empty.
      const s = await saveSettings({ models: { gemini: "" } });
      expect(modelFor(s, "gemini")).toBe(getProvider("gemini").defaultModel);
    });

    it("keeps a separate model per provider", async () => {
      const s = await saveSettings({ models: { anthropic: "claude-opus-5", openai: "gpt-4o" } });
      expect(modelFor(s, "anthropic")).toBe("claude-opus-5");
      expect(modelFor(s, "openai")).toBe("gpt-4o");
      for (const p of PROVIDERS.filter((p) => !["anthropic", "openai"].includes(p.id))) {
        expect(modelFor(s, p.id)).toBe(p.defaultModel);
      }
    });
  });
});
