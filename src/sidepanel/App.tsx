import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { PENDING_KEY, type Capture, type PendingCapture } from "../lib/types";
import { hasHostPermission, requestHostPermission } from "../lib/permissions";
import { applyTheme, type Theme } from "../lib/theme";
import { PROVIDERS, getProvider } from "../providers/registry";
import type { ChatMessage } from "../providers/types";
import { getConfiguredProviders, getKey } from "../store/keys";
import { getSettings, modelFor, saveSettings, type Settings } from "../store/settings";
import { loadThread, saveThread } from "../store/thread";
import { purgeOlderThan, saveThread as recordThread, type HistoryThread } from "../store/history";
import { buildPrompt } from "../prompts/templates";
import { PROMPT_KEYS, getSystemPrompt, getTemplate } from "../store/prompts";
import { Thread } from "./components/Thread";
import { Composer } from "./components/Composer";
import { HistoryList } from "./components/HistoryList";
import { Menu } from "./components/Menu";
import { Logo, MenuIcon } from "./components/Icons";

export function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [granted, setGranted] = useState<boolean | null>(null);
  const [configured, setConfigured] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<PendingCapture | null>(null);
  /** A thread reopened from history, which takes over from the live trigger. */
  const [opened, setOpened] = useState<HistoryThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [template, setTemplate] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");

  const abort = useRef<AbortController | null>(null);
  /** Trigger ids we have already answered, so a panel reopen is not a re-ask. */
  const handledFor = useRef<string | null>(null);
  const settingsWindow = useRef<number | null>(null);

  const provider = settings ? getProvider(settings.providerId) : null;

  const activeId = opened?.id ?? pending?.id;
  const capture: Capture | null = opened
    ? {
        text: opened.selection,
        context: "",
        url: opened.url,
        title: opened.title,
        capturedAt: opened.createdAt,
      }
    : (pending?.capture ?? null);

  useEffect(() => {
    void (async () => {
      const s = await getSettings();
      setSettings(s);
      applyTheme(s.theme);
      setTemplate(await getTemplate());
      setSystemPrompt(await getSystemPrompt());
      setConfigured(await getConfiguredProviders());
      setApiKey(await getKey(s.providerId));
      setGranted(await hasHostPermission(getProvider(s.providerId).origin));

      // Retention is enforced on open — cheap, and there is no other reliable
      // moment to run it without keeping the service worker alive.
      if (s.historyRetentionDays) void purgeOlderThan(s.historyRetentionDays);

      const stored = await chrome.storage.session.get(PENDING_KEY);
      const p = stored[PENDING_KEY] as PendingCapture | undefined;
      if (!p) return;

      // The pending capture outlives the panel, so on reopen it looks identical
      // to a fresh trigger. The saved thread is what tells the two apart.
      const thread = await loadThread();
      if (thread?.pendingId === p.id) {
        handledFor.current = p.id;
        setMessages(thread.messages);
      }
      setPending(p);
    })();

    const onMessage = (msg: unknown) => {
      const m = msg as { type?: string; pending?: PendingCapture };
      if (m?.type === "gloss:pending" && m.pending) setPending(m.pending);
    };
    chrome.runtime.onMessage.addListener(onMessage);

    const onStorage = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === "local" && Object.keys(changes).some((k) => k.startsWith("gloss:key:"))) {
        void (async () => {
          setConfigured(await getConfiguredProviders());
          const s = await getSettings();
          setApiKey(await getKey(s.providerId));
        })();
      }
      // The options page can change the theme too.
      if (area === "sync" && "gloss:settings" in changes) {
        void getSettings().then((s) => {
          setSettings(s);
          applyTheme(s.theme);
        });
      }
      if (area === "sync" && PROMPT_KEYS.some((k) => k in changes)) {
        void (async () => {
          setTemplate(await getTemplate());
          setSystemPrompt(await getSystemPrompt());
        })();
      }
    };
    chrome.storage.onChanged.addListener(onStorage);

    const onWindowClosed = (id: number) => {
      if (settingsWindow.current === id) settingsWindow.current = null;
    };
    chrome.windows.onRemoved.addListener(onWindowClosed);

    return () => {
      chrome.runtime.onMessage.removeListener(onMessage);
      chrome.storage.onChanged.removeListener(onStorage);
      chrome.windows.onRemoved.removeListener(onWindowClosed);
    };
  }, []);

  // Granting a permission fires no storage event, so without this the panel keeps
  // showing "one permission left" after the user has already allowed it elsewhere.
  useEffect(() => {
    if (!provider) return;
    const recheck = () => void hasHostPermission(provider.origin).then(setGranted);

    // @types/chrome omits removeListener on these two events; the runtime has it.
    type PermEvent = { addListener(cb: () => void): void; removeListener(cb: () => void): void };
    const added = chrome.permissions.onAdded as unknown as PermEvent;
    const removed = chrome.permissions.onRemoved as unknown as PermEvent;

    added.addListener(recheck);
    removed.addListener(recheck);
    // Belt and braces: a grant made while the panel was hidden lands on focus.
    window.addEventListener("focus", recheck);
    return () => {
      added.removeListener(recheck);
      removed.removeListener(recheck);
      window.removeEventListener("focus", recheck);
    };
  }, [provider?.id]);

  const switchProvider = async (providerId: string) => {
    const next = await saveSettings({ providerId });
    setSettings(next);
    setApiKey(await getKey(providerId));
    setGranted(await hasHostPermission(getProvider(providerId).origin));
    setError(null);
  };

  const switchTheme = async (theme: Theme) => {
    applyTheme(theme);
    setSettings(await saveSettings({ theme }));
  };

  const switchModel = async (model: string) => {
    if (!settings || !provider) return;
    setSettings(await saveSettings({ models: { ...settings.models, [provider.id]: model } }));
  };

  const run = useCallback(
    async (content: string, base: ChatMessage[]) => {
      if (!settings || !apiKey || !provider) return;

      const id = activeId;
      const meta = capture;
      if (id) handledFor.current = id;

      const convo: ChatMessage[] = [...base, { role: "user", content }];
      setMessages([...convo, { role: "assistant", content: "" }]);
      setStreaming(true);
      setError(null);

      // Session copy: if the panel is closed mid-stream, the reopen should show
      // the question rather than silently firing it again. Only the live trigger
      // owns this slot — a reopened history thread must not overwrite it.
      const persist = (msgs: ChatMessage[]) => {
        if (!opened && pending?.id) void saveThread({ pendingId: pending.id, messages: msgs });
      };

      const record = (msgs: ChatMessage[]) => {
        if (!settings.historyEnabled || !id || !meta) return;
        void recordThread({
          id,
          createdAt: opened?.createdAt ?? meta.capturedAt,
          updatedAt: Date.now(),
          selection: meta.text,
          title: meta.title,
          url: meta.url,
          providerId: provider.id,
          model: modelFor(settings, provider.id),
          messages: msgs,
        });
      };

      persist(convo);

      const controller = new AbortController();
      abort.current = controller;
      let acc = "";

      try {
        for await (const delta of provider.adapter(convo, {
          apiKey,
          model: modelFor(settings, provider.id),
          system: systemPrompt,
          maxTokens: settings.maxTokens,
          signal: controller.signal,
        })) {
          acc += delta;
          setMessages([...convo, { role: "assistant", content: acc }]);
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : String(e));
          if (!acc) setMessages(convo);
        }
      } finally {
        setStreaming(false);
        abort.current = null;
        const final = acc ? [...convo, { role: "assistant" as const, content: acc }] : convo;
        persist(final);
        if (acc) record(final);
      }
    },
    [settings, apiKey, provider, activeId, capture, opened, pending?.id, systemPrompt],
  );

  // A genuinely new trigger drops the old thread and any history view. A reopen
  // of one we already answered does not — handledFor was restored from storage.
  useEffect(() => {
    if (!pending || handledFor.current === pending.id) return;
    abort.current?.abort();
    setOpened(null);
    setShowHistory(false);
    setMessages([]);
    setError(null);
  }, [pending?.id]);

  // ...then ask, once per trigger.
  useEffect(() => {
    if (!pending?.capture || !settings || !apiKey || !granted || opened) return;
    if (!template || !systemPrompt) return;
    if (handledFor.current === pending.id) return;
    handledFor.current = pending.id;
    void run(buildPrompt(template, pending.capture), []);
  }, [pending?.id, settings, apiKey, granted, run, opened, template, systemPrompt]);

  const openFromHistory = (thread: HistoryThread) => {
    abort.current?.abort();
    handledFor.current = thread.id;
    setOpened(thread);
    setMessages(thread.messages);
    setShowHistory(false);
    setError(null);
  };

  // A tab would hide the panel behind it with no way back. A popup floats
  // alongside, so closing it returns you to the conversation.
  const openOptions = () => {
    const url = chrome.runtime.getURL("options.html");
    if (settingsWindow.current !== null) {
      chrome.windows.update(settingsWindow.current, { focused: true }).catch(() => {
        settingsWindow.current = null;
        openOptions();
      });
      return;
    }
    void chrome.windows
      .create({ url, type: "popup", width: 760, height: 900 })
      .then((w) => {
        settingsWindow.current = w?.id ?? null;
      })
      .catch(() => chrome.runtime.openOptionsPage());
  };
  const grant = async () => {
    if (provider) setGranted(await requestHostPermission(provider.origin));
  };

  const ready = Boolean(apiKey && granted);
  const switchable = PROVIDERS.filter((p) => configured.has(p.id) || p.id === settings?.providerId);

  return (
    <div class="app">
      <header class="bar">
        <Logo />
        <span class="brand">Gloss</span>
        <button
          class="icon-btn"
          data-active={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
          title="Menu"
          aria-label="Menu"
          aria-expanded={menuOpen}
        >
          <MenuIcon />
        </button>

        {settings && provider && (
          <Menu
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            providers={switchable}
            provider={provider}
            model={modelFor(settings, provider.id)}
            streaming={streaming}
            onProvider={(id) => void switchProvider(id)}
            onModel={(id) => void switchModel(id)}
            theme={settings.theme}
            onTheme={(t) => void switchTheme(t)}
            onHistory={() => {
              setShowHistory(true);
              setMenuOpen(false);
            }}
            onSettings={() => {
              openOptions();
              setMenuOpen(false);
            }}
          />
        )}
      </header>

      {showHistory ? (
        <HistoryList onOpen={openFromHistory} onClose={() => setShowHistory(false)} />
      ) : (
        <>
          {apiKey === "" && provider && (
            <Notice
              title={`Add a ${provider.label} key to get started`}
              body={
                provider.free
                  ? `${provider.label} has a free tier. Your key is stored locally and sent only to ${provider.label}.`
                  : `Gloss talks to ${provider.label} directly from your browser. Your key is stored locally and never sent anywhere else.`
              }
              action="Open settings"
              onAction={openOptions}
            />
          )}

          {apiKey && granted === false && provider && (
            <Notice
              title="One permission left"
              body={`Gloss needs permission to reach ${provider.origin.replace(/^https?:\/\//, "").replace("/*", "")}. Nothing else is requested.`}
              action="Grant access"
              onAction={grant}
            />
          )}

          {!opened && pending?.error === "restricted" && (
            <Notice
              title="Can't read this page"
              body="Browser pages, the add-ons store, and most PDF viewers block extensions from reading the selection. Try it on a normal web page."
            />
          )}

          {!opened && pending?.error === "empty" && (
            <Notice
              title="Nothing selected"
              body="Highlight some text on the page, then right-click it and choose Ask Gloss."
            />
          )}

          {!pending && !opened && apiKey && (
            <Notice
              title="Highlight something"
              body="Select text on any page, right-click it, and choose Ask Gloss. You can also assign a keyboard shortcut in your browser's extension shortcuts page."
            />
          )}

          <Thread
            messages={messages}
            streaming={streaming}
            selection={capture?.text}
            context={capture?.context}
          />

          {error && <div class="error">{error}</div>}

          <Composer
            disabled={!ready}
            streaming={streaming}
            onSend={(text) => void run(text, messages.filter((m) => m.content))}
            onStop={() => abort.current?.abort()}
          />
        </>
      )}
    </div>
  );
}

function Notice(props: { title: string; body: string; action?: string; onAction?: () => void }) {
  return (
    <div class="notice">
      <strong>{props.title}</strong>
      <p>{props.body}</p>
      {props.action && (
        <button class="primary" onClick={props.onAction}>
          {props.action}
        </button>
      )}
    </div>
  );
}
