import Decimal from "break_eternity.js";
import { loadState, saveState } from "./state.js";
import { tick, buyOne, buyN, buyMax } from "./game.js";
import { GEN_CFG } from "./generators.js";
import { nextCost, totalCostFor } from "./economy.js";
const D = (x) => x instanceof Decimal ? x : new Decimal(x);
// ---- DOM ----
const stringsEl = document.getElementById("strings");
const gensContainer = document.getElementById("gens");
function makeRow(tier) {
    const cfg = GEN_CFG[tier];
    if (!cfg) {
        throw new Error(`Missing generator config for tier ${tier}`);
    }
    const row = document.createElement("div");
    row.style.display = "grid";
    row.style.gridTemplateColumns = "140px 1fr 1fr 1fr auto auto auto";
    row.style.gap = "8px";
    row.style.alignItems = "center";
    row.style.margin = "6px 0";
    const name = document.createElement("span");
    name.textContent = cfg.name;
    const units = document.createElement("span");
    const bought = document.createElement("span");
    const nextCost = document.createElement("span");
    const buy1 = document.createElement("button");
    buy1.textContent = "Buy 1";
    const buy10 = document.createElement("button");
    buy10.textContent = "Buy 10";
    const buyMaxBtn = document.createElement("button");
    buyMaxBtn.textContent = "Max";
    row.append(name, units, bought, nextCost, buy1, buy10, buyMaxBtn);
    gensContainer.appendChild(row);
    // Wire handlers
    buy1.addEventListener("click", () => {
        if (buyOne(state, tier)) {
            render();
        }
    });
    buy10.addEventListener("click", () => {
        if (buyN(state, tier, 10)) {
            render();
        }
    });
    buyMaxBtn.addEventListener("click", () => {
        const got = buyMax(state, tier); // returns success/failure
        if (got) {
            render();
        }
    });
    return { row, name, units, bought, nextCost, buy1, buy10, buyMax: buyMaxBtn };
}
const state = loadState();
const rows = [];
for (let t = 0; t < GEN_CFG.length; t++)
    rows.push(makeRow(t));
// ---- formatting helpers ----
function format(d) {
    // small -> locale number; large -> scientific like 1.234e123
    if (d.lessThan(1e6))
        return d.toNumber().toLocaleString();
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
        if (!cfg || !r || !gen)
            continue;
        r.units.textContent = format(gen.units);
        r.bought.textContent = String(gen.bought);
        r.nextCost.textContent = format(nextCost(cfg, gen.bought));
        // enable/disable buttons based on affordability
        const canBuy1 = state.strings.greaterThanOrEqualTo(nextCost(cfg, gen.bought));
        const canBuy10 = state.strings.greaterThanOrEqualTo(totalCostFor(cfg, gen.bought, 10));
        const canBuyMax = canBuy1; // at least one
        r.buy1.disabled = !canBuy1;
        r.buy10.disabled = !canBuy10;
        r.buyMax.disabled = !canBuyMax;
    }
}
// ---- main loop + autosave ----
let lastSave = performance.now();
function loop(ts) {
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
//# sourceMappingURL=index.js.map