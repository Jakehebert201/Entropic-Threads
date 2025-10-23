import Decimal from "break_eternity.js";
import { loadState, saveState, newState, clearState } from "./state.js";
import { tick, buyMax, buyMaxAll } from "./game.js";
import { GEN_CFG } from "./generators.js";
import { nextCost } from "./economy.js";
import { PER_PURCHASE_MULT } from "./constants.js";

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
  buyMax: HTMLButtonElement;
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

  const buyMaxBtn = document.createElement("button");
  buyMaxBtn.textContent = "Max";

  const buttonGroup = document.createElement("div");
  buttonGroup.className = "gen-row-buttons";
  buttonGroup.append(buyMaxBtn);

  row.append(name, units, bought, multiplier, nextCost, buttonGroup);
  gensContainer.appendChild(row);

  // Wire handlers
  buyMaxBtn.addEventListener("click", () => {
    const got: boolean = buyMax(state, tier); // returns success/failure
    if (got) {
      render();
    }
  });

  return { row, name, units, bought, multiplier, nextCost, buyMax: buyMaxBtn };
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

// ---- formatting helpers ----
function format(d: Dec): string {
  // small -> locale number; large -> scientific like 1.234e123
  if (d.lessThan(1e6)) return d.toNumber().toLocaleString();
  // @ts-ignore (mantissa/exponent exist at runtime in break_eternity)
  if (typeof d.mantissa === "number" && typeof d.exponent === "number") {
    // @ts-ignore
    return `${d.mantissa.toFixed(3)}e${d.exponent}`;
  }
  return d.toString();
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
    r.buyMax.disabled = !canBuy;
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
