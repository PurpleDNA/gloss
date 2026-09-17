# Edge Add-ons — Listing Copy & Submission Notes

Everything the Partner Center form asks for. Copy fields verbatim; fill the
bracketed items yourself.

---

## Identity

**Name:** `Gloss`

**Short description** (max 132 chars — this one is 93):

```
Highlight any text and get a plain-English explanation, in context, without leaving the page.
```

**Category:** Productivity
**Language:** English (United States)

---

## Full description

```
Gloss explains what you're reading, where you're reading it.

Highlight a word or a passage on any page, right-click, and choose "Ask Gloss".
A side panel opens with an explanation already arriving. Ask follow-ups. Close
it. You never left the page.

Prefer a keyboard shortcut? Assign one on your browser's extension shortcuts
page. Gloss ships without a default binding so it can't collide with a shortcut
you already use.

WHY IT'S BETTER THAN COPY-PASTE

Gloss sends the paragraph around your selection, not just the selection. So when
you highlight one unfamiliar word, you get what it means *in that sentence* —
not a dictionary entry that might be about something else entirely.

BRING YOUR OWN AI

Gloss works with Claude, Gemini, OpenAI, OpenRouter, or a local Ollama install.
You supply an API key; requests go straight from your browser to that provider.

OpenRouter connects in one click. Approve it once and a key is created on your
own OpenRouter account — nothing to copy, no console to visit. It stays your
key, and you can revoke it any time.

Two providers are genuinely free: OpenRouter has models that cost nothing, and
Google AI Studio issues Gemini keys with a free tier. You can use Gloss without
spending anything.

BUILT TO BE UNOBTRUSIVE

• Explanations are short by default — three or four sentences, then you ask for
  more if you want it. The prompt is fully editable if you prefer otherwise.
• Voice input, if typing is slower than talking.
• Searchable history of everything you've asked, stored on your machine.
• Light and dark themes.

PRIVACY

Gloss has no servers, no account, and no analytics. Nothing is sent to the
developer, because there's nowhere for it to go.

It reads a page only at the moment you invoke it, only on that tab. There are no
content scripts and no site permissions requested at install. Your API keys are
stored locally and are deliberately excluded from browser sync.

Text you ask about goes to the AI provider you chose, under that provider's
privacy policy. Full details in the privacy policy linked below.
```

---

## Store assets

| Asset | Requirement | Status |
|---|---|---|
| Logo | 300×300 PNG | `store/assets/logo-300.png` — generated |
| Small promo tile | 440×280 PNG | Optional; skip for first submission |
| Screenshots | 1280×800 or 640×400, 1–10 images | **You must capture these** — see shot list |

### Screenshot shot list

Capture at 1280×800 with the browser at default zoom. Suggested order — the
first is the one most people will judge the listing on:

1. **The core loop.** A real article open, a technical term highlighted mid-
   paragraph, panel open with a finished explanation. Pick a word whose meaning
   genuinely depends on context, so the value is visible in one glance.
2. **A follow-up conversation.** Same panel, two or three exchanges deep, showing
   it is a conversation and not a one-shot lookup.
3. **Settings — providers.** The provider grid, with the "free tier" badges
   visible on Gemini and OpenRouter.
4. **History.** The history list with several entries and something typed in the
   search box.
5. **Dark mode.** Any of the above, to show the theme exists.

Use a neutral, non-sensitive page. Reviewers do look, and a screenshot of a
private dashboard invites questions.

---

## Privacy & data declarations

Answer the Partner Center form as follows. These match `PRIVACY.md` — keep them
in step if either changes.

| Question | Answer |
|---|---|
| Does your extension collect personal information? | **No** |
| Does it transmit data to remote servers? | **Yes** — to the AI provider the user configures with their own key |
| Is data sold or shared with third parties? | **No** |
| Does it use remote code? | **No** — all code is bundled in the package |
| Privacy policy URL | `https://purpledna.github.io/gloss/privacy` |

**Justification for each permission** (the form asks; be literal):

- `activeTab` — reads the user's text selection on the current tab, only when
  the user presses the keyboard shortcut or clicks the context-menu item.
- `scripting` — injects a single one-shot function to read that selection.
- `contextMenus` — adds the "Ask Gloss" right-click entry.
- `sidePanel` — the extension's entire interface is a side panel.
- `storage` — stores the user's settings, API keys, and local history.
- `identity` — used for exactly one thing: the "Connect OpenRouter" button,
  which opens OpenRouter's own approval page via `launchWebAuthFlow` and
  receives back the API key OpenRouter mints for the user. It reads nothing
  about the browser profile or any signed-in account; no `identity.email`, no
  `getAuthToken`, no Microsoft or Google identity is touched.
- Optional host permissions — network access to the AI provider APIs the user
  chooses to enable. Requested at the time of enabling, never at install.

**Why no content scripts:** worth stating in the reviewer notes field. It is
unusual and it is the strongest thing about this submission.

---

## Hosting the privacy policy

The form requires a public URL. `PRIVACY.md` needs to be reachable on the web.

Fastest route — GitHub Pages:

1. Push this repo to GitHub (public).
2. Settings → Pages → Deploy from branch → `main`, `/root`.
3. The policy lands at `https://<user>.github.io/gloss/PRIVACY` (Pages renders
   Markdown automatically).

Before submitting, replace the contact placeholder at the bottom of
`PRIVACY.md`.

---

## Pre-submission checklist

- [x] Contact email in `PRIVACY.md` — filled in
- [x] Privacy policy hosted — https://purpledna.github.io/gloss/privacy
- [x] Version decided — `1.0.0` (each later submission must increment)
- [x] `npm run test:all` green
- [x] `npm run package` → `store/gloss-1.0.0.zip`
- [ ] Refresh `03-providers.png` to show OpenRouter selected with the Connect
      button — it is the headline of this release and the current shot predates it
- [ ] Consider a sixth shot of the onboarding screen ("Understand anything")
- [ ] Load the packaged zip unpacked one final time
- [ ] Register a Microsoft Partner Center account if you have not
      (free for Edge Add-ons; no developer fee)

## After submitting

Review typically takes a few business days. The likely questions:

- **Why does it need host permissions?** They are optional and per-provider,
  requested only on enabling one. Nothing is requested at install.
- **What is the API key for?** The user's own credential for their own provider
  account. Gloss never sees it; it is stored locally and never synced.
- **BYOK justification.** There is no server, so there is nowhere else a key
  could live.
- **Why `identity`?** Only for OpenRouter's PKCE sign-in, so the user does not
  have to paste a key by hand. The flow is standard OAuth PKCE against
  `openrouter.ai`; the extension receives an API key for the user's own account
  and stores it locally. No identity provider is queried and no profile data is
  read. Everything else in the extension works without it.
