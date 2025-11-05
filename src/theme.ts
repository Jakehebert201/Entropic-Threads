const STYLE_ID = "theme-style";
const THEME_STORAGE_KEY = "ui-theme";

const THEME_CSS = `
  :root[data-theme="dark"] {
    color-scheme: dark;
  }
  :root[data-theme="dark"] body {
    background: radial-gradient(circle at top, rgba(26, 29, 43, 0.85), rgba(17, 20, 30, 0.95)) fixed;
    background-repeat: no-repeat;
    background-size: 160% 160%;
    color: #e2e8f0;
  }
  :root[data-theme="dark"] .stats {
    background: rgba(28, 30, 44, 0.7);
    box-shadow: 0 18px 48px rgba(5, 8, 20, 0.55);
  }
  :root[data-theme="dark"] .stat {
    color: rgba(226, 232, 240, 0.7);
  }
  :root[data-theme="dark"] .stat-value {
    color: #f8fafc;
  }
  :root[data-theme="dark"] .gen-header {
    color: rgba(226, 232, 240, 0.7);
  }
  :root[data-theme="dark"] button {
    background: rgba(36, 40, 58, 0.85);
    border-color: rgba(148, 163, 184, 0.3);
    color: #e2e8f0;
  }
  :root[data-theme="dark"] button:hover:not(:disabled) {
    background: rgba(99, 102, 241, 0.3);
  }
  :root[data-theme="dark"] .settings-btn.danger {
    background: rgba(248, 113, 113, 0.12);
    border-color: rgba(248, 113, 113, 0.4);
  }
  :root[data-theme="dark"] .settings-btn.danger:hover:not(:disabled) {
    background: rgba(248, 113, 113, 0.25);
  }
  :root[data-theme="dark"] .tab-btn {
    border-color: rgba(148, 163, 184, 0.35);
    background: rgba(30, 34, 52, 0.9);
    color: inherit;
  }
  :root[data-theme="dark"] .tab-btn.active {
    background: rgba(99, 102, 241, 0.4);
    border-color: rgba(99, 102, 241, 0.6);
  }

  :root[data-theme="light"] {
    color-scheme: light;
  }
  :root[data-theme="light"] body {
    background: radial-gradient(circle at top, rgba(255, 255, 255, 0.95), rgba(226, 232, 240, 0.9)) fixed;
    background-repeat: no-repeat;
    background-size: 160% 160%;
    color: #0f172a;
  }
  :root[data-theme="light"] .stats {
    background: rgba(255, 255, 255, 0.92);
    box-shadow: 0 18px 48px rgba(15, 23, 42, 0.08);
  }
  :root[data-theme="light"] .stat {
    color: rgba(51, 65, 85, 0.7);
  }
  :root[data-theme="light"] .stat-value {
    color: #0f172a;
  }
  :root[data-theme="light"] .gen-header {
    color: rgba(51, 65, 85, 0.9);
  }
  :root[data-theme="light"] button {
    background: rgba(255, 255, 255, 0.94);
    border-color: rgba(148, 163, 184, 0.35);
    color: #0f172a;
  }
  :root[data-theme="light"] button:hover:not(:disabled) {
    background: rgba(148, 197, 255, 0.25);
  }
  :root[data-theme="light"] .settings-btn.danger {
    background: rgba(248, 113, 113, 0.1);
    border-color: rgba(248, 113, 113, 0.45);
    color: #991b1b;
  }
  :root[data-theme="light"] .settings-btn.danger:hover:not(:disabled) {
    background: rgba(248, 113, 113, 0.2);
  }
  :root[data-theme="light"] .tab-btn {
    border-color: rgba(99, 102, 241, 0.25);
    background: rgba(244, 244, 255, 0.9);
    color: inherit;
  }
  :root[data-theme="light"] .tab-btn.active {
    background: rgba(129, 140, 248, 0.3);
    border-color: rgba(99, 102, 241, 0.5);
  }
`;

export type ThemeChoice = "default" | "light" | "dark";

export const THEME_OPTIONS: ReadonlyArray<{ value: ThemeChoice; label: string }> = [
  { value: "default", label: "Default (classic)" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

export function ensureThemeStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = THEME_CSS;
  document.head.appendChild(style);
}

export function readStoredTheme(): ThemeChoice {
  if (typeof window === "undefined") return "default";
  try {
    const stored = window.localStorage?.getItem(THEME_STORAGE_KEY);
    if (stored === "dark" || stored === "light" || stored === "default") {
      return stored;
    }
    if (stored === "system") {
      return "default";
    }
  } catch {
    // ignore storage errors
  }
  return "default";
}

export function applyThemeChoice(choice: ThemeChoice, persist = true) {
  if (typeof document !== "undefined") {
    ensureThemeStyles();
    const root = document.documentElement;
    if (choice === "default") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", choice);
    }
  }

  if (!persist || typeof window === "undefined") return;
  try {
    window.localStorage?.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // ignore storage errors
  }
}
