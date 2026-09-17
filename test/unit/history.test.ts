import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearHistory,
  countThreads,
  deleteThread,
  estimateUsage,
  getThread,
  listThreads,
  purgeOlderThan,
  saveThread,
  type HistoryThread,
} from "../../src/store/history";

const DAY = 86_400_000;

function thread(id: string, updatedAt: number): HistoryThread {
  return {
    id,
    createdAt: updatedAt,
    updatedAt,
    selection: `selection ${id}`,
    title: "Page",
    url: "https://example.com",
    providerId: "openrouter",
    model: "google/gemma-4-26b-a4b-it:free",
    messages: [{ role: "user", content: "q" }],
  };
}

beforeEach(async () => {
  await clearHistory();
});

describe("history", () => {
  it("round-trips a thread", async () => {
    const t = thread("a", 1);
    await saveThread(t);
    expect(await getThread("a")).toEqual(t);
  });

  it("returns undefined for an unknown id", async () => {
    expect(await getThread("missing")).toBeUndefined();
  });

  it("overwrites on re-save rather than duplicating", async () => {
    // Every streamed answer re-saves the same thread id as it grows.
    await saveThread(thread("a", 1));
    await saveThread({ ...thread("a", 2), selection: "updated" });
    expect(await countThreads()).toBe(1);
    expect((await getThread("a"))?.selection).toBe("updated");
  });

  it("lists newest first", async () => {
    await saveThread(thread("old", 1000));
    await saveThread(thread("new", 3000));
    await saveThread(thread("mid", 2000));
    expect((await listThreads()).map((t) => t.id)).toEqual(["new", "mid", "old"]);
  });

  it("honours the list limit", async () => {
    for (let i = 0; i < 5; i++) await saveThread(thread(`t${i}`, i));
    const got = await listThreads(2);
    expect(got.map((t) => t.id)).toEqual(["t4", "t3"]);
  });

  it("counts, deletes one, and clears all", async () => {
    await saveThread(thread("a", 1));
    await saveThread(thread("b", 2));
    expect(await countThreads()).toBe(2);
    await deleteThread("a");
    expect(await countThreads()).toBe(1);
    await clearHistory();
    expect(await countThreads()).toBe(0);
    expect(await listThreads()).toEqual([]);
  });

  describe("purgeOlderThan", () => {
    it("removes only threads past the cutoff", async () => {
      const now = Date.now();
      await saveThread(thread("ancient", now - 40 * DAY));
      await saveThread(thread("recent", now - 2 * DAY));
      expect(await purgeOlderThan(30)).toBe(1);
      expect((await listThreads()).map((t) => t.id)).toEqual(["recent"]);
    });

    it("keeps everything when retention is off", async () => {
      await saveThread(thread("ancient", Date.now() - 400 * DAY));
      expect(await purgeOlderThan(0)).toBe(0);
      expect(await countThreads()).toBe(1);
    });

    it("removes several at once and reports the count", async () => {
      const now = Date.now();
      for (const d of [100, 90, 80, 1]) await saveThread(thread(`t${d}`, now - d * DAY));
      expect(await purgeOlderThan(7)).toBe(3);
      expect(await countThreads()).toBe(1);
    });

    it("is a no-op on empty history", async () => {
      expect(await purgeOlderThan(30)).toBe(0);
    });
  });

  describe("estimateUsage", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("reports KB below a megabyte", async () => {
      vi.stubGlobal("navigator", { storage: { estimate: async () => ({ usage: 200 * 1024 }) } });
      expect(await estimateUsage()).toBe("200 KB");
    });

    it("reports MB above one", async () => {
      vi.stubGlobal("navigator", { storage: { estimate: async () => ({ usage: 5.5 * 1024 * 1024 }) } });
      expect(await estimateUsage()).toBe("5.5 MB");
    });

    it("says unknown when the browser will not say", async () => {
      vi.stubGlobal("navigator", { storage: undefined });
      expect(await estimateUsage()).toBe("unknown");
    });
  });
});
