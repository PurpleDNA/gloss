import { useEffect, useMemo, useState } from "preact/hooks";
import { deleteThread, listThreads, type HistoryThread } from "../../store/history";

interface Props {
  onOpen: (thread: HistoryThread) => void;
  onClose: () => void;
}

function ago(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days}d ago` : new Date(ts).toLocaleDateString();
}

export function HistoryList({ onOpen, onClose }: Props) {
  const [threads, setThreads] = useState<HistoryThread[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    void listThreads().then(setThreads);
  }, []);

  const shown = useMemo(() => {
    if (!threads) return [];
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter(
      (t) =>
        t.selection.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        t.messages.some((m) => m.role === "assistant" && m.content.toLowerCase().includes(q)),
    );
  }, [threads, query]);

  const remove = async (e: Event, id: string) => {
    e.stopPropagation();
    await deleteThread(id);
    setThreads((prev) => prev?.filter((t) => t.id !== id) ?? null);
  };

  return (
    <div class="history">
      <div class="history-bar">
        <input
          type="text"
          class="search"
          value={query}
          placeholder="Search history…"
          onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
        />
        <button class="ghost" onClick={onClose}>
          Close
        </button>
      </div>

      {threads === null && <p class="hint">Loading…</p>}

      {threads?.length === 0 && (
        <p class="hint">
          Nothing saved yet. Every selection you ask about is kept here, on this machine only.
        </p>
      )}

      {threads && threads.length > 0 && shown.length === 0 && (
        <p class="hint">No matches for “{query}”.</p>
      )}

      <ul class="history-list">
        {shown.map((t) => (
          <li key={t.id}>
            <button class="history-item" onClick={() => onOpen(t)}>
              <span class="history-selection">{t.selection}</span>
              <span class="history-meta">
                {t.title || new URL(t.url || "https://-").host} · {ago(t.updatedAt)}
              </span>
            </button>
            <button
              class="history-delete"
              title="Delete this thread"
              onClick={(e) => void remove(e, t.id)}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
