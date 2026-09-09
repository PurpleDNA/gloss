# Gloss

**Highlight any text, get a plain-English explanation — in context, without leaving the page.**

[Privacy policy](https://purpledna.github.io/gloss/privacy) · [Website](https://purpledna.github.io/gloss/)

---

Highlight a word or a passage on any page, right-click, and choose **Ask Gloss**. A side
panel opens with an explanation already arriving. Ask follow-ups. Close it. You never
left the page.

## Why not just copy-paste into a chatbot

Gloss sends the paragraph **around** your selection, not just the selection.

Highlight one unfamiliar word and the model receives the sentence it sat in, the page
title, and the URL — so you get what the word means *there*, not a dictionary entry that
might be about something else entirely. That difference is the whole point of the
extension, and it costs about thirty lines of DOM traversal.

Answers are deliberately short — three or four sentences, then you ask for more if you
want it. An answer you finish reading beats a thorough one you abandon.

## Bring your own AI

You supply an API key. Requests go straight from your browser to that provider; there is
no intermediary server.

| Provider | Free option |
|---|---|
| **Claude** (Anthropic) | — |
| **Gemini** (Google) | Free tier from [AI Studio](https://aistudio.google.com/apikey) |
| **OpenRouter** | Models with ids ending `:free` |
| **OpenAI** | — |
| **Ollama** | Fully local, nothing leaves your machine |

Gemini and OpenRouter both have genuinely free tiers, so Gloss is usable without spending
anything. Note that free tiers generally allow the provider to review or train on
submitted content — the trade-off is stated on each provider card in Settings.

## Install

Not yet published to a store. To run it from source:

```bash
git clone https://github.com/PurpleDNA/gloss.git
cd gloss
npm install
npm run build
```

Then in Edge or Chrome:

1. Open `edge://extensions` (or `chrome://extensions`)
2. Enable **Developer mode**
3. **Load unpacked** → select the `dist/` folder
4. Open the extension's **Settings**, pick a provider, paste its API key, click **Save**,
   and approve the host permission prompt

## Use

Highlight text on any page, right-click it, and choose **Ask Gloss**.

- <kbd>Enter</kbd> sends a follow-up, <kbd>Shift</kbd>+<kbd>Enter</kbd> adds a newline
- The wave button transcribes speech instead of typing
- Past conversations are searchable under **History** in the hamburger menu
- **Keyboard shortcut:** none is assigned by default, deliberately — every common
  chord already means something in a browser. Assign your own at
  `edge://extensions/shortcuts` (or `chrome://extensions/shortcuts`).

## Privacy

No servers, no accounts, no analytics. Nothing reaches the developer, because there is
nowhere for it to go.

- **No content scripts.** Gloss reads a page only at the moment you invoke it, only on
  that tab, using `activeTab`. It requests no site access at install.
- **Host permissions are per-provider and optional**, requested when you enable a
  provider — never at install, and never for providers you don't use.
- **API keys live in `storage.local`** and are deliberately excluded from browser sync.
- **History stays in IndexedDB** on your machine, with retention and purge controls.

What *is* sent, to whom, and what it means for free tiers and voice input is spelled out
in the [privacy policy](https://purpledna.github.io/gloss/privacy).

## Development

```bash
npm run dev        # vite build --watch
npm run typecheck
npm run build
npm run icons      # regenerate icons and the store logo
npm run docs       # regenerate the published privacy page from PRIVACY.md
npm run package    # build, then write store/gloss-<version>.zip
```

After a rebuild, hit reload on the extension card. Changes to `background.js` always need
that; panel changes usually just need the panel reopened.

<details>
<summary>Developing under WSL</summary>

Edge runs on the Windows side and loads unpacked extensions unreliably from
`\\wsl.localhost` paths, so `npm run deploy` mirrors `dist/` onto the Windows filesystem.
It detects your Windows home automatically; to send it somewhere else, either set
`GLOSS_WIN_DIR` or create a gitignored `.env.local`:

```
GLOSS_WIN_DIR=/mnt/c/Users/you/somewhere/gloss
```

</details>

## Architecture

| Path | Role |
|---|---|
| `src/background/` | Service worker: triggers, injection, capture handoff |
| `src/providers/` | One file per wire format; `registry.ts` is the catalogue |
| `src/sidepanel/` | The chat UI |
| `src/options/` | Settings page |
| `src/prompts/` | Default system prompt and question template |
| `src/store/` | Keys (local), settings (sync), history (IndexedDB) |

Built with Vite, Preact and TypeScript. No runtime dependencies beyond Preact — icons,
Markdown rendering, PNG generation and zip packaging are all hand-rolled, because the
stores forbid remote code and a dependency per glyph isn't worth it.

Five providers are covered by **two** adapters: `anthropic`, `gemini`, and
`openai-compatible` — the last is a factory parameterized by base URL, which handles
OpenAI, OpenRouter, Groq, DeepSeek, Together and a local Ollama. Adding a provider that
speaks one of those formats is an entry in `registry.ts`, not a new file.

## Implementation notes

Things that are easy to break and hard to debug:

- **`chrome.sidePanel.open()` must be called before any `await`** in a trigger handler.
  Chrome ties it to the gesture's task; one await ahead of it and the call is rejected.
- **`captureSelection()` is serialized into the page**, so it must stay self-contained —
  no imports, no closures, no module-scope references. Worth re-checking the minified
  `background.js` after any change to it, since breakage here is silent.
- **The capture is handed over via `chrome.storage.session`, not a message.** The panel
  needs ~100ms to boot, so a broadcast alone loses the race on a cold open.
- **The pending capture outlives the panel**, so a reopen looks identical to a fresh
  trigger. The saved thread is what distinguishes them — otherwise reopening re-asks
  (and re-charges) for an answer you already have.
- **API keys go in `storage.local`, never `storage.sync`.**
- **A template mentioning `{context}` suppresses the automatic context block**, so custom
  templates can place it themselves without sending it twice.
- **Model ids drift constantly.** Every provider accepts a typed-in model id in Settings,
  so a stale list in `registry.ts` is an inconvenience, not a breakage.

## Status

Working and in use, not yet published to a store. See [`PLAN.md`](./PLAN.md) for the
build log and what remains.

## License

[MIT](./LICENSE)
