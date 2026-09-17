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
| Extension logo | 1:1, 300×300 recommended (128×128 minimum) — **required** | `store/assets/logo-300.png` ✅ |
| Screenshots | 1280×800 or 640×480, up to 6 — optional but do it | `store/screenshots/upload/` ✅ |
| Small promotional tile | 440×280 PNG — optional | `store/assets/promo-440x280.png` ✅ |
| Large promotional tile | 1400×560 PNG — optional | `store/assets/promo-1400x560.png` ✅ |
| YouTube video URL | optional | None |

Logos come from `npm run icons`, the promotional tiles from `npm run tiles`, and
screenshots are normalised to the exact size by `npm run screenshots`.

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

## Privacy page answers

The Partner Center **Privacy** page has five sections. Answers for each, in
order. These must stay consistent with `PRIVACY.md` — Microsoft treats an
inaccurate disclosure here as a policy violation, not a typo.

### Single Purpose

```
Gloss explains text the user highlights on a web page. The user selects text,
invokes Gloss from the right-click menu or a keyboard shortcut, and a side panel
shows a short plain-English explanation of that text as it is used in the
surrounding paragraph. Follow-up questions continue in the same panel.

That is the extension's only function. It has no server and no account. The
selected text, the paragraph around it, and the page title and URL are sent
directly from the user's browser to the AI provider the user configured with
their own API key. Nothing is sent to the developer.
```

### Permission justification

One text box per permission, generated from the manifest. Be literal:

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

### Are you using remote code?

**No, I am not using remote code.** Everything executes from the package; no
external scripts are loaded. (MV3 forbids it anyway.)

### Data usage

**Tick: Website content** — the selected text, the surrounding paragraph, and
the page title and URL, transmitted to the provider the user configured.

Leave unticked: personally identifiable information, health, financial,
authentication information, personal communications, location, user activity,
web history.

Two of those are judgement calls rather than omissions, so the reasoning is
recorded here:

- **Web history** — the current page's URL and title ride along with each
  request. That is one page, only when invoked, not a record of browsing, so
  "website content" covers it. Ticking it as well would be the conservative
  reading.
- **Authentication information** — the API key is the user's own, stored in
  `storage.local`, deliberately excluded from sync, and leaves the device only
  as the auth header to the provider it belongs to. The developer collects
  nothing. Ticking it would put a misleading label on the listing. If a reviewer
  raises it: the credential is user-supplied and goes only to the service it
  authenticates against.

Then tick every statement under **I certify that the following disclosures are
true**. All are true: nothing is sold or transferred to third parties beyond the
provider the user chose, nothing is used outside the single purpose, and nothing
touches creditworthiness or lending.

### Privacy policy URL

```
https://purpledna.github.io/gloss/privacy
```

---

## Properties page

| Field | Value |
|---|---|
| Category | Productivity |
| Website | `https://purpledna.github.io/gloss/` |
| Support contact detail | `https://github.com/PurpleDNA/gloss/issues` — the field takes a URL or an email, and is optional |
| Mature content | No |

Note that the privacy policy page carries a contact email, and that URL is
mandatory — so the support field alone does not keep an address off the listing.

---

## Notes for certification

The last box before submitting. Worth using:

```
Gloss registers no content scripts and requests no host permissions at install.
It reads a page only at the moment the user invokes it, on that tab only, via
activeTab plus a single one-shot scripting call.

The extension has no backend. Text the user asks about goes directly from their
browser to the AI provider they configured with their own API key. Nothing is
transmitted to the developer, and there is no server that could receive it.

To test: open the side panel and either paste an API key for any provider in
Settings, or use "Connect OpenRouter", which mints a free key through
OpenRouter's own OAuth approval page. OpenRouter has models that cost nothing,
so no payment is needed to exercise the extension. Then highlight text on any
page, right-click, and choose "Ask Gloss".

The identity permission is used only for that OpenRouter sign-in
(launchWebAuthFlow against openrouter.ai). It reads no profile or account data.
```

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
