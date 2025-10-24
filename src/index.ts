import Decimal from "break_eternity.js";
import { loadState, saveState, newState, clearState } from "./state.js";
import { tick, buyOne, buyMaxAll } from "./game.js";
import { GEN_CFG } from "./generators.js";
import { nextCost } from "./economy.js";
import { PER_PURCHASE_MULT } from "./constants.js";
import { timePlayed, aggregateStats, } from "./stats.js";

type Dec = InstanceType<typeof Decimal>;
const D = (x:number | string| Dec) => 
    x instanceof Decimal ? x : new Decimal(x);

// ---- DOM ----
const stringsEl = document.getElementById("strings")!;
const gensContainer = document.getElementById("gens")!;
const deleteSaveBtn = document.getElementById("delete-save") as HTMLButtonElement | null;
const maxAllBtn = document.getElementById("max-all") as HTMLButtonElement | null;

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
const rows: RowRefs[] = [];
for (let t = 0; t < GEN_CFG.length; t++) rows.push(makeRow(t));

if (deleteSaveBtn) {
  deleteSaveBtn.addEventListener("click", () => {
    const shouldReset = typeof window !== "undefined" && typeof window.confirm === "function"
      ? window.confirm("Delete all progress? This cannot be undone.")
      : true;
    if (!shouldReset) return;
    clearState();
    const fresh = newState();
    state.strings = fresh.strings;
    state.gens = fresh.gens;
    state.lastTick = fresh.lastTick;
    render();
  });
}
if (maxAllBtn) {
  maxAllBtn.addEventListener("click", () => {
    if (buyMaxAll(state)) {
      render();
    }
  });
}

document.addEventListener("keydown", event => {
  if (event.key === "m" || event.key === "M") {
    if (buyMaxAll(state)) {
      render();
    }
  }
});

// ---- formatting helpers ----
function format(d: Dec): string {
  // small -> locale number; large -> scientific like 1.234e123
  if (d.lessThan(1e6)) return (Math.round(d.toNumber() * 10) / 10).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  // @ts-ignore (mantissa/exponent exist at runtime in break_eternity)
  if (typeof d.mantissa === "number" && typeof d.exponent === "number") {
    // @ts-ignore
    return `${d.mantissa.toFixed(3)}e${d.exponent}`;
  }
  return d.toNumber().toExponential(3);
}

// ---- render ----
function render() {
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

function activateTab(name: "game" | "stats") {
  // highlight the active button
  tabButtons.forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  // show the correct tab view
  tabViews.forEach(v => v.classList.toggle("active", v.id === `tab-${name}`));

  // only render stats when Stats tab is activated
  if (name === "stats") {
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
      ['Total Generator Units', toStr(totalUnits)],
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


// ---- main loop + autosave ----
let lastSave = performance.now();
function loop(ts: number) {
  tick(state);
  render();
  if (ts - lastSave > 10_000) {
    saveState(state);
    lastSave = ts;
  }
  requestAnimationFrame(loop);
}

render();
requestAnimationFrame(loop);
