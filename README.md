# Gloss

Select text on any page, press a key, and get an explanation in a side panel —
with the surrounding paragraph as context, so a single highlighted word is
understood in the sense the page actually meant.

See [PLAN.md](./PLAN.md) for the full roadmap.

## Status

Milestones **M0–M5**, **M7** and **M8** are built. Deep-link mode (M6) was
deferred — the in-panel chat covers the need.

See [`store/LISTING.md`](./store/LISTING.md) for submission copy and the
pre-submission checklist, and [`PRIVACY.md`](./PRIVACY.md) for the policy.

**Providers:** Claude, Gemini, OpenRouter, OpenAI, and a local Ollama. Gemini and
OpenRouter both have genuinely free tiers, so Gloss is usable without spending
anything.

## Install (unpacked)

```bash
npm install
npm run build
```

Then in Edge:

1. Go to `edge://extensions`
2. Turn on **Developer mode**
3. **Load unpacked** → select the `dist/` folder
4. Open the extension's **Settings**, pick a provider, paste its API key, click
   **Save**, and approve the host permission prompt

Host access is requested per provider, only when you enable one — so Gloss never
holds permissions for services you don't use.

**Free options:** a [Google AI Studio](https://aistudio.google.com/apikey) key has
a free tier, and [OpenRouter](https://openrouter.ai/keys) model ids ending in
`:free` cost nothing.

## Use

Highlight text on any page, then either:

- press **Ctrl+Shift+K**, or
- right-click the selection and choose **Ask Gloss**

The panel opens and answers immediately. Ask follow-ups in the composer;
Enter sends, Shift+Enter adds a newline.

If the shortcut is already taken, rebind it at `edge://extensions/shortcuts`.

## Develop

```bash
npm run dev        # vite build --watch
npm run typecheck
npm run deploy     # build, then mirror dist/ to the Windows side for Edge
npm run icons      # regenerate icons and the 300x300 store logo
npm run package    # build, then write store/gloss-<version>.zip for upload
```

After a rebuild, hit reload on the extension card in `edge://extensions`.
Changes to `background.js` always need that reload; panel changes usually just
need the panel reopened.

## Layout

| Path | Role |
|---|---|
| `src/background/` | Service worker: triggers, injection, capture handoff |
| `src/providers/` | One file per wire format; `registry.ts` is the catalogue |
| `src/sidepanel/` | The chat UI |
| `src/options/` | Settings page |
| `src/prompts/` | Default system prompt and action templates |
| `src/store/` | Keys (local), settings (sync), history (IndexedDB) |

## Notes for future me

- `chrome.sidePanel.open()` **must** be called before any `await` in a trigger
  handler. One await ahead of it and Chrome rejects the call as a non-gesture.
- `captureSelection()` is serialized into the page, so it must stay
  self-contained — no imports, no closures, no module-scope references.
- The capture is handed over via `chrome.storage.session`, not a message. The
  panel needs ~100ms to boot, so a broadcast alone loses the race on a cold open.
- API keys go in `storage.local`, never `storage.sync`.
- Actions and the system prompt live under their own `storage.sync` keys, not
  inside `gloss:settings` — sync caps each item at 8KB and long custom templates
  would eventually breach it.
- A template that mentions `{context}` suppresses the automatic context block,
  so custom templates can place it themselves without sending it twice.
- Two different `saveThread`s exist: `store/thread.ts` is the session copy used
  for the panel-reopen check, `store/history.ts` is durable history. The panel
  imports the latter as `recordThread`.
- Model ids drift constantly. Every provider accepts a typed-in model id in
  settings, so a stale list in `registry.ts` is an inconvenience, not a breakage.
