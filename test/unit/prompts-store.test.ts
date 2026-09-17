import { beforeEach, describe, expect, it } from "vitest";
import { installChrome, type ChromeMock } from "../support/chrome-mock";
import {
  PROMPT_KEYS,
  getSystemPrompt,
  getTemplate,
  resetSystemPrompt,
  resetTemplate,
  saveSystemPrompt,
  saveTemplate,
} from "../../src/store/prompts";
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_TEMPLATE } from "../../src/prompts/templates";

let chrome: ChromeMock;
beforeEach(() => {
  chrome = installChrome();
});

describe("prompt storage", () => {
  it("serves the defaults when nothing is saved", async () => {
    expect(await getTemplate()).toBe(DEFAULT_TEMPLATE);
    expect(await getSystemPrompt()).toBe(DEFAULT_SYSTEM_PROMPT);
  });

  it("round-trips custom text", async () => {
    await saveTemplate("Define {selection}");
    await saveSystemPrompt("Be terse.");
    expect(await getTemplate()).toBe("Define {selection}");
    expect(await getSystemPrompt()).toBe("Be terse.");
  });

  it("treats whitespace-only text as a reset to the default", async () => {
    await saveTemplate("Define {selection}");
    await saveTemplate("   \n ");
    expect(await getTemplate()).toBe(DEFAULT_TEMPLATE);
    expect(chrome.storage.sync.data.has("gloss:template")).toBe(false);
  });

  it("resets each prompt independently", async () => {
    await saveTemplate("a");
    await saveSystemPrompt("b");
    expect(await resetTemplate()).toBe(DEFAULT_TEMPLATE);
    expect(await getSystemPrompt()).toBe("b");
    expect(await resetSystemPrompt()).toBe(DEFAULT_SYSTEM_PROMPT);
  });

  it("stores prompts outside gloss:settings, to stay under sync's per-item cap", async () => {
    await saveTemplate("a");
    expect(chrome.storage.sync.data.has("gloss:settings")).toBe(false);
    expect(PROMPT_KEYS).toEqual(["gloss:template", "gloss:system"]);
  });

  it("exports exactly the keys the panel watches for live updates", async () => {
    await saveTemplate("a");
    await saveSystemPrompt("b");
    for (const k of PROMPT_KEYS) expect(chrome.storage.sync.data.has(k)).toBe(true);
  });
});
