/** Inline SVGs — no icon dependency, and they inherit currentColor. */

const stroke = {
  fill: "none",
  stroke: "currentColor",
  "stroke-width": "1.75",
  "stroke-linecap": "round" as const,
  "stroke-linejoin": "round" as const,
};

/** `animated` sets the three lines breathing — see .logo[data-animate] in the CSS. */
export function Logo({ size = 20, animated = false }: { size?: number; animated?: boolean }) {
  return (
    <svg
      class="logo"
      data-animate={animated || undefined}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
    >
      <rect x="1" y="1" width="22" height="22" rx="6" fill="var(--accent)" />
      <rect class="logo-line line-1" x="5.5" y="7" width="10" height="2" rx="1" fill="#fff" opacity="0.55" />
      <rect class="logo-line line-2" x="5.5" y="11" width="13" height="2.5" rx="1.25" fill="var(--highlight)" />
      <rect class="logo-line line-3" x="5.5" y="16" width="7.5" height="2" rx="1" fill="#fff" opacity="0.55" />
    </svg>
  );
}

/** OpenRouter's own mark, so the connect button looks like a sign-in button. */
export function OpenRouterIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      viewBox="19.82 17.199 365.556 258.298"
      width={Math.round(size * 1.415)}
      height={size}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M303.9475,17.19926c42.79734,0,77.48933,34.69327,77.48933,77.48933s-34.69199,77.48933-77.48933,77.48933l76.86166,76.86244c9.76367,9.76313,2.84903,26.45667-10.95697,26.45667h-220.88335c-71.32686,0-129.14889-57.82202-129.14889-129.14889S77.64197,17.19926,148.96884,17.19926h154.97866ZM148.96884,68.85881c-42.79607,0-77.48933,34.69327-77.48933,77.48933s34.69327,77.48933,77.48933,77.48933,77.48933-34.69327,77.48933-77.48933-34.69327-77.48933-77.48933-77.48933Z" />
    </svg>
  );
}

export function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...stroke}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" {...stroke}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  );
}

export function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" />
    </svg>
  );
}

export function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" {...stroke}>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M3 4v4h4" />
      <path d="M12 7.5V12l3 1.8" />
    </svg>
  );
}

export function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" {...stroke}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4.5 15H4a2 2 0 1 1 0-4h.2A1.6 1.6 0 0 0 5.3 8.2l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V4a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.8 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1z" />
    </svg>
  );
}

export function ProviderIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" {...stroke}>
      <path d="M12 3.5 13.9 9l5.6 1.9-5.6 1.9L12 18.5l-1.9-5.7L4.5 11l5.6-2z" />
    </svg>
  );
}

export function ModelIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" {...stroke}>
      <rect x="7" y="7" width="10" height="10" rx="2.5" />
      <path d="M10 3.5v3M14 3.5v3M10 17.5v3M14 17.5v3M3.5 10h3M3.5 14h3M17.5 10h3M17.5 14h3" />
    </svg>
  );
}

export function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" {...stroke}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" {...stroke}>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
    </svg>
  );
}

export function AutoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" {...stroke}>
      <rect x="2.5" y="4" width="19" height="13" rx="2" />
      <path d="M9 20h6" />
    </svg>
  );
}

/** Five bars, not a microphone. They animate while recording. */
export function WaveIcon({ active }: { active?: boolean }) {
  return (
    <svg
      class={active ? "wave wave-on" : "wave"}
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      fill="currentColor"
    >
      <rect x="3" y="9" width="2" height="6" rx="1" />
      <rect x="7.4" y="6.5" width="2" height="11" rx="1" />
      <rect x="11.8" y="4" width="2" height="16" rx="1" />
      <rect x="16.2" y="6.5" width="2" height="11" rx="1" />
      <rect x="20.6" y="9" width="2" height="6" rx="1" />
    </svg>
  );
}
