export type Theme = "system" | "light" | "dark";

/**
 * Three states: an explicit choice stamps data-theme on the root; "system"
 * removes it and lets prefers-color-scheme decide.
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}
