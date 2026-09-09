import { useEffect, useState } from "preact/hooks";
import { hasHostPermission, requestHostPermission } from "../lib/permissions";
import { applyTheme } from "../lib/theme";
import { PROVIDERS, getProvider } from "../providers/registry";
import { PromptsEditor } from "./PromptsEditor";
import { clearAllKeys, clearKey, getConfiguredProviders, getKey, setKey } from "../store/keys";
import { getSettings, modelFor, resetSettings, saveSettings, type Settings } from "../store/settings";
import { clearHistory, countThreads, estimateUsage, purgeOlderThan } from "../store/history";

export function Options() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [configured, setConfigured] = useState<Set<string>>(new Set());
  const [keyDraft, setKeyDraft] = useState("");
  const [reveal, setReveal] = useState(false);
  const [granted, setGranted] = useState(false);
  const [saved, setSaved] = useState("");
  const [threadCount, setThreadCount] = useState(0);
  const [usage, setUsage] = useState("…");
  const [mic, setMic] = useState<string>("checking");

  const provider = settings ? getProvider(settings.providerId) : null;

  useEffect(() => {
    void (async () => {
      const s = await getSettings();
      setSettings(s);
      applyTheme(s.theme);
      await loadProvider(s.providerId);
      await refreshStorage();
      await refreshMic();
    })();

    // Reflect a theme change made from the panel's menu.
    const onStorage = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === "sync" && "gloss:settings" in changes) {
        void getSettings().then((s) => {
          setSettings(s);
          applyTheme(s.theme);
        });
      }
    };
    chrome.storage.onChanged.addListener(onStorage);
    return () => chrome.storage.onChanged.removeListener(onStorage);
  }, []);

  async function refreshMic() {
    try {
      const status = await navigator.permissions.query({
        name: "microphone" as PermissionName,
      });
      setMic(status.state);
    } catch {
      setMic("unknown");
    }
  }

  async function requestMic() {
    try {
      // A plain tab is where Chrome reliably shows the prompt; the side panel
      // may silently deny. Release the stream immediately — we only wanted the
      // grant, the Web Speech API opens its own.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      flash("Microphone allowed");
    } catch {
      flash("Microphone was blocked");
    }
    await refreshMic();
  }

  async function refreshStorage() {
    setThreadCount(await countThreads().catch(() => 0));
    setUsage(await estimateUsage().catch(() => "unknown"));
  }

  async function loadProvider(id: string) {
    setKeyDraft(await getKey(id));
    setConfigured(await getConfiguredProviders());
    setGranted(await hasHostPermission(getProvider(id).origin));
    setReveal(false);
  }

  if (!settings || !provider) return null;

  const flash = (msg: string) => {
    setSaved(msg);
    setTimeout(() => setSaved(""), 1800);
  };

  const patch = async (next: Partial<Settings>) => setSettings(await saveSettings(next));

  const selectProvider = async (id: string) => {
    await patch({ providerId: id });
    await loadProvider(id);
  };

  const saveKey = async () => {
    await setKey(provider.id, keyDraft);
    // Requesting here rides the click gesture, which the API requires.
    let ok = granted;
    if (keyDraft.trim() && !granted) {
      ok = await requestHostPermission(provider.origin);
      setGranted(ok);
    }
    setConfigured(await getConfiguredProviders());
    if (!keyDraft.trim()) flash("Key removed");
    else flash(ok ? "Ready — close this window and ask away" : "Key saved, but host access is still needed");
  };

  const model = modelFor(settings, provider.id);
  const isCustomModel = !provider.models.some((m) => m.id === model);

  return (
    <main class="options-page">
      <h1>Gloss</h1>

      <section>
        <h2>Provider</h2>
        <p class="hint">
          Gloss talks to whichever provider you pick, directly from this browser. Keys are stored
          locally, never synced, and never sent anywhere but that provider.
        </p>
        <div class="providers">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              class="provider"
              data-active={p.id === provider.id}
              onClick={() => void selectProvider(p.id)}
            >
              <span class="provider-name">{p.label}</span>
              {p.free && <span class="badge free">free tier</span>}
              {configured.has(p.id) && <span class="badge ok">key set</span>}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>{provider.label} key</h2>
        {provider.note && <p class="hint">{provider.note}</p>}
        <p class="hint">
          Get one at{" "}
          <a href={provider.keyUrl} target="_blank" rel="noreferrer">
            {new URL(provider.keyUrl).host}
          </a>
          .
        </p>
        <div class="row">
          <input
            type={reveal ? "text" : "password"}
            value={keyDraft}
            placeholder={provider.keyHint}
            spellcheck={false}
            onInput={(e) => setKeyDraft((e.currentTarget as HTMLInputElement).value)}
          />
          <button class="ghost" onClick={() => setReveal(!reveal)}>
            {reveal ? "Hide" : "Show"}
          </button>
          <button class="primary" onClick={() => void saveKey()}>
            Save
          </button>
        </div>
        <p class="hint">
          Host access to {provider.origin.replace(/^https?:\/\//, "").replace("/*", "")}:{" "}
          <strong>{granted ? "granted" : "not granted"}</strong>
          {!granted && (
            <>
              {" — "}
              <button
                class="link"
                onClick={() => void requestHostPermission(provider.origin).then(setGranted)}
              >
                grant now
              </button>
            </>
          )}
        </p>
      </section>

      <section>
        <h2>Model</h2>
        <select
          value={isCustomModel ? "__custom" : model}
          onChange={(e) => {
            const v = (e.currentTarget as HTMLSelectElement).value;
            void patch({
              models: { ...settings.models, [provider.id]: v === "__custom" ? "" : v },
            });
          }}
        >
          {provider.models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
          <option value="__custom">Custom…</option>
        </select>

        {isCustomModel && (
          <div class="row" style="margin-top:8px">
            <input
              type="text"
              value={settings.models[provider.id] ?? ""}
              placeholder={provider.defaultModel}
              spellcheck={false}
              onInput={(e) =>
                void patch({
                  models: {
                    ...settings.models,
                    [provider.id]: (e.currentTarget as HTMLInputElement).value,
                  },
                })
              }
            />
          </div>
        )}
        <p class="hint">
          Providers rename and retire models often. If the list is stale, choose Custom and type the
          model id yourself.
        </p>
      </section>

      <PromptsEditor onFlash={flash} />

      <section>
        <h2>Voice input</h2>
        <p class="hint">
          The wave button in the panel transcribes speech using the browser's own speech service.
          No audio passes through Gloss, and it costs nothing.
        </p>
        <p class="hint">
          Microphone: <strong>{mic}</strong>
          {mic === "denied" && " — reset it from the padlock in the address bar of this page."}
        </p>
        <button class="ghost" disabled={mic === "granted"} onClick={() => void requestMic()}>
          {mic === "granted" ? "Microphone allowed" : "Allow microphone"}
        </button>
      </section>

      <section>
        <h2>History</h2>
        <p class="hint">
          Threads are stored in this browser only. Nothing is uploaded, and no provider ever sees
          anything but the single question you asked it.
        </p>
        <label class="toggle">
          <input
            type="checkbox"
            checked={settings.historyEnabled}
            onChange={(e) =>
              void patch({ historyEnabled: (e.currentTarget as HTMLInputElement).checked })
            }
          />
          Save conversations to history
        </label>

        <p class="hint" style="margin-top:14px">Delete threads older than</p>
        <select
          value={String(settings.historyRetentionDays)}
          disabled={!settings.historyEnabled}
          onChange={(e) => {
            const days = Number((e.currentTarget as HTMLSelectElement).value);
            void (async () => {
              await patch({ historyRetentionDays: days });
              if (days) await purgeOlderThan(days);
              await refreshStorage();
            })();
          }}
        >
          <option value="0">Never — keep everything</option>
          <option value="7">7 days</option>
          <option value="30">30 days</option>
          <option value="90">90 days</option>
        </select>
      </section>

      <section>
        <h2>Data</h2>
        <p class="hint">
          {threadCount} {threadCount === 1 ? "thread" : "threads"} saved · about {usage} on disk.
        </p>
        <div class="row">
          <button
            class="danger"
            onClick={() =>
              void (async () => {
                await clearHistory();
                await refreshStorage();
                flash("History cleared");
              })()
            }
          >
            Clear all history
          </button>
          <button
            class="danger"
            onClick={() =>
              void (async () => {
                await clearKey(provider.id);
                setKeyDraft("");
                setConfigured(await getConfiguredProviders());
                flash(`${provider.label} key deleted`);
              })()
            }
          >
            Delete {provider.label} key
          </button>
          <button
            class="danger"
            onClick={() =>
              void (async () => {
                await clearAllKeys();
                setKeyDraft("");
                setConfigured(new Set());
                flash("All keys deleted");
              })()
            }
          >
            Delete all keys
          </button>
          <button
            class="danger"
            onClick={() =>
              void (async () => {
                const next = await resetSettings();
                setSettings(next);
                await loadProvider(next.providerId);
                flash("Settings reset");
              })()
            }
          >
            Reset settings
          </button>
        </div>
      </section>

      <p class="saved" data-on={Boolean(saved)}>
        {saved || " "}
      </p>
    </main>
  );
}
