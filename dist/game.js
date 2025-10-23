import Decimal from "break_eternity.js";
import { GEN_CFG } from "./generators.js";
import { braidMultiplier, nextCost, totalCostFor } from "./economy.js";
import { saveState } from "./state.js";
export function tick(s, now = Date.now()) {
    const dt = (now - s.lastTick) / 1000;
    if (dt <= 0) {
        s.lastTick = now;
        return;
    }
    // cascade: high → low
    for (let i = GEN_CFG.length - 1; i >= 1; i--) {
        const gen = s.gens[i];
        const cfg = GEN_CFG[i];
        const lowerTier = s.gens[i - 1];
        if (!gen || !cfg || !lowerTier)
            continue;
        const produced = gen.units.mul(cfg.prodRate).mul(dt);
        lowerTier.units = lowerTier.units.add(produced);
    }
    // strings from Gen1 with braid
    const gen0 = s.gens[0];
    const cfg0 = GEN_CFG[0];
    if (gen0 && cfg0) {
        const strings = gen0.units.mul(cfg0.prodRate).mul(braidMultiplier(s)).mul(dt);
        s.strings = s.strings.add(strings);
    }
    s.lastTick = now;
}
export function buyOne(s, tier) {
    const cfg = GEN_CFG[tier];
    const gen = s.gens[tier];
    if (!cfg || !gen)
        return false;
    const cost = nextCost(cfg, gen.bought);
    if (s.strings.lessThan(cost))
        return false;
    s.strings = s.strings.sub(cost);
    gen.units = gen.units.add(1);
    gen.bought += 1;
    saveState(s);
    return true;
}
export function buyN(s, tier, n) {
    const cfg = GEN_CFG[tier];
    const gen = s.gens[tier];
    if (!cfg || !gen)
        return false;
    const cost = totalCostFor(cfg, gen.bought, n);
    if (s.strings.lessThan(cost))
        return false;
    s.strings = s.strings.sub(cost);
    gen.units = gen.units.add(n);
    gen.bought += n;
    saveState(s);
    return true;
}
export function buyMax(s, tier) {
    const cfg = GEN_CFG[tier];
    const gen = s.gens[tier];
    if (!cfg || !gen)
        return false;
    const currentUnits = gen.units.toNumber();
    const cost = totalCostFor(cfg, gen.bought, currentUnits);
    if (s.strings.lessThan(cost))
        return false;
    s.strings = s.strings.sub(cost);
    gen.units = gen.units.add(currentUnits);
    gen.bought += currentUnits;
    saveState(s);
    return true;
}
//# sourceMappingURL=game.js.map