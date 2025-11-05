import Decimal from "break_eternity.js";
import { loadState, saveState, newState, clearState } from "./state.js";
import { tick, buyOne, buyMaxAll } from "./game.js";
import { GEN_CFG } from "./generators.js";
import { nextCost } from "./economy.js";
import { PER_PURCHASE_MULT } from "./constants.js";
import { timePlayed, aggregateStats, } from "./stats.js";

import { getBuildInfo } from "./build-info.js";
import type { BuildInfo } from "./build-info.js";
import { ensureThemeStyles, readStoredTheme, applyThemeChoice, THEME_OPTIONS } from "./theme.js";
import type { ThemeChoice } from "./theme.js";

type Dec = InstanceType<typeof Decimal>;
const D = (x:number | string| Dec) => 
    x instanceof Decimal ? x : new Decimal(x);

const STEP_SECONDS = 0.05; // 50 ms fixed simulation step
const MAX_STEPS_PER_FRAME = 40;
const OFFLINE_CAP_SECONDS = 60 * 60;
const DRIFT_WARN_RATIO = 1.5;
const DRIFT_RESET_RATIO = 1.2;
const DRIFT_LOG_INTERVAL_MS = 2000;

// ---- DOM ----
const stringsEl = document.getElementById("strings")!;
const gensContainer = document.getElementById("gens")!;
const settingsContainer = document.getElementById("settings-container") as HTMLDivElement | null;
const maxAllBtn = document.getElementById("max-all") as HTMLButtonElement | null;

const buildInfoFooter = document.createElement("div");
buildInfoFooter.id = "build-info-footer";
buildInfoFooter.className = "build-info-footer";
const existingFooter = document.querySelector('.app-footer');
if (existingFooter) {
  existingFooter.appendChild(buildInfoFooter);
} else {
  document.body.appendChild(buildInfoFooter);
}

const devRibbon = document.createElement('div');
devRibbon.className = 'dev-build-ribbon';
devRibbon.textContent = 'DEV BUILD';
devRibbon.style.display = 'none';
document.body.appendChild(devRibbon);

const buildInfoStyle = document.createElement('style');
buildInfoStyle.textContent = `
  .build-info-footer {
    font-size: 0.75rem;
    opacity: 0.7;
    display: flex;
    gap: 0.5rem;
    justify-content: center;
    align-items: center;
    padding: 0.5rem 1rem;
  }
  .build-info-footer span {
    white-space: nowrap;
  }
  .dev-build-ribbon {
    position: fixed;
    top: 1rem;
    right: -3.5rem;
    transform: rotate(45deg);
    background: rgba(255, 193, 7, 0.9);
    color: #000;
    padding: 0.25rem 2.5rem;
    font-weight: 700;
    font-size: 0.75rem;
    z-index: 9999;
    box-shadow: 0 0.5rem 1rem rgba(0,0,0,0.2);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
`;
if (!document.getElementById('build-info-style')) {
  buildInfoStyle.id = 'build-info-style';
  document.head.appendChild(buildInfoStyle);
}

const settingsStyle = document.createElement('style');
settingsStyle.id = 'settings-style';
settingsStyle.textContent = `
  .settings-subtabs {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
  }
  .settings-subtab-btn {
    border: 1px solid rgba(100, 116, 139, 0.4);
    border-radius: 9999px;
    padding: 0.35rem 1.1rem;
    background: rgba(148, 163, 184, 0.1);
    color: inherit;
    cursor: pointer;
    transition: background 0.2s ease, color 0.2s ease;
  }
  .settings-subtab-btn.active {
    background: rgba(99, 102, 241, 0.2);
    border-color: rgba(99, 102, 241, 0.6);
    color: inherit;
  }
  .settings-panels {
    display: block;
  }
  .settings-panel {
    display: none;
    gap: 0.75rem;
    flex-direction: column;
  }
  .settings-panel.active {
    display: flex;
    flex-direction: column;
  }
  .settings-button-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .settings-btn {
    border-radius: 0.4rem;
    border: 1px solid rgba(148, 163, 184, 0.4);
    background: rgba(148, 163, 184, 0.15);
    padding: 0.45rem 1.1rem;
    cursor: pointer;
  }
  .settings-btn:hover {
    background: rgba(99, 102, 241, 0.2);
  }
  .settings-btn.danger {
    border-color: rgba(248, 113, 113, 0.6);
    background: rgba(248, 113, 113, 0.15);
  }
  .settings-btn.danger:hover {
    background: rgba(248, 113, 113, 0.3);
  }
  .settings-status {
    font-size: 0.8rem;
    opacity: 0.8;
  }
  .settings-status[data-tone="error"] {
    color: #dc2626;
    opacity: 1;
  }
  .settings-field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    max-width: 360px;
  }
  .settings-note {
    font-size: 0.85rem;
    opacity: 0.75;
  }
`;
if (!document.getElementById('settings-style')) {
  document.head.appendChild(settingsStyle);
}

ensureThemeStyles();

const RIBBON_STORAGE_KEY = "ui-dev-ribbon";
let currentTheme: ThemeChoice = "default";
let forcedRibbonMode: "show" | "hide" | null = null;
let defaultRibbonVisible = false;
let currentBuildInfo: BuildInfo | null = null;
let updateMiscBuildInfo: (() => void) | null = null;

function readRibbonPreference(): "show" | "hide" | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage?.getItem(RIBBON_STORAGE_KEY);
    if (stored === "show" || stored === "hide") {
      return stored;
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

function storeRibbonPreference(mode: "show" | "hide" | null) {
  if (typeof window === "undefined") return;
  try {
    if (mode === null) {
      window.localStorage?.removeItem(RIBBON_STORAGE_KEY);
    } else {
      window.localStorage?.setItem(RIBBON_STORAGE_KEY, mode);
    }
  } catch {
    // ignore storage errors
  }
}

function updateDevRibbonDisplay() {
  if (forcedRibbonMode === "show") {
    devRibbon.style.display = "block";
    return;
  }
  if (forcedRibbonMode === "hide") {
    devRibbon.style.display = "none";
    return;
  }
  devRibbon.style.display = defaultRibbonVisible ? "block" : "none";
}

currentTheme = readStoredTheme();
applyThemeChoice(currentTheme, false);
forcedRibbonMode = readRibbonPreference();
updateDevRibbonDisplay();

type SettingsTabId = "saving" | "appearance" | "misc";

function applyBuildInfo() {
  getBuildInfo()
    .then(info => {
      currentBuildInfo = info;
      if (!info) {
        buildInfoFooter.textContent = 'Build info unavailable';
        defaultRibbonVisible = false;
        updateDevRibbonDisplay();
        if (updateMiscBuildInfo) updateMiscBuildInfo();
        return;
      }

      buildInfoFooter.innerHTML = '';
      const parts = [
        ['Version', info.version],
        ['Commit', info.commit],
        ['Built', new Date(info.buildTime).toLocaleString()],
      ];
      parts.forEach(([_label, value], idx) => {
        const span = document.createElement('span');
        span.textContent = value;
        buildInfoFooter.appendChild(span);
        if (idx < parts.length - 1) {
          const dot = document.createElement('span');
          dot.textContent = '•';
          buildInfoFooter.appendChild(dot);
        }
      });

      defaultRibbonVisible = info.env !== 'production';
      updateDevRibbonDisplay();
      if (updateMiscBuildInfo) updateMiscBuildInfo();
    })
    .catch(() => {
      currentBuildInfo = null;
      buildInfoFooter.textContent = 'Build info unavailable';
      defaultRibbonVisible = false;
      updateDevRibbonDisplay();
      if (updateMiscBuildInfo) updateMiscBuildInfo();
    });
}


applyBuildInfo();
setInterval(applyBuildInfo, 60_000);

function setupSettingsUI() {
  if (!settingsContainer) return;

  updateMiscBuildInfo = null;
  settingsContainer.innerHTML = '';

  const tabs: Array<{ id: SettingsTabId; label: string; render: (panel: HTMLDivElement) => void }> = [
    { id: "saving", label: "Saving", render: renderSavingTab },
    { id: "appearance", label: "Appearance", render: renderAppearanceTab },
    { id: "misc", label: "Misc", render: renderMiscTab },
  ];

  const tabRow = document.createElement('div');
  tabRow.className = 'settings-subtabs';
  const panelsWrap = document.createElement('div');
  panelsWrap.className = 'settings-panels';

  const registry = new Map<SettingsTabId, { button: HTMLButtonElement; panel: HTMLDivElement }>();

  tabs.forEach(tab => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'settings-subtab-btn';
    button.textContent = tab.label;
    tabRow.appendChild(button);

    const panel = document.createElement('div');
    panel.className = 'settings-panel';
    panel.dataset.subtab = tab.id;
    tab.render(panel);
    panelsWrap.appendChild(panel);

    button.addEventListener('click', () => activate(tab.id));
    registry.set(tab.id, { button, panel });
  });

  settingsContainer.append(tabRow, panelsWrap);

  function activate(id: SettingsTabId) {
    registry.forEach(({ button, panel }, key) => {
      const active = key === id;
      button.classList.toggle('active', active);
      panel.classList.toggle('active', active);
    });
  }

  activate('saving');

  function renderSavingTab(panel: HTMLDivElement) {
    panel.classList.add('settings-panel-saving');

    const intro = document.createElement('p');
    intro.className = 'settings-note';
    intro.textContent = 'Autosaves run every 10 seconds. Use these controls for manual management or emergency backup.';
    panel.appendChild(intro);

    const buttonRow = document.createElement('div');
    buttonRow.className = 'settings-button-row';

    const manualSaveBtn = document.createElement('button');
    manualSaveBtn.type = 'button';
    manualSaveBtn.className = 'settings-btn';
    manualSaveBtn.textContent = 'Save Now';
    manualSaveBtn.addEventListener('click', () => {
      saveState(state);
      showStatus(`Saved at ${new Date().toLocaleTimeString()}`);
    });

    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.className = 'settings-btn';
    exportBtn.textContent = 'Copy Save to Clipboard';
    exportBtn.addEventListener('click', async () => {
      try {
        const payload = JSON.stringify({
          strings: state.strings.toString(),
          gens: state.gens.map(g => ({ units: g.units.toString(), bought: g.bought })),
          lastTick: state.lastTick,
          created: state.created,
        }, null, 2);
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(payload);
          showStatus('Copied save data to clipboard.');
        } else {
          showStatus('Clipboard API unavailable in this browser.', 'error');
        }
      } catch (err) {
        console.error('Failed to copy save data:', err);
        showStatus('Copy failed. Check browser permissions.', 'error');
      }
    });
    if (typeof navigator === 'undefined' || !navigator.clipboard || !navigator.clipboard.writeText) {
      exportBtn.disabled = true;
      exportBtn.title = 'Clipboard API unavailable in this environment';
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'settings-btn danger';
    deleteBtn.textContent = 'Delete Save Data';
    deleteBtn.addEventListener('click', () => {
      const shouldReset = typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm('Delete all progress? This cannot be undone.')
        : true;
      if (!shouldReset) return;
      clearState();
      const fresh = newState();
      state.strings = fresh.strings;
      state.gens = fresh.gens;
      state.lastTick = fresh.lastTick;
      state.created = fresh.created;
      render();
      saveState(state);
      showStatus('Save data cleared. A new run has started.');
    });

    buttonRow.append(manualSaveBtn, exportBtn, deleteBtn);
    panel.appendChild(buttonRow);

    const importField = document.createElement('div');
    importField.className = 'settings-field';

    const importLabel = document.createElement('label');
    importLabel.htmlFor = 'settings-import-area';
    importLabel.textContent = 'Import save data';

    const importArea = document.createElement('textarea');
    importArea.id = 'settings-import-area';
    importArea.rows = 6;
    importArea.placeholder = 'Paste JSON save data here';

    const importActions = document.createElement('div');
    importActions.className = 'settings-button-row';

    const importBtn = document.createElement('button');
    importBtn.type = 'button';
    importBtn.className = 'settings-btn';
    importBtn.textContent = 'Import Save';
    importBtn.addEventListener('click', () => {
      const raw = importArea.value.trim();
      if (!raw) {
        showStatus('Paste save data before importing.', 'error');
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') throw new Error('Invalid payload');
        const strings = typeof parsed.strings === 'string' ? parsed.strings : String(parsed.strings ?? '0');
        state.strings = new Decimal(strings);
        if (Array.isArray(parsed.gens)) {
          for (let i = 0; i < state.gens.length; i++) {
            const entry = parsed.gens[i] ?? {};
            const units = typeof entry.units === 'string' ? entry.units : String(entry.units ?? '0');
            state.gens[i].units = new Decimal(units);
            state.gens[i].bought = Number(entry.bought ?? 0) || 0;
          }
        }
        state.lastTick = typeof parsed.lastTick === 'number' ? parsed.lastTick : Date.now();
        state.created = typeof parsed.created === 'number' ? parsed.created : Date.now();
        saveState(state);
        render();
        importArea.value = '';
        showStatus('Save data imported successfully.');
      } catch (err) {
        console.error('Import failed:', err);
        showStatus('Import failed. Please verify the JSON payload.', 'error');
      }
    });

    importActions.appendChild(importBtn);
    importField.append(importLabel, importArea, importActions);
    panel.appendChild(importField);

    const status = document.createElement('div');
    status.className = 'settings-status';
    panel.appendChild(status);

    let statusTimeout: number | undefined;
    function showStatus(message: string, tone: 'info' | 'error' = 'info') {
      status.textContent = message;
      if (tone === 'error') {
        status.dataset.tone = 'error';
      } else {
        status.removeAttribute('data-tone');
      }
      if (statusTimeout) window.clearTimeout(statusTimeout);
      statusTimeout = window.setTimeout(() => {
        status.textContent = '';
        status.removeAttribute('data-tone');
      }, 5000);
    }

    const hint = document.createElement('p');
    hint.className = 'settings-note';
    hint.textContent = 'Tip: manual saves are also written automatically shortly before you close or reload the tab.';
    panel.appendChild(hint);
  }

  function renderAppearanceTab(panel: HTMLDivElement) {
    panel.classList.add('settings-panel-appearance');

    const intro = document.createElement('p');
    intro.className = 'settings-note';
    intro.textContent = 'Choose how Entropic Threads looks on this device.';
    panel.appendChild(intro);

    const field = document.createElement('div');
    field.className = 'settings-field';

    const label = document.createElement('label');
    label.htmlFor = 'settings-theme-select';
    label.textContent = 'Theme';

    const select = document.createElement('select');
    select.id = 'settings-theme-select';
    THEME_OPTIONS.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      select.appendChild(option);
    });
    select.value = currentTheme;

    select.addEventListener('change', () => {
      const choice = select.value as ThemeChoice;
      currentTheme = choice;
      applyThemeChoice(choice);
    });

    field.append(label, select);
    panel.appendChild(field);

    const note = document.createElement('p');
    note.className = 'settings-note';
    note.textContent = 'Theme preference is stored locally and will be remembered next time you return. Default keeps the classic gradient.';
    panel.appendChild(note);
  }

  function renderMiscTab(panel: HTMLDivElement) {
    panel.classList.add('settings-panel-misc');

    const ribbonField = document.createElement('div');
    ribbonField.className = 'settings-field';

    const ribbonLabel = document.createElement('label');
    ribbonLabel.htmlFor = 'settings-ribbon-mode';
    ribbonLabel.textContent = 'Release ribbon behaviour';

    const ribbonSelect = document.createElement('select');
    ribbonSelect.id = 'settings-ribbon-mode';
    const ribbonOptions: Array<{ value: 'auto' | 'show' | 'hide'; label: string }> = [
      { value: 'auto', label: 'Follow build environment' },
      { value: 'show', label: 'Always show ribbon' },
      { value: 'hide', label: 'Hide ribbon' },
    ];
    ribbonOptions.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      ribbonSelect.appendChild(option);
    });
    ribbonSelect.value = forcedRibbonMode ?? 'auto';

    ribbonSelect.addEventListener('change', () => {
      const mode = ribbonSelect.value as 'auto' | 'show' | 'hide';
      forcedRibbonMode = mode === 'auto' ? null : mode;
      storeRibbonPreference(forcedRibbonMode);
      updateDevRibbonDisplay();
    });

    ribbonField.append(ribbonLabel, ribbonSelect);
    panel.appendChild(ribbonField);

    const miscNote = document.createElement('p');
    miscNote.className = 'settings-note';
    miscNote.textContent = 'Toggle experimental quality-of-life helpers and build diagnostics.';
    panel.appendChild(miscNote);

    const releaseSummary = document.createElement('p');
    releaseSummary.className = 'settings-note';
    panel.appendChild(releaseSummary);

    const refreshReleaseSummary = () => {
      if (currentBuildInfo) {
        releaseSummary.textContent = `Current build: ${currentBuildInfo.version} (${currentBuildInfo.commit})`;
      } else {
        releaseSummary.textContent = 'Current build metadata unavailable.';
      }
    };

    refreshReleaseSummary();
    updateMiscBuildInfo = refreshReleaseSummary;
  }
}

// Build generator rows dynamically
type RowRefs = {
  row: HTMLDivElement;
  name: HTMLSpanElement;
  units: HTMLSpanElement;
  bought: HTMLSpanElement;
  multiplier: HTMLSpanElement;
  nextCost: HTMLSpanElement;
  buy1: HTMLButtonElement;
};

function makeRow(tier: number): RowRefs {
  const cfg = GEN_CFG[tier];
  if (!cfg) {
    throw new Error(`Missing generator config for tier ${tier}`);
  }

  const row = document.createElement("div");
  row.className = "gen-row";

  const name = document.createElement("span");
  name.textContent = cfg.name;

  const units = document.createElement("span");
  const bought = document.createElement("span");
  const multiplier = document.createElement("span");
  const nextCost = document.createElement("span");

  const buy1Btn = document.createElement("button");
  buy1Btn.textContent = "Buy 1";

  const buttonGroup = document.createElement("div");
  buttonGroup.className = "gen-row-buttons";
  buttonGroup.append(buy1Btn);

  row.append(name, units, bought, multiplier, nextCost, buttonGroup);
  gensContainer.appendChild(row);

  // Wire handlers
  buy1Btn.addEventListener("click", () => {
    const got: boolean = buyOne(state, tier);
    if (got) {
      render();
    }
  });

  return { row, name, units, bought, multiplier, nextCost, buy1: buy1Btn };
}

const state = loadState();

let accumulator = 0;
let lastFrameTime = performance.now();
let loopStartWall = lastFrameTime;
let totalSimulatedSeconds = 0;
let warnedAboutDrift = false;
let lastDriftLog = lastFrameTime;

const rows: RowRefs[] = [];

applyOfflineProgress();

for (let t = 0; t < GEN_CFG.length; t++) rows.push(makeRow(t));

setupSettingsUI();

if (maxAllBtn) {
  maxAllBtn.addEventListener("click", () => {
    if (buyMaxAll(state)) {
      render();
    }
  });
}
//#region keybindings;
document.addEventListener("keydown", event => {
  if (event.key === "m" || event.key === "M") {
    if (buyMaxAll(state)) {
      render();
    }
  }
});


//#endregion;
// ---- formatting helpers ----
function format(d: Dec): string {
  // small -> locale number; large -> scientific like 1.234e123
  if (d.lessThan(1e6)) {
    const num = d.toNumber();
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  // @ts-ignore (mantissa/exponent exist at runtime in break_eternity)
  if (typeof d.mantissa === "number" && typeof d.exponent === "number") {
    // @ts-ignore
    return `${d.mantissa.toFixed(3)}e${d.exponent}`;
  }
  return d.toNumber().toExponential(3);
}

// ---- render ----
function render() {
  if (statsActive) {
    renderStats();
  }

  stringsEl.textContent = format(state.strings);

  for (let t = 0; t < GEN_CFG.length; t++) {
    const cfg = GEN_CFG[t];
    const r = rows[t];
    const gen = state.gens[t];
    if (!cfg || !r || !gen) continue;
    r.units.textContent = format(gen.units);
    r.bought.textContent = String(gen.bought);
    r.multiplier.textContent = format(PER_PURCHASE_MULT.pow(gen.bought));
    r.nextCost.textContent = format(nextCost(cfg, gen.bought));
    // enable/disable buttons based on affordability
    const canBuy = state.strings.greaterThanOrEqualTo(nextCost(cfg, gen.bought));
    r.buy1.disabled = !canBuy;
  }
}
//tab switching
const tabButtons = document.querySelectorAll<HTMLButtonElement>(".tab-btn");
const tabViews   = document.querySelectorAll<HTMLElement>(".tab-view");

let statsActive = false;

function activateTab(name: "game" | "stats") {
  // highlight the active button
  tabButtons.forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  // show the correct tab view
  tabViews.forEach(v => v.classList.toggle("active", v.id === `tab-${name}`));

  // only render stats when Stats tab is activated
  statsActive = name === "stats";
  if (statsActive) {
    queueMicrotask(() => renderStats());
  }
}

tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const name = (btn.dataset.tab as "game" | "stats") ?? "game";
    activateTab(name);
  });
});


export function renderStats() {
  const root = document.getElementById('stats-container');
  if (!root) {
    console.warn('renderStats: #stats-container not found');
    return;
  }

  if (!statsActive) {
    return;
  }

  try {
    // Safe stringify for Decimal/break_infinity values
    const toStr = (v: any) =>
      v == null ? '—'
      : typeof v === 'string' ? v
      : typeof v === 'number' ? v.toLocaleString()
      : typeof v.toString === 'function' ? v.toString()
      : String(v);

    const { days, hours, minutes, seconds } = timePlayed(state);  // must not throw
    const { totalUnits, totalBought, highestTier } = aggregateStats(state); // must not throw

    const timeParts: string[] = [];
    if (days) timeParts.push(`${days}d`);
    if (hours || timeParts.length) timeParts.push(`${hours}h`);
    if (minutes || timeParts.length) timeParts.push(`${minutes}m`);
    timeParts.push(`${seconds}s`);
    const timeString = timeParts.join(' ');

    const rows: Array<[string, string]> = [
      ['Time Played', timeString],
      ['Strings Owned', toStr(format ? format(state.strings) : toStr(state.strings))],
      ['Total Purchases', (typeof totalBought === 'number' ? totalBought.toLocaleString() : toStr(totalBought))],
      ['Highest Active Tier', highestTier >= 0 ? `Gen${highestTier + 1}` : 'None'],
    ];

    // minimal skeleton in case CSS is missing
    if (!document.getElementById('stats-row-css')) {
      const style = document.createElement('style');
      style.id = 'stats-row-css';
      style.textContent = `
        .stat-row { display:flex; justify-content:space-between; gap:16px; padding:8px 0; border-bottom:1px solid rgba(120,140,200,.2); }
        .stat-row:last-child { border-bottom: 0; }
        .stat-label { opacity:.75; text-transform:uppercase; letter-spacing:.06em; font-size:.85rem; }
        .stat-value { font-weight:600; }
      `;
      document.head.appendChild(style);
    }

    root.innerHTML = rows
      .map(([label, value]) =>
        `<div class="stat-row"><span class="stat-label">${label}</span><span class="stat-value">${value}</span></div>`
      )
      .join('');
  } catch (err) {
    console.error('renderStats failed:', err);
    root.textContent = 'Failed to render stats (see console).';
  }
}


function applyOfflineProgress() {
  const now = Date.now();
  const elapsedSeconds = Math.max(0, (now - state.lastTick) / 1000);

  if (elapsedSeconds <= 0) {
    state.lastTick = now;
    const wall = performance.now();
    accumulator = 0;
    totalSimulatedSeconds = 0;
    lastFrameTime = wall;
    loopStartWall = wall;
    lastDriftLog = wall;
    warnedAboutDrift = false;
    return;
  }

  const cappedSeconds = Math.min(elapsedSeconds, OFFLINE_CAP_SECONDS);
  if (elapsedSeconds > OFFLINE_CAP_SECONDS) {
    console.warn(`Offline progress capped to ${(OFFLINE_CAP_SECONDS / 3600).toFixed(1)} hour(s).`);
  }

  let remaining = cappedSeconds;
  let simulated = 0;
  let steps = 0;
  while (remaining >= STEP_SECONDS) {
    tick(state, STEP_SECONDS);
    remaining -= STEP_SECONDS;
    simulated += STEP_SECONDS;
    steps += 1;
  }
  if (remaining > 1e-6) {
    tick(state, remaining);
    simulated += remaining;
    steps += 1;
  }

  if (simulated > 0) {
    console.info(`Applied ${simulated.toFixed(2)}s of offline progress in ${steps} step(s).`);
  }

  state.lastTick = now;
  accumulator = 0;
  totalSimulatedSeconds = 0;
  const wall = performance.now();
  lastFrameTime = wall;
  loopStartWall = wall;
  lastDriftLog = wall;
  warnedAboutDrift = false;
}

// ---- main loop + autosave ----
let lastSave = performance.now();
function loop(ts: number) {
  const deltaSeconds = Math.max(0, (ts - lastFrameTime) / 1000);
  lastFrameTime = ts;

  accumulator = Math.min(accumulator + deltaSeconds, OFFLINE_CAP_SECONDS);

  let steps = 0;
  while (accumulator >= STEP_SECONDS && steps < MAX_STEPS_PER_FRAME) {
    tick(state, STEP_SECONDS);
    accumulator -= STEP_SECONDS;
    totalSimulatedSeconds += STEP_SECONDS;
    steps += 1;
  }

  if (steps === MAX_STEPS_PER_FRAME && accumulator >= STEP_SECONDS) {
    if (ts - lastDriftLog >= DRIFT_LOG_INTERVAL_MS) {
      console.warn('Simulation backlog exceeded per-frame budget; trimming remainder.');
      lastDriftLog = ts;
    }
    accumulator = STEP_SECONDS;
  }

  state.lastTick = Date.now();
  render();

  if (ts - lastSave > 10_000) {
    saveState(state);
    lastSave = ts;
  }

  const wallSeconds = (ts - loopStartWall) / 1000;
  if (wallSeconds > 0) {
    const ratio = totalSimulatedSeconds / wallSeconds;
    if (ratio > DRIFT_WARN_RATIO) {
      if (!warnedAboutDrift || ts - lastDriftLog >= DRIFT_LOG_INTERVAL_MS) {
        console.warn(`Simulation running ${ratio.toFixed(2)}× faster than wall clock; dropping backlog.`);
        lastDriftLog = ts;
      }
      warnedAboutDrift = true;
    } else if (ratio < DRIFT_RESET_RATIO) {
      warnedAboutDrift = false;
    }
  }

  requestAnimationFrame(loop);
}

render();
requestAnimationFrame(loop);
