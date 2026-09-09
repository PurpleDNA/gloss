# Gloss — Build Plan

> Select text on any page → press a key → a side panel opens with an AI already
> answering, in context. Ask follow-ups. Close. Never leave the page.

**Status:** planning · **Target:** Microsoft Edge Add-ons (Chrome Web Store compatible)

---

## 1. Product decisions (locked)

| Decision | Choice |
|---|---|
| Auth | BYOK API key **and** deep-link handoff; user switches in settings |
| Providers | Multi-provider from day one; Claude is the deep-link default |
| UI surface | `chrome.sidePanel` |
| Triggers | Keyboard shortcut (`Ctrl+Shift+K`) + right-click menu item |
| History | Per-selection threads, saved locally, with in-extension purge controls |
| Prompting | Preset actions (Explain / Define / Summarize / Translate) as editable templates + free text |
| Distribution | Public, Edge Add-ons |

---

## 2. The permission model (this is the load-bearing decision)

**No content scripts. No `host_permissions` at install time.**

Both chosen triggers grant `activeTab` at the moment of invocation. So the extension
gets a one-shot, user-initiated grant on exactly the tab you invoked it on, and nothing
else — ever.

```jsonc
{
  "permissions": ["activeTab", "scripting", "contextMenus", "sidePanel", "storage"],
  "optional_host_permissions": [
    "https://api.anthropic.com/*",
    "https://api.openai.com/*",
    "https://generativelanguage.googleapis.com/*",
    "https://openrouter.ai/*"
  ]
}
```

Provider hosts are requested via `chrome.permissions.request()` from a user gesture in
Settings, only when that provider is enabled. Review sees an extension that asks for
almost nothing up front. The privacy policy gets to say, truthfully: *no data is
collected, no page is read unless you invoke it, keys never leave your machine.*

> **Deferred to v1.1:** user-supplied custom OpenAI-compatible endpoints. That needs
> `*://*/*` in optional hosts, which invites review scrutiny. Ship the fixed list first,
> add it once v1 is approved.

---

## 3. Architecture

```
gloss/
├── manifest.json
├── src/
│   ├── background/
│   │   ├── index.ts            # commands, contextMenus, sidePanel.open, capture orchestration
│   │   └── capture.ts          # self-contained fn injected via chrome.scripting
│   ├── sidepanel/
│   │   ├── index.html
│   │   ├── App.tsx
│   │   └── components/         # Thread, Composer, ActionBar, SelectionCard, HistoryList
│   ├── options/                # settings: providers, keys, templates, data controls
│   ├── providers/
│   │   ├── types.ts            # Provider interface
│   │   ├── anthropic.ts
│   │   ├── openai-compatible.ts
│   │   ├── gemini.ts
│   │   ├── registry.ts         # catalog: id, label, models, baseUrl, adapter, keyUrl
│   │   └── deeplink.ts         # {q} URL templates
│   ├── store/
│   │   ├── settings.ts         # chrome.storage.sync
│   │   ├── keys.ts             # chrome.storage.local — NEVER sync
│   │   └── history.ts          # IndexedDB
│   ├── prompts/templates.ts
│   └── lib/{sse.ts,messaging.ts,markdown.ts}
└── vite.config.ts
```

**Stack:** Vite + `@crxjs/vite-plugin` + Preact + TypeScript. Preact keeps the bundle
small; if crxjs misbehaves, fall back to a manual multi-entry Vite config plus a manifest
copy step. **All code bundled — the store forbids remote code, so no CDN script tags.**

---

## 4. Core flows

### 4.1 Trigger → capture → panel

1. `chrome.commands.onCommand` or `contextMenus.onClicked` fires in the service worker.
2. `chrome.sidePanel.open({ tabId })` — **must be called synchronously in the gesture's
   task**, before any `await`, or Chrome rejects it. This is the #1 bug to expect.
3. `chrome.scripting.executeScript({ target: { tabId, allFrames: true }, func: captureSelection })`
   → returns one result per frame; take the first non-empty.
4. Write the capture to `chrome.storage.session` keyed by tabId.
5. Panel mounts, reads `storage.session`, renders the selection card, auto-fires the
   default action.

> Step 4 is storage-first on purpose. The panel takes ~100ms to boot, so a
> `runtime.sendMessage` broadcast races and loses. Storage handoff always wins.

### 4.2 The injected capture function

Must be fully self-contained — it's serialized into the page, so no closures over
extension code.

```ts
function captureSelection() {
  const sel = window.getSelection();
  const text = sel?.toString().trim() ?? "";
  if (!text) return null;

  // climb to an ancestor with enough surrounding prose to disambiguate
  let el = sel.anchorNode?.nodeType === 3
    ? sel.anchorNode.parentElement
    : (sel.anchorNode as Element | null);
  while (el?.parentElement && (el.textContent?.length ?? 0) < 400) el = el.parentElement;

  return {
    text: text.slice(0, 8000),
    context: (el as HTMLElement)?.innerText?.slice(0, 2000) ?? "",
    url: location.href,
    title: document.title,
  };
}
```

**This is the feature.** Highlight one word like "hysteresis" and the model receives the
paragraph, the page title, and the URL — so it explains *this* usage, not the dictionary
entry. That's the entire advantage over copy-paste, and it costs ~30 lines.

### 4.3 Streaming

Run `fetch` **from the side panel document, not the service worker.** MV3 kills an idle
worker after 30s, which would sever a long stream mid-answer. The side panel is a real
page and lives as long as it's open.

- Small hand-rolled SSE parser over `response.body.getReader()`
- `AbortController` behind a Stop button
- Anthropic needs: `x-api-key`, `anthropic-version: 2023-06-01`, and
  `anthropic-dangerous-direct-browser-access: true`

*Escape hatch:* if any provider rejects browser-origin requests, proxy that one through
the service worker and stream back over a `chrome.runtime.connect` port.

### 4.4 Provider adapters — three, not seven

| Adapter | Covers |
|---|---|
| `anthropic` | Claude |
| `openai-compatible` | OpenAI, OpenRouter, Groq, DeepSeek, Together, xAI, Ollama |
| `gemini` | Google |

```ts
interface Provider {
  id: string;
  stream(msgs: Message[], o: { model: string; signal: AbortSignal }):
    AsyncIterable<{ type: "text"; delta: string }>;
}
```

`openai-compatible` is one adapter parameterized by base URL. That single file unlocks
dozens of providers including **every free model on OpenRouter**.

**Free tier without paying for infrastructure:** Google AI Studio issues free Gemini keys,
and OpenRouter exposes `:free` model variants. Both BYOK. Onboarding links straight to
both key pages, so a new user reaches a working extension without a credit card and
without us running a proxy.

### 4.5 Deep-link mode

User-editable URL templates with a `{q}` placeholder, opened via
`chrome.windows.create({ type: "popup", width: 480 })` for the wallet-window feel.

```
claude.ai/new?q={q}          ← default
chatgpt.com/?q={q}
perplexity.ai/search?q={q}
```

Templates are editable so a provider changing its URL scheme is a settings tweak, not a
release. **Note:** Gemini's web UI has no reliable prefill parameter — it needs a
copy-to-clipboard-then-open fallback.

---

## 5. Storage & data controls

| Store | Holds | Why |
|---|---|---|
| `storage.sync` | settings, templates, deep-link URLs | follows the user across devices |
| `storage.local` | **API keys** | never sync — keys must not traverse sync servers |
| IndexedDB | conversation threads | unbounded, structured, queryable |
| `storage.session` | pending capture | in-memory, dies with the browser |

**Settings → Data** (explicitly requested):
- Clear all conversation history
- Delete stored keys — per provider, or all
- Reset settings to defaults
- Live storage usage via `getBytesInUse()` + `navigator.storage.estimate()`
- Optional auto-purge of threads older than N days
- Per-thread delete + swipe-to-delete in the history list

---

## 6. Milestones

| # | Deliverable | Exit criterion |
|---|---|---|
| M0 ✅ | Scaffold, manifest, build | `Ctrl+Shift+K` opens an empty side panel |
| M1 ✅ | Capture pipeline | Selection + context + URL render in the panel |
| M2 ✅ | Anthropic streaming | Answer streams in; follow-ups work |
| M3 ✅ | Provider abstraction + settings | Switch Claude ↔ Gemini ↔ OpenRouter; keys persist; permissions requested on enable |
| M4 ✅ | Preset actions | Explain/Define/Summarize/Translate, all editable |
| M5 ✅ | History + data controls | Threads persist, browse, and purge |
| M6 ⏸ | Deep-link mode | Popup window opens prefilled |
| M7 ✅ | Polish | Markdown + code highlighting, dark mode, error/empty/no-key states, cost estimate |
| M8 ✅ | Store prep | Privacy policy, icons, screenshots, listing copy, submission |

M0–M2 is the usable-today core. Everything after is what makes it publishable.

---

## 7. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| `sidePanel.open()` outside a gesture task | High — silently fails | Call before any `await`; assert in dev |
| Review flags BYOK / permissions | Medium | Minimal perms, optional hosts, explicit privacy policy |
| Restricted pages (`edge://`, store, PDFs) | Medium | Detect and show a clear "can't read this page" state |
| Selection inside cross-origin iframes | Low | `allFrames: true`, pick first non-empty result |
| API key readable from disk | Medium | Documented plainly; offer session-only mode; proxy is the future answer |
| Provider CORS rejection | Low | Per-provider SW proxy fallback over a port |
| Runaway token cost on huge selections | Low | Hard cap + visible token/cost estimate before send |
