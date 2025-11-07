import Decimal from "break_eternity.js";
import { loadState, saveState, newState, serializeGameState, deserializeGameState, type GameState, type SerializedGameState } from "./state.js";
import { GEN_CFG } from "./generators.js";
import { nextCost } from "./economy.js";
import { PER_PURCHASE_MULT, BRAID_PATHS, BRAID_CHAIN_BASE } from "./constants.js";
import { ensureBraidUnlock, braidChainMultiplier, ensureBraidBase } from "./braid.js";
import { timePlayed, aggregateStats, } from "./stats.js";

import { getBuildInfo } from "./build-info.js";
import type { BuildInfo } from "./build-info.js";
import { ensureThemeStyles, readStoredTheme, applyThemeChoice, THEME_OPTIONS } from "./theme.js";
import type { ThemeChoice } from "./theme.js";
import {
  getActiveSlot,
  listSlots,
  switchActiveSlot,
  createSlot as createSaveSlot,
  deleteSlot as deleteSaveSlot,
  renameSlot as renameSaveSlot,
  exportSlot,
  importIntoActiveSlot,
  getAutosaveInterval,
  setAutosaveInterval,
  resetActiveSlot as overwriteActiveSlot,
  MIN_AUTOSAVE_INTERVAL_MS,
  MAX_AUTOSAVE_INTERVAL_MS,
  type SaveSlotSummary,
  type LoadedSlot,
} from "./saving.js";

type Dec = InstanceType<typeof Decimal>;
const D = (x:number | string| Dec) => 
    x instanceof Decimal ? x : new Decimal(x);

const freshSerializedState = (): SerializedGameState => serializeGameState(newState());
const IS_PROD_BUILD = typeof import.meta !== "undefined" && typeof import.meta.env === "object" && import.meta.env?.PROD === true;

// ---- DOM ----
const stringsEl = document.getElementById("strings")!;
const stringsPerSecEl = document.getElementById("strings-ps") as HTMLSpanElement | null;
const gensContainer = document.getElementById("gens")!;
const settingsContainer = document.getElementById("settings-container") as HTMLDivElement | null;
const maxAllBtn = document.getElementById("max-all") as HTMLButtonElement | null;
const braidPanel = document.getElementById("braid-panel") as HTMLDivElement | null;
const devTabBtn = document.getElementById("dev-tab-btn") as HTMLButtonElement | null;
const devTabView = document.getElementById("tab-dev") as HTMLElement | null;
const devToolsContainer = document.getElementById("dev-tools") as HTMLDivElement | null;

const braidResetBtn = document.getElementById("braid-reset") as HTMLButtonElement | null;
const braidBestEl = document.getElementById("braid-best") as HTMLSpanElement | null;
const braidLastEl = document.getElementById("braid-last") as HTMLSpanElement | null;
const braidCountEl = document.getElementById("braid-count") as HTMLSpanElement | null;
const braidPathsContainer = document.getElementById("braid-paths") as HTMLDivElement | null;

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

let stringsPerSecond = new Decimal(0);
let lastSnapshotStrings: Decimal | null = null;
let lastSnapshotTime = performance.now();

function resetStringRateTracking(current: Decimal) {
  stringsPerSecond = new Decimal(0);
  lastSnapshotStrings = new Decimal(current.toString());
  lastSnapshotTime = performance.now();
  if (stringsPerSecEl) {
    stringsPerSecEl.textContent = format(stringsPerSecond);
  }
}

function updateStringRateFromSnapshot(nextState: GameState, now: number) {
  if (lastSnapshotStrings) {
    const deltaTime = (now - lastSnapshotTime) / 1000;
    if (deltaTime > 1e-3) {
      const deltaStrings = nextState.strings.sub(lastSnapshotStrings);
      if (deltaStrings.greaterThanOrEqualTo(0)) {
        stringsPerSecond = deltaStrings.div(deltaTime);
      } else {
        stringsPerSecond = new Decimal(0);
      }
    }
  } else {
    stringsPerSecond = new Decimal(0);
  }
  lastSnapshotStrings = new Decimal(nextState.strings.toString());
  lastSnapshotTime = now;
  if (stringsPerSecEl) {
    stringsPerSecEl.textContent = format(stringsPerSecond);
  }
}

const RIBBON_STORAGE_KEY = "ui-dev-ribbon";
let currentTheme: ThemeChoice = "default";
let forcedRibbonMode: "show" | "hide" | null = null;
let defaultRibbonVisible = false;
let currentBuildInfo: BuildInfo | null = null;
let updateMiscBuildInfo: (() => void) | null = null;
let devTabShouldBeVisible = !IS_PROD_BUILD;
let devToolsBuilt = false;
let simWorkerReady = false;
let currentTab: TabName = "game";

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

function updateDevTabVisibility() {
  if (!devTabBtn || !devTabView) return;
  const allow = !IS_PROD_BUILD && devTabShouldBeVisible;
  devTabBtn.hidden = !allow;
  devTabView.hidden = !allow;
  if (!allow) {
    if (currentTab === "dev") {
      activateTab("game");
    }
    return;
  }
  if (!simWorkerReady) {
    return;
  }
  if (!devToolsBuilt) {
    buildDevTools();
    devToolsBuilt = true;
  }
}

currentTheme = readStoredTheme();
applyThemeChoice(currentTheme, false);
forcedRibbonMode = readRibbonPreference();
updateDevRibbonDisplay();
updateDevTabVisibility();

type SettingsTabId = "saving" | "appearance" | "misc";
type TabName = "game" | "stats" | "settings" | "dev";

function applyBuildInfo() {
  getBuildInfo()
    .then(info => {
      currentBuildInfo = info;
      if (!info) {
        buildInfoFooter.textContent = 'Build info unavailable';
        defaultRibbonVisible = false;
        devTabShouldBeVisible = !IS_PROD_BUILD && devTabShouldBeVisible;
        updateDevRibbonDisplay();
        updateDevTabVisibility();
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
      devTabShouldBeVisible = !IS_PROD_BUILD && info.env !== 'production';
      updateDevRibbonDisplay();
      updateDevTabVisibility();
      if (updateMiscBuildInfo) updateMiscBuildInfo();
    })
    .catch(() => {
      currentBuildInfo = null;
      buildInfoFooter.textContent = 'Build info unavailable';
      defaultRibbonVisible = false;
      devTabShouldBeVisible = !IS_PROD_BUILD && devTabShouldBeVisible;
      updateDevRibbonDisplay();
      updateDevTabVisibility();
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

    const status = document.createElement('div');
    status.className = 'settings-status';

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

    const intro = document.createElement('p');
    intro.className = 'settings-note';
    panel.appendChild(intro);

    const autosaveSeconds = () => Math.round(autosaveIntervalMs / 1000);
    function updateAutosaveNote() {
      intro.textContent = `Autosaves run every ${autosaveSeconds()}s. Adjust the interval or manage additional slots below.`;
    }
    updateAutosaveNote();

    const slotField = document.createElement('div');
    slotField.className = 'settings-field';

    const slotLabel = document.createElement('label');
    slotLabel.htmlFor = 'settings-slot-select';
    slotLabel.textContent = 'Active save slot';

    const slotSelect = document.createElement('select');
    slotSelect.id = 'settings-slot-select';

    const slotButtons = document.createElement('div');
    slotButtons.className = 'settings-button-row';

    const newSlotBtn = document.createElement('button');
    newSlotBtn.type = 'button';
    newSlotBtn.className = 'settings-btn';
    newSlotBtn.textContent = 'New Slot';

    const renameSlotBtn = document.createElement('button');
    renameSlotBtn.type = 'button';
    renameSlotBtn.className = 'settings-btn';
    renameSlotBtn.textContent = 'Rename';

    const deleteSlotBtn = document.createElement('button');
    deleteSlotBtn.type = 'button';
    deleteSlotBtn.className = 'settings-btn danger';
    deleteSlotBtn.textContent = 'Delete Slot';

    slotButtons.append(newSlotBtn, renameSlotBtn, deleteSlotBtn);
    slotField.append(slotLabel, slotSelect, slotButtons);
    panel.appendChild(slotField);

    function refreshSlotControls(selectedId?: string) {
      const slots = listSlots();
      const targetId = selectedId ?? activeSlot?.id ?? slots[0]?.id ?? '';
      slotSelect.innerHTML = '';
      slots.forEach(slot => {
        const option = document.createElement('option');
        option.value = slot.id;
        option.textContent = slot.name;
        slotSelect.appendChild(option);
      });
      if (targetId) {
        slotSelect.value = targetId;
      }
      slotSelect.disabled = slots.length === 0;
      renameSlotBtn.disabled = slots.length === 0;
      deleteSlotBtn.disabled = slots.length <= 1;
      const titleName = activeSlot?.name ?? '—';
      slotLabel.textContent = titleName === '—'
        ? 'Active save slot'
        : `Active save slot — ${titleName}`;
    }

    function applyLoadedSlot(loaded: LoadedSlot, message?: string) {
      const nextState = deserializeGameState(loaded.data);
      state = nextState;
      const unlocked = ensureBraidUnlock(state);
      const synced = ensureBraidBase(state);
      if (unlocked || synced) {
        saveState(state);
      }
      resetStringRateTracking(state.strings);
      render();
      const serialized = serializeGameState(state);
      simWorker.postMessage({ type: 'replaceState', state: serialized });
      lastSaveTimestamp = performance.now();
      activeSlot = getActiveSlot();
      refreshSlotControls(activeSlot?.id);
      if (message) {
        showStatus(message);
      }
    }

    slotSelect.addEventListener('change', () => {
      const selectedId = slotSelect.value;
      if (!selectedId || selectedId === activeSlot?.id) return;
      const loaded = switchActiveSlot(selectedId, freshSerializedState());
      if (!loaded) {
        showStatus('Failed to switch slots.', 'error');
        refreshSlotControls();
        return;
      }
      applyLoadedSlot(loaded, `Switched to ${loaded.slot.name}.`);
    });

    newSlotBtn.addEventListener('click', () => {
      const defaultName = `Slot ${listSlots().length + 1}`;
      const proposed = typeof window !== 'undefined' && typeof window.prompt === 'function'
        ? window.prompt('Name for the new slot?', defaultName)
        : defaultName;
      const picked = (proposed ?? defaultName).trim();
      const loaded = createSaveSlot(picked.length > 0 ? picked : defaultName, freshSerializedState());
      applyLoadedSlot(loaded, `Created ${loaded.slot.name}.`);
    });

    renameSlotBtn.addEventListener('click', () => {
      if (!activeSlot) return;
      const proposed = typeof window !== 'undefined' && typeof window.prompt === 'function'
        ? window.prompt('Rename slot', activeSlot.name)
        : activeSlot.name;
      if (proposed == null) return;
      const trimmed = proposed.trim();
      if (!trimmed) {
        showStatus('Slot name cannot be empty.', 'error');
        return;
      }
      const updated = renameSaveSlot(activeSlot.id, trimmed);
      if (!updated) {
        showStatus('Rename failed.', 'error');
        return;
      }
      activeSlot = updated;
      refreshSlotControls(updated.id);
      showStatus(`Renamed slot to ${updated.name}.`);
    });

    deleteSlotBtn.addEventListener('click', () => {
      if (!activeSlot) return;
      const allowed = typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm(`Delete ${activeSlot.name}? This cannot be undone.`)
        : true;
      if (!allowed) return;
      const loaded = deleteSaveSlot(activeSlot.id, freshSerializedState());
      applyLoadedSlot(loaded, `Deleted slot. Now using ${loaded.slot.name}.`);
    });

    const autosaveField = document.createElement('div');
    autosaveField.className = 'settings-field';

    const autosaveLabel = document.createElement('label');
    autosaveLabel.htmlFor = 'settings-autosave-input';
    autosaveLabel.textContent = 'Autosave interval (seconds)';

    const autosaveInput = document.createElement('input');
    autosaveInput.type = 'number';
    autosaveInput.id = 'settings-autosave-input';
    autosaveInput.min = String(Math.round(MIN_AUTOSAVE_INTERVAL_MS / 1000));
    autosaveInput.max = String(Math.round(MAX_AUTOSAVE_INTERVAL_MS / 1000));
    autosaveInput.step = '1';
    autosaveInput.value = String(autosaveSeconds());
    autosaveInput.title = `Between ${Math.round(MIN_AUTOSAVE_INTERVAL_MS / 1000)} and ${Math.round(MAX_AUTOSAVE_INTERVAL_MS / 1000)} seconds`;

    autosaveInput.addEventListener('change', () => {
      const seconds = Number(autosaveInput.value);
      if (!Number.isFinite(seconds) || seconds <= 0) {
        showStatus('Enter a valid number of seconds.', 'error');
        autosaveInput.value = String(autosaveSeconds());
        return;
      }
      const updated = setAutosaveInterval(seconds * 1000);
      autosaveIntervalMs = updated;
      autosaveInput.value = String(Math.round(updated / 1000));
      updateAutosaveNote();
      lastSaveTimestamp = performance.now();
      showStatus(`Autosave interval set to ${Math.round(updated / 1000)}s.`);
    });

    autosaveField.append(autosaveLabel, autosaveInput);
    panel.appendChild(autosaveField);

    const buttonRow = document.createElement('div');
    buttonRow.className = 'settings-button-row';

    const manualSaveBtn = document.createElement('button');
    manualSaveBtn.type = 'button';
    manualSaveBtn.className = 'settings-btn';
    manualSaveBtn.textContent = 'Save Now';
    manualSaveBtn.addEventListener('click', () => {
      saveState(state);
      lastSaveTimestamp = performance.now();
      activeSlot = getActiveSlot();
      refreshSlotControls(activeSlot?.id);
      showStatus(`Saved ${activeSlot?.name ?? 'slot'} at ${new Date().toLocaleTimeString()}.`);
    });

    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.className = 'settings-btn';
    exportBtn.textContent = 'Copy Save to Clipboard';
    exportBtn.addEventListener('click', async () => {
      try {
        const payload = exportSlot(activeSlot?.id);
        if (!payload) {
          showStatus('No save data available to export.', 'error');
          return;
        }
        const text = JSON.stringify(payload, null, 2);
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
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

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'settings-btn danger';
    resetBtn.textContent = 'Reset Slot';
    resetBtn.addEventListener('click', () => {
      if (!activeSlot) return;
      const allowed = typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm(`Reset ${activeSlot.name}? This cannot be undone.`)
        : true;
      if (!allowed) return;
      const loaded = overwriteActiveSlot(freshSerializedState(), activeSlot.name);
      applyLoadedSlot(loaded, `Reset ${loaded.slot.name}.`);
    });

    buttonRow.append(manualSaveBtn, exportBtn, resetBtn);
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
        const loaded = importIntoActiveSlot(raw, freshSerializedState());
        if (!loaded) {
          showStatus('Import failed. Please verify the JSON payload.', 'error');
          return;
        }
        importArea.value = '';
        applyLoadedSlot(loaded, `Imported data into ${loaded.slot.name}.`);
      } catch (err) {
        console.error('Import failed:', err);
        showStatus('Import failed. Please verify the JSON payload.', 'error');
      }
    });

    importActions.appendChild(importBtn);
    importField.append(importLabel, importArea, importActions);
    panel.appendChild(importField);

    panel.appendChild(status);

    const hint = document.createElement('p');
    hint.className = 'settings-note';
    hint.textContent = 'Tip: manual saves and imports apply to the selected slot. Autosaves also run shortly before closing the tab.';
    panel.appendChild(hint);

    refreshSlotControls(activeSlot?.id);
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

function buildDevTools() {
  if (!devToolsContainer) return;
  devToolsContainer.innerHTML = '';

  const note = document.createElement('p');
  note.className = 'settings-note';
  note.textContent = 'Developer shortcuts. Cheats apply instantly and save immediately.';
  devToolsContainer.appendChild(note);

  const stringsField = document.createElement('div');
  stringsField.className = 'dev-field';

  const stringsLabel = document.createElement('label');
  stringsLabel.htmlFor = 'dev-add-strings';
  stringsLabel.textContent = 'Add Strings';

  const stringsInput = document.createElement('input');
  stringsInput.type = 'text';
  stringsInput.id = 'dev-add-strings';
  stringsInput.placeholder = 'e.g. 1e30';

  const stringsBtn = document.createElement('button');
  stringsBtn.type = 'button';
  stringsBtn.textContent = 'Grant';
  stringsBtn.addEventListener('click', () => {
    const raw = stringsInput.value.trim();
    if (!raw) return;
    try {
      const amount = new Decimal(raw);
      if (amount.lessThanOrEqualTo(0)) return;
      simWorker.postMessage({ type: 'action', action: 'devAddStrings', amount: amount.toString() });
    } catch {
      console.warn('Invalid string grant amount');
    }
  });

  stringsField.append(stringsLabel, stringsInput, stringsBtn);
  devToolsContainer.appendChild(stringsField);

  const gensField = document.createElement('div');
  gensField.className = 'dev-field';

  const gensLabel = document.createElement('label');
  gensLabel.textContent = 'Add Generators';
  gensLabel.htmlFor = 'dev-add-gens';

  const tierSelect = document.createElement('select');
  tierSelect.id = 'dev-add-gens-tier';
  GEN_CFG.forEach(cfg => {
    const option = document.createElement('option');
    option.value = String(cfg.tier);
    option.textContent = cfg.name;
    tierSelect.appendChild(option);
  });

  const gensInput = document.createElement('input');
  gensInput.type = 'number';
  gensInput.id = 'dev-add-gens';
  gensInput.min = '1';
  gensInput.step = '1';
  gensInput.value = '1';

  const gensBtn = document.createElement('button');
  gensBtn.type = 'button';
  gensBtn.textContent = 'Grant';
  gensBtn.addEventListener('click', () => {
    const tier = Number(tierSelect.value);
    const amount = Math.floor(Number(gensInput.value));
    if (!Number.isFinite(amount) || amount <= 0) return;
    simWorker.postMessage({ type: 'action', action: 'devAddGenerators', tier, amount });
  });

  gensField.append(gensLabel, tierSelect, gensInput, gensBtn);
  devToolsContainer.appendChild(gensField);
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

type BraidPathRefs = {
  multiplier: HTMLSpanElement;
  targets: HTMLSpanElement;
};

function describeChainTargets(tiers: readonly number[]): string {
  const gens = tiers.map(tier => tier + 1);
  return `Boosts Gen ${gens.join(', ')}`;
}

function buildBraidPathRows(): BraidPathRefs[] {
  if (!braidPathsContainer) return [];
  braidPathsContainer.innerHTML = '';
  return BRAID_PATHS.map((tiers, index) => {
    const row = document.createElement('div');
    row.className = 'braid-path-row';

    const info = document.createElement('div');
    info.className = 'braid-path-info';

    const label = document.createElement('div');
    label.className = 'braid-path-label';
    label.textContent = `Chain ${index + 1} (Gen ${tiers.map(t => t + 1).join(', ')})`;

    const targets = document.createElement('div');
    //DO NOT REMOVE THIS COMMENT: Too much text
    //targets.className = 'braid-path-targets';
    //targets.textContent = describeChainTargets(tiers);

    info.append(label, targets);

    const multiplier = document.createElement('span');
    multiplier.className = 'braid-path-mult';
    multiplier.textContent = '×1.000';

    row.append(info, multiplier);
    braidPathsContainer.appendChild(row);
    return { multiplier, targets };
  });
}

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
    simWorker.postMessage({ type: "action", action: "buyOne", tier });
  });

  return { row, name, units, bought, multiplier, nextCost, buy1: buy1Btn };
}

let state: GameState = loadState();
const unlockChanged = ensureBraidUnlock(state);
const baseSynced = ensureBraidBase(state);
if (unlockChanged || baseSynced) {
  saveState(state);
}
let activeSlot: SaveSlotSummary | null = getActiveSlot();
let autosaveIntervalMs = getAutosaveInterval();
resetStringRateTracking(state.strings);
const rows: RowRefs[] = [];

let braidRows: BraidPathRefs[] = [];

const BRAID_BASE_LOG10 = BRAID_CHAIN_BASE.log10();

const simWorker = new Worker(new URL('./simWorker.ts', import.meta.url), { type: 'module' });
simWorkerReady = true;
updateDevTabVisibility();
const initialOfflineSeconds = Math.max(0, (Date.now() - state.lastTick) / 1000);
let lastSaveTimestamp = performance.now();

simWorker.postMessage({
  type: 'init',
  state: serializeGameState(state),
  offlineSeconds: initialOfflineSeconds,
});

for (let t = 0; t < GEN_CFG.length; t++) rows.push(makeRow(t));

setupSettingsUI();

if (maxAllBtn) {
  maxAllBtn.addEventListener("click", () => {
    simWorker.postMessage({ type: "action", action: "buyMaxAll" });
  });
}

if (braidResetBtn) {
  braidResetBtn.addEventListener('click', () => {
    simWorker.postMessage({ type: 'action', action: 'braidReset' });
  });
}
//#region keybindings;
document.addEventListener("keydown", event => {
  if (event.key === "m" || event.key === "M") {
    simWorker.postMessage({ type: "action", action: "buyMaxAll" });
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

function formatMultiplier(mult: Dec): string {
  if (mult.lessThan(1000)) {
    const num = mult.toNumber();
    const digits = mult.lessThan(1.1) ? 3 : 2;
    return num.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
  return format(mult);
}

function formatChainDisplay(mult: Dec): string {
  if (mult.lessThanOrEqualTo(0)) return '×1.000';
  const exponent = BRAID_BASE_LOG10.equals(0) ? new Decimal(0) : mult.log10().div(BRAID_BASE_LOG10);
  const expNum = exponent.toNumber();
  const expText = Number.isFinite(expNum) ? expNum.toFixed(3) : exponent.toString();
  const baseText = BRAID_CHAIN_BASE.toNumber().toFixed(2);
  return `${baseText}^${expText} (×${formatMultiplier(mult)})`;
}

function renderBraidPanel() {
  if (!state.braid || !braidPanel) return;
  const unlocked = state.braid.unlocked;
  braidPanel.hidden = !unlocked;
  if (!unlocked) {
    if (braidResetBtn) braidResetBtn.disabled = true;
    return;
  }
  if (!braidRows.length) {
    braidRows = buildBraidPathRows();
  }
  if (braidBestEl) braidBestEl.textContent = format(state.braid.bestStrings);
  if (braidLastEl) braidLastEl.textContent = format(state.braid.lastResetStrings);
  if (braidCountEl) braidCountEl.textContent = state.braid.resets.toLocaleString();
  if (braidResetBtn) {
    const canReset = state.braid.unlocked && state.strings.greaterThan(0) && state.strings.greaterThanOrEqualTo(state.braid.bestStrings);
    braidResetBtn.disabled = !canReset;
  }
  braidRows.forEach((row, idx) => {
    const path = BRAID_PATHS[idx];
    const referenceTier = path && path.length > 0 ? path[0] : idx;
    const multiplier = braidChainMultiplier(state, referenceTier);
    if (!row || !multiplier) return;
    row.multiplier.textContent = formatChainDisplay(multiplier);
  });
}

// ---- render ----
function render() {
  if (statsActive) {
    renderStats();
  }

  stringsEl.textContent = format(state.strings);
  if (stringsPerSecEl) {
    stringsPerSecEl.textContent = format(stringsPerSecond);
  }

  renderBraidPanel();

  for (let t = 0; t < GEN_CFG.length; t++) {
    const cfg = GEN_CFG[t];
    const r = rows[t];
    const gen = state.gens[t];
    if (!cfg || !r || !gen) continue;
    r.units.textContent = format(gen.units);
    r.bought.textContent = String(gen.bought);
    const braidBonus = braidChainMultiplier(state, t);
    const totalMult = PER_PURCHASE_MULT.pow(gen.bought).mul(braidBonus);
    r.multiplier.textContent = format(totalMult);
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

function activateTab(name: TabName) {
  // highlight the active button
  tabButtons.forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  // show the correct tab view
  tabViews.forEach(v => v.classList.toggle("active", v.id === `tab-${name}`));

  currentTab = name;
  // only render stats when Stats tab is activated
  statsActive = name === "stats";
  if (statsActive) {
    queueMicrotask(() => renderStats());
  }
}

tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const name = (btn.dataset.tab as TabName) ?? "game";
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
      ['Total Strings Produced', format(state.totalStringsProduced)],
      ['Strings Owned', format(state.strings)],
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

simWorker.addEventListener("message", event => {
  const msg = event.data;
  if (!msg || typeof msg !== "object") return;

  switch (msg.type) {
    case "state": {
      const snapshot = msg.snapshot as SerializedGameState;
      const now = performance.now();
      const nextState = deserializeGameState(snapshot);
      updateStringRateFromSnapshot(nextState, now);
      state = nextState;
      render();
      if (now - lastSaveTimestamp > autosaveIntervalMs) {
        saveState(state);
        lastSaveTimestamp = now;
        activeSlot = getActiveSlot();
      }
      break;
    }
    case "log": {
      const level = msg.level === "warn" ? "warn" : "info";
      const prefixed = `[sim] ${msg.message}`;
      if (level === "warn") {
        console.warn(prefixed);
      } else {
        console.info(prefixed);
      }
      break;
    }
    default:
      break;
  }
});

simWorker.addEventListener("error", event => {
  console.error("Simulation worker error:", event);
});

render();
