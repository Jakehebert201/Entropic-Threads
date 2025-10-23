import Decimal from "break_eternity.js";
import { newGeneratorState } from "./generators.js";
import { save, load } from "./saving.js";
const D = (x) => x instanceof Decimal ? x : new Decimal(x);
const KEY = "state";
export function newState() {
    return {
        strings: new Decimal(10),
        gens: newGeneratorState(),
        lastTick: Date.now(),
    };
}
export function loadState() {
    const raw = load(KEY, { strings: "10", gens: [], lastTick: Date.now() });
    const gens = raw.gens?.length
        ? raw.gens.map(g => ({ units: new Decimal(g.units), bought: g.bought | 0 }))
        : newGeneratorState();
    return {
        strings: new Decimal(raw.strings ?? "10"),
        gens,
        lastTick: raw.lastTick ?? Date.now(),
    };
}
export function saveState(s) {
    save(KEY, {
        strings: s.strings.toString(),
        gens: s.gens.map(g => ({ units: g.units.toString(), bought: g.bought })),
        lastTick: s.lastTick,
    });
}
//# sourceMappingURL=state.js.map