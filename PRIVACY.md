# Gloss — Privacy Policy

**Last updated:** 9 September 2026
**Applies to:** Gloss browser extension, all versions

## The short version

Gloss has no servers, no accounts, and no analytics. Nothing is sent to us,
because there is no "us" to send it to.

Gloss does send text to the AI provider **you** choose and configure with **your
own** API key. It only ever does so when you explicitly invoke it. This policy
explains exactly what is sent, to whom, and what stays on your machine.

## What Gloss collects

**Nothing.** The developer of Gloss receives no data of any kind. There is no
backend service, no telemetry, no crash reporting, and no usage tracking.

## What is sent, and to whom

### 1. To the AI provider you configure

When you invoke Gloss on a selection, the following is sent to the provider you
selected in Settings, authenticated with the API key you supplied:

| Sent                    | Detail                                       |
| ----------------------- | -------------------------------------------- |
| The highlighted text    | Up to 8,000 characters                       |
| Surrounding page text   | Up to 2,000 characters around your selection |
| Page title              | As shown in the browser tab                  |
| Page URL                | The full address of the page                 |
| Your follow-up messages | Anything you type or dictate into the panel  |

The surrounding text is included so the model can tell which sense of a word the
page meant. It is taken from the area around your selection, not the whole page.

**Be aware:** on a page you are signed in to, the surrounding text may contain
information you did not deliberately select. Gloss cannot tell a public article
from a private dashboard. If you are working with confidential material, disable
Gloss or use a local provider (see below).

Requests go directly from your browser to the provider. They do not pass through
any intermediary.

Each provider handles your data under its own policy:

- **Anthropic (Claude)** — https://www.anthropic.com/legal/privacy
- **Google (Gemini)** — https://policies.google.com/privacy
- **OpenAI** — https://openai.com/policies/privacy-policy
- **OpenRouter** — https://openrouter.ai/privacy
- **Ollama** — runs locally on your own machine; nothing leaves it

**Free tiers are not free of cost to your privacy.** Google's free Gemini tier
allows human review of submitted content and use of it to improve their
products; their paid tier does not. Some OpenRouter models marked `:free` are
free because the host may log and train on prompts. If this matters to you, use
a paid tier or run Ollama locally.

### 2. To your browser's speech service (voice input only)

If you use the voice button, your audio is transcribed by the Web Speech API
built into your browser. **This is not on-device transcription.** Chromium
browsers stream the audio to a remote speech service operated by the browser
vendor — Microsoft in Edge, Google in Chrome. That audio does not reach Gloss or
your AI provider, but it does leave your machine.

Voice input is entirely optional. Never press the wave button and no audio is
ever captured.

## What is stored on your device

Nothing here is transmitted anywhere.

| Data                 | Where                    | Notes                                                                                                                                                       |
| -------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API keys             | `chrome.storage.local`   | **Never synced.** Deliberately excluded from browser sync so keys stay on one machine.                                                                      |
| Settings             | `chrome.storage.sync`    | Provider, model, theme, prompt text. If you are signed into your browser, these sync across your devices through your browser vendor. No keys are included. |
| Conversation history | IndexedDB                | Selections, page titles, URLs, and full conversations. Stored unencrypted, indefinitely, unless you change the retention setting.                           |
| Current thread       | `chrome.storage.session` | Cleared when the browser closes.                                                                                                                            |

Anyone with access to your browser profile on disk can read all of this. That is
true of browser data generally, but worth stating plainly given history records
every page you have asked about.

## Permissions, and why each exists

| Permission                   | Why                                                                                                                                                                                                                  |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `activeTab`                  | Reads the selected text — **only** on the tab where you invoke Gloss, and **only** at the moment you invoke it. Gloss has no standing access to any page.                                                            |
| `scripting`                  | Runs the one-shot function that reads the selection.                                                                                                                                                                 |
| `contextMenus`               | Adds the "Ask Gloss" right-click item.                                                                                                                                                                               |
| `sidePanel`                  | Opens the panel.                                                                                                                                                                                                     |
| `storage`                    | Saves your settings, keys, and history locally.                                                                                                                                                                      |
| `identity`                   | Used for one thing: the "Connect OpenRouter" sign-in, which opens OpenRouter's own approval page in a tab and receives the key it mints back. It reads nothing about your browser profile or your signed-in accounts. |
| Host access to provider APIs | Requested **only** when you enable a provider, and only for that provider's API endpoint. This permits network requests to that API. It grants no access to your browsing — an API endpoint is not a site you visit. |

Gloss registers **no content scripts** and requests **no site access at install
time**. It cannot read pages you have not explicitly invoked it on.

## Your controls

In **Settings**:

- **Save conversations to history** — turn history off entirely
- **Delete threads older than** — 7, 30, or 90 days, or never
- **Clear all history** — removes every stored thread
- **Delete API key / Delete all keys** — removes stored credentials
- **Reset settings** — restores defaults

In the panel's **History** view, individual threads can be deleted.

Uninstalling Gloss removes all locally stored data, including keys and history.

Data already sent to an AI provider is governed by that provider's policy and
retention rules — contact them to request its deletion.

## Children

Gloss is not directed at children and collects no data from anyone, including
children.

## Changes

Material changes to this policy will be reflected in an updated date above and
in the extension's release notes.

## Contact

Questions about this policy: kadirimaroof@gmail.com
