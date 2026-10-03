import { captureSelection } from "./capture";
import { PENDING_KEY, type Capture, type CaptureError, type PendingCapture } from "../lib/types";

const TRIGGER = "gloss-selection";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: TRIGGER,
      title: 'Ask Gloss about "%s"',
      contexts: ["selection"],
    });
  });
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === TRIGGER && tab) trigger(tab);
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === TRIGGER) trigger(tab, info.selectionText, info.pageUrl);
});

function trigger(tab: chrome.tabs.Tab | undefined, fallbackText?: string, pageUrl?: string) {
  // A click inside a PDF viewer reports the viewer's own embedded contents, not
  // the tab around it: no tab at all, or one whose ids are -1. Those can neither
  // open the panel nor be injected into, so fall back to the current window.
  const tabId = tab?.id !== undefined && tab.id >= 0 ? tab.id : undefined;
  const windowId =
    tab?.windowId !== undefined && tab.windowId >= 0 ? tab.windowId : chrome.windows.WINDOW_ID_CURRENT;

  // Synchronous, before anything is awaited. Chrome ties sidePanel.open() to the
  // gesture's task; a single await ahead of it and the call is rejected outright.
  chrome.sidePanel.open(tabId !== undefined ? { tabId } : { windowId }).catch(() => {});
  void capture(tabId, fallbackText, pageUrl);
}

async function capture(knownTabId: number | undefined, fallbackText?: string, pageUrl?: string) {
  let result: Capture | null = null;
  let error: CaptureError | undefined;

  const tab =
    knownTabId === undefined
      ? (await chrome.tabs.query({ active: true, lastFocusedWindow: true }).catch(() => []))[0]
      : undefined;
  const tabId = knownTabId ?? tab?.id ?? chrome.tabs.TAB_ID_NONE;

  try {
    const frames = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: captureSelection,
    });
    result = frames.map((f) => f.result as Capture | null).find((r) => !!r?.text) ?? null;
  } catch {
    // edge://, the add-ons store, most PDF viewers: no script injection allowed.
    error = "restricted";
  }

  // The context menu hands us selectionText even where injection is blocked.
  if (!result && fallbackText?.trim()) {
    const page = tab ?? (await chrome.tabs.get(tabId).catch(() => undefined));
    result = {
      text: fallbackText.trim(),
      context: "",
      url: page?.url || pageUrl || "",
      title: page?.title ?? "",
      capturedAt: Date.now(),
    };
    error = undefined;
  }

  if (!result && !error) error = "empty";

  const pending: PendingCapture = { id: crypto.randomUUID(), tabId, capture: result, error };

  // Storage first: the panel needs ~100ms to boot, so a broadcast alone races and
  // loses on a cold open. The message only matters when the panel is already up.
  await chrome.storage.session.set({ [PENDING_KEY]: pending });
  chrome.runtime.sendMessage({ type: "gloss:pending", pending }).catch(() => {});
}
