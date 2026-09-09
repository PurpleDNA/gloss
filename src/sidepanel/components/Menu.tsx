import { useEffect, useRef } from "preact/hooks";
import type { ProviderDef } from "../../providers/registry";
import type { Theme } from "../../lib/theme";
import {
  AutoIcon,
  HistoryIcon,
  ModelIcon,
  MoonIcon,
  ProviderIcon,
  SettingsIcon,
  SunIcon,
} from "./Icons";

const THEMES: { id: Theme; label: string; icon: () => preact.JSX.Element }[] = [
  { id: "system", label: "Match system", icon: AutoIcon },
  { id: "light", label: "Light", icon: SunIcon },
  { id: "dark", label: "Dark", icon: MoonIcon },
];

interface Props {
  open: boolean;
  onClose: () => void;
  providers: ProviderDef[];
  provider: ProviderDef;
  model: string;
  streaming: boolean;
  onProvider: (id: string) => void;
  onModel: (id: string) => void;
  theme: Theme;
  onTheme: (theme: Theme) => void;
  onHistory: () => void;
  onSettings: () => void;
}

export function Menu(props: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!props.open) return;
    const away = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) props.onClose();
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && props.onClose();
    // Deferred so the click that opened the menu does not immediately close it.
    const id = setTimeout(() => document.addEventListener("mousedown", away));
    document.addEventListener("keydown", esc);
    return () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [props.open]);

  if (!props.open) return null;

  // A model typed in settings will not be in the catalogue — keep it selectable.
  const models = props.provider.models.some((m) => m.id === props.model)
    ? props.provider.models
    : [{ id: props.model, label: props.model }, ...props.provider.models];

  return (
    <div class="menu" ref={ref}>
      <label class="menu-row">
        <ProviderIcon />
        <span class="menu-label">Provider</span>
        <select
          value={props.provider.id}
          disabled={props.streaming}
          onChange={(e) => props.onProvider((e.currentTarget as HTMLSelectElement).value)}
        >
          {props.providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <label class="menu-row">
        <ModelIcon />
        <span class="menu-label">Model</span>
        <select
          value={props.model}
          disabled={props.streaming}
          onChange={(e) => props.onModel((e.currentTarget as HTMLSelectElement).value)}
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      <div class="menu-row">
        <SunIcon />
        <span class="menu-label">Theme</span>
        <div class="segmented" role="group" aria-label="Theme">
          {THEMES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              data-on={props.theme === id}
              title={label}
              aria-label={label}
              aria-pressed={props.theme === id}
              onClick={() => props.onTheme(id)}
            >
              <Icon />
            </button>
          ))}
        </div>
      </div>

      <div class="menu-sep" />

      <button class="menu-item" onClick={props.onHistory}>
        <HistoryIcon />
        History
      </button>
      <button class="menu-item" onClick={props.onSettings}>
        <SettingsIcon />
        Settings
      </button>
    </div>
  );
}
