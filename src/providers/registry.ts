import type { VNode } from "preact";
import { connectOpenRouter } from "../lib/oauth";
import { OpenRouterIcon } from "../sidepanel/components/Icons";
import { streamAnthropic } from "./anthropic";
import { streamGemini } from "./gemini";
import { openAICompatible } from "./openai-compatible";
import type { Adapter } from "./types";

export interface ModelOption {
  id: string;
  label: string;
}

export interface ProviderDef {
  id: string;
  label: string;
  adapter: Adapter;
  /** Match pattern for chrome.permissions — requested only when enabled. */
  origin: string;
  /** Where the user goes to create a key. */
  keyUrl: string;
  /**
   * One-click sign-in that mints a key on the user's own account, for the
   * providers that offer one. Resolves with the key, already stored.
   */
  connect?: () => Promise<string>;
  /** The provider's own mark, for the connect button. */
  Mark?: (props: { size?: number }) => VNode;
  keyHint: string;
  models: ModelOption[];
  defaultModel: string;
  /** Shown as a badge: usable without spending money. */
  free?: boolean;
  note?: string;
}

/**
 * Model ids drift constantly — providers rename and retire them without notice.
 * Every provider therefore also accepts a typed-in model id in settings, so a
 * stale list here is an inconvenience rather than a breakage.
 */
const OPENROUTER_ORIGIN = "https://openrouter.ai/*";

export const PROVIDERS: ProviderDef[] = [
  {
    id: "anthropic",
    label: "Claude",
    adapter: streamAnthropic,
    origin: "https://api.anthropic.com/*",
    keyUrl: "https://console.anthropic.com/settings/keys",
    keyHint: "sk-ant-...",
    defaultModel: "claude-sonnet-5",
    models: [
      { id: "claude-sonnet-5", label: "Sonnet 5 — balanced" },
      { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5 — fastest, cheapest" },
      { id: "claude-opus-5", label: "Opus 5 — most capable" },
    ],
  },
  {
    id: "gemini",
    label: "Gemini",
    adapter: streamGemini,
    origin: "https://generativelanguage.googleapis.com/*",
    keyUrl: "https://aistudio.google.com/apikey",
    keyHint: "AIza...",
    defaultModel: "gemini-3.6-flash",
    free: true,
    note: "Google AI Studio issues keys with a free tier — no card required. Google may review and train on free-tier content; their paid tier does not.",
    models: [
      { id: "gemini-3.6-flash", label: "3.6 Flash — fast, free tier" },
    ],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    adapter: openAICompatible("https://openrouter.ai/api/v1", {
      "HTTP-Referer": "https://github.com/gloss-extension",
      "X-Title": "Gloss",
    }),
    origin: OPENROUTER_ORIGIN,
    keyUrl: "https://openrouter.ai/keys",
    connect: () => connectOpenRouter(OPENROUTER_ORIGIN),
    Mark: OpenRouterIcon,
    keyHint: "sk-or-v1-...",
    defaultModel: "google/gemma-4-26b-a4b-it:free",
    free: true,
    note: "Model ids ending in :free cost nothing. One key reaches dozens of models. Some free models are free because the host logs and trains on prompts.",
    models: [
      { id: "google/gemma-4-26b-a4b-it:free", label: "Gemma 4 26B — fast (free)" },
      { id: "google/gemma-4-31b-it:free", label: "Gemma 4 31B (free)" },
      { id: "nvidia/nemotron-3.5-lightning:free", label: "Nemotron 3.5 Lightning (free)" },
      { id: "z-ai/glm-5.2:free", label: "GLM 5.2 (free)" },
      { id: "anthropic/claude-sonnet-5", label: "Claude Sonnet 5 (paid)" },
    ],
  },
  {
    id: "openai",
    label: "OpenAI",
    adapter: openAICompatible("https://api.openai.com/v1"),
    origin: "https://api.openai.com/*",
    keyUrl: "https://platform.openai.com/api-keys",
    keyHint: "sk-...",
    defaultModel: "gpt-4o-mini",
    models: [
      { id: "gpt-4o-mini", label: "GPT-4o mini — cheapest" },
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-4.1", label: "GPT-4.1" },
    ],
  },
  {
    id: "ollama",
    label: "Ollama (local)",
    adapter: openAICompatible("http://localhost:11434/v1"),
    origin: "http://localhost/*",
    keyUrl: "https://ollama.com/download",
    keyHint: "any value — Ollama ignores it",
    defaultModel: "llama3.2",
    free: true,
    note: "Runs on your machine, so nothing leaves it. Ollama must be started with OLLAMA_ORIGINS=chrome-extension://* or it will refuse the browser's request.",
    models: [
      { id: "llama3.2", label: "llama3.2" },
      { id: "qwen2.5", label: "qwen2.5" },
      { id: "mistral", label: "mistral" },
    ],
  },
];

export const DEFAULT_PROVIDER = "anthropic";

export function getProvider(id: string): ProviderDef {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}
