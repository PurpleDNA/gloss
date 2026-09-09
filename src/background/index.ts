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
  if (command === TRIGGER && tab?.id) trigger(tab.id);
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === TRIGGER && tab?.id) trigger(tab.id, info.selectionText);
});

function trigger(tabId: number, fallbackText?: string) {
  // Synchronous, before anything is awaited. Chrome ties sidePanel.open() to the
  // gesture's task; a single await ahead of it and the call is rejected outright.
  chrome.sidePanel.open({ tabId });
  void capture(tabId, fallbackText);
}

async function capture(tabId: number, fallbackText?: string) {
  let result: Capture | null = null;
  let error: CaptureError | undefined;

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
    const tab = await chrome.tabs.get(tabId).catch(() => undefined);
    result = {
      text: fallbackText.trim(),
      context: "",
      url: tab?.url ?? "",
      title: tab?.title ?? "",
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
