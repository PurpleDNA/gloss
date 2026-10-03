import { beforeEach, describe, expect, it, vi } from "vitest";
import { installChrome, type ChromeMock } from "../support/chrome-mock";
import { PENDING_KEY, type Capture, type PendingCapture } from "../../src/lib/types";

let chrome: ChromeMock;

const TAB = 7;
const capture: Capture = {
  text: "entropy",
  context: "The entropy of the system rose.",
  url: "https://example.com/a",
  title: "Thermo",
  capturedAt: 1,
};

/** Fires the context-menu item the way Chrome does. */
function rightClick(selectionText?: string) {
  chrome.contextMenus.onClicked.emit({ menuItemId: "gloss-selection", selectionText }, { id: TAB });
}

const pending = async (): Promise<PendingCapture> => {
  await vi.waitFor(() => expect(chrome.storage.session.data.has(PENDING_KEY)).toBe(true));
  return chrome.storage.session.data.get(PENDING_KEY) as PendingCapture;
};

beforeEach(async () => {
  chrome = installChrome();
  vi.stubGlobal("crypto", { ...globalThis.crypto, randomUUID: () => "uuid-1" });
  vi.resetModules();
  await import("../../src/background/index");
});

describe("background worker", () => {
  it("creates the context menu and opens the panel from the toolbar on install", () => {
    chrome.runtime.onInstalled.emit();
    expect(chrome.contextMenus.create).toHaveBeenCalledWith(
      expect.objectContaining({ id: "gloss-selection", contexts: ["selection"] }),
    );
    expect(chrome.sidePanel.setPanelBehavior).toHaveBeenCalledWith({ openPanelOnActionClick: true });
  });

  describe("triggering", () => {
    it("opens the panel before awaiting anything", () => {
      // Chrome ties sidePanel.open() to the gesture's task; one await first and
      // the call is rejected outright, so this must be synchronous.
      chrome.scripting.executeScript.mockResolvedValue([{ result: capture }]);
      rightClick();
      expect(chrome.sidePanel.open).toHaveBeenCalledWith({ tabId: TAB });
    });

    it("ignores a context-menu click on some other item", () => {
      chrome.contextMenus.onClicked.emit({ menuItemId: "not-gloss" }, { id: TAB });
      expect(chrome.sidePanel.open).not.toHaveBeenCalled();
    });

    it("responds to the keyboard command too", () => {
      chrome.scripting.executeScript.mockResolvedValue([{ result: capture }]);
      chrome.commands.onCommand.emit("gloss-selection", { id: TAB });
      expect(chrome.sidePanel.open).toHaveBeenCalledWith({ tabId: TAB });
    });

    it("ignores a command with no tab behind it", () => {
      chrome.commands.onCommand.emit("gloss-selection", undefined);
      expect(chrome.sidePanel.open).not.toHaveBeenCalled();
    });
  });

  describe("inside a PDF viewer", () => {
    // The viewer reports its own embedded contents rather than the tab around it.
    const clickInPdf = (tab: unknown) =>
      chrome.contextMenus.onClicked.emit(
        { menuItemId: "gloss-selection", selectionText: "entropy", pageUrl: "https://pdf.example/x.pdf" },
        tab,
      );

    beforeEach(() => {
      chrome.scripting.executeScript.mockRejectedValue(new Error("Cannot access contents"));
      chrome.tabs.query.mockResolvedValue([{ id: TAB, url: "https://pdf.example/x.pdf", title: "A PDF" }]);
    });

    it.each([
      ["a tab with no id", { id: -1, windowId: -1 }],
      ["no tab at all", undefined],
    ])("opens the panel for the current window given %s", (_, tab) => {
      clickInPdf(tab);
      expect(chrome.sidePanel.open).toHaveBeenCalledWith({ windowId: chrome.windows.WINDOW_ID_CURRENT });
    });

    it("opens the panel for the window it was given when there is one", () => {
      clickInPdf({ id: -1, windowId: 3 });
      expect(chrome.sidePanel.open).toHaveBeenCalledWith({ windowId: 3 });
    });

    it("still captures the selection, from the active tab", async () => {
      clickInPdf({ id: -1, windowId: -1 });
      const p = await pending();
      expect(chrome.tabs.query).toHaveBeenCalledWith({ active: true, lastFocusedWindow: true });
      expect(p.tabId).toBe(TAB);
      expect(p.capture).toMatchObject({ text: "entropy", url: "https://pdf.example/x.pdf", title: "A PDF" });
    });

    it("falls back to the menu's page URL when no active tab is found", async () => {
      chrome.tabs.query.mockResolvedValue([]);
      clickInPdf(undefined);
      expect((await pending()).capture).toMatchObject({ text: "entropy", url: "https://pdf.example/x.pdf" });
    });

    it("stores the capture even when the panel refuses to open", async () => {
      // The toolbar icon then picks it up instead of reopening the last chat.
      chrome.sidePanel.open.mockRejectedValue(new Error("No window with id: -2"));
      clickInPdf(undefined);
      expect((await pending()).capture?.text).toBe("entropy");
    });
  });

  describe("capturing", () => {
    it("stores the capture, then broadcasts it", async () => {
      // Storage first: a cold panel needs ~100ms to boot and would miss the message.
      chrome.scripting.executeScript.mockResolvedValue([{ result: capture }]);
      rightClick();
      const p = await pending();
      expect(p).toMatchObject({ tabId: TAB, capture, error: undefined });
      await vi.waitFor(() => expect(chrome.runtime.sendMessage).toHaveBeenCalled());
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: "gloss:pending", pending: p });
    });

    it("reads every frame and takes the one that holds the selection", async () => {
      chrome.scripting.executeScript.mockResolvedValue([
        { result: null },
        { result: { ...capture, text: "in an iframe" } },
      ]);
      rightClick();
      expect((await pending()).capture?.text).toBe("in an iframe");
      expect(chrome.scripting.executeScript).toHaveBeenCalledWith(
        expect.objectContaining({ target: { tabId: TAB, allFrames: true } }),
      );
    });

    it("mints a fresh id per trigger, so re-selecting the same text still re-asks", async () => {
      chrome.scripting.executeScript.mockResolvedValue([{ result: capture }]);
      rightClick();
      expect((await pending()).id).toBe("uuid-1");
    });

    it("reports 'empty' when nothing was selected", async () => {
      chrome.scripting.executeScript.mockResolvedValue([{ result: null }]);
      rightClick();
      const p = await pending();
      expect(p.error).toBe("empty");
      expect(p.capture).toBeNull();
    });

    it("reports 'restricted' where injection is refused", async () => {
      // edge://, the add-ons store, most PDF viewers.
      chrome.scripting.executeScript.mockRejectedValue(new Error("Cannot access contents"));
      rightClick();
      expect((await pending()).error).toBe("restricted");
    });

    it("falls back to the menu's own selectionText on a restricted page", async () => {
      chrome.scripting.executeScript.mockRejectedValue(new Error("Cannot access contents"));
      chrome.tabs.get.mockResolvedValue({ url: "https://pdf.example/x", title: "A PDF" });
      rightClick("  highlighted in a PDF  ");
      const p = await pending();
      expect(p.error).toBeUndefined();
      expect(p.capture).toMatchObject({
        text: "highlighted in a PDF",
        context: "",
        url: "https://pdf.example/x",
        title: "A PDF",
      });
    });

    it("survives a tab that has gone away during the fallback", async () => {
      chrome.scripting.executeScript.mockRejectedValue(new Error("no access"));
      chrome.tabs.get.mockRejectedValue(new Error("No tab with id"));
      rightClick("some text");
      expect((await pending()).capture).toMatchObject({ text: "some text", url: "", title: "" });
    });

    it("keeps the error when the fallback text is only whitespace", async () => {
      chrome.scripting.executeScript.mockRejectedValue(new Error("no access"));
      rightClick("   ");
      expect((await pending()).error).toBe("restricted");
    });

    it("does not reject when no panel is listening for the broadcast", async () => {
      chrome.scripting.executeScript.mockResolvedValue([{ result: capture }]);
      chrome.runtime.sendMessage.mockRejectedValue(new Error("Receiving end does not exist"));
      rightClick();
      await expect(pending()).resolves.toBeTruthy();
    });
  });
});
