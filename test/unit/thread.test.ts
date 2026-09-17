import { beforeEach, describe, expect, it } from "vitest";
import { installChrome, type ChromeMock } from "../support/chrome-mock";
import { clearThread, loadThread, saveThread } from "../../src/store/thread";

let chrome: ChromeMock;
beforeEach(() => {
  chrome = installChrome();
});

const thread = {
  id: "t1",
  pendingId: "p1",
  createdAt: 1000,
  messages: [
    { role: "user" as const, content: "what is entropy" },
    { role: "assistant" as const, content: "disorder, roughly" },
  ],
};

describe("live thread", () => {
  it("round-trips through session storage", async () => {
    await saveThread(thread);
    expect(await loadThread()).toEqual(thread);
  });

  it("uses session scope, so it dies with the browser and never syncs", async () => {
    await saveThread(thread);
    expect(chrome.storage.session.data.has("gloss:thread")).toBe(true);
    expect(chrome.storage.sync.data.size).toBe(0);
    expect(chrome.storage.local.data.size).toBe(0);
  });

  it("returns null when nothing is stored", async () => {
    expect(await loadThread()).toBeNull();
  });

  it("drops a legacy record with no id rather than restoring half a thread", async () => {
    await chrome.storage.session.set({ "gloss:thread": { createdAt: 1, messages: [] } });
    expect(await loadThread()).toBeNull();
  });

  it("drops a record with no messages array", async () => {
    await chrome.storage.session.set({ "gloss:thread": { id: "t1", createdAt: 1 } });
    expect(await loadThread()).toBeNull();
  });

  it("keeps a typed thread, which carries no pendingId", async () => {
    const typed = { id: "t2", createdAt: 2, messages: [{ role: "user" as const, content: "hi" }] };
    await saveThread(typed);
    expect(await loadThread()).toEqual(typed);
  });

  it("clears", async () => {
    await saveThread(thread);
    await clearThread();
    expect(await loadThread()).toBeNull();
  });
});
