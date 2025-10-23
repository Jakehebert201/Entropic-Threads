import Decimal from "break_eternity.js";
import { GEN_CFG } from "./generators.js";
import type { GeneratorConfig } from "./generators.js";
import { braidMultiplier, nextCost, totalCostFor } from "./economy.js";
import { SUPER_START, SUPER_STEP, costMultForTier, PER_PURCHASE_MULT } from "./constants.js";
import type { GameState } from "./state.js";
import { saveState } from "./state.js";

export function tick(s: GameState, now = Date.now()) {
  const dt = Math.min((now - s.lastTick) / 1000, 0.5); // cap dt to avoid huge spikes
  if (dt <= 0) { s.lastTick = now; return; }

  // Cascade: high → low, with per-purchase power applied to the producing tier.
  for (let i = GEN_CFG.length - 1; i >= 1; i--) {
    const gen = s.gens[i];
    const cfg = GEN_CFG[i];
    const lower = s.gens[i - 1];
    if (!gen || !cfg || !lower) continue;

    const power = PER_PURCHASE_MULT.pow(gen.bought);         // 2^bought_i
    const effRate = cfg.prodRate.mul(power);              // boosted rate for this tier
    const produced = gen.units.mul(effRate).mul(dt);

    lower.units = lower.units.add(produced);
  }

  // Strings from Gen1 (also boosted by its own purchases), then braid multiplier.
  const gen0 = s.gens[0];
  const cfg0 = GEN_CFG[0];
  if (gen0 && cfg0) {
    const g0Power = PER_PURCHASE_MULT.pow(gen0.bought);      // 2^bought_0
    const baseStrings = gen0.units.mul(cfg0.prodRate.mul(g0Power)).mul(dt);
    s.strings = s.strings.add(baseStrings.mul(braidMultiplier(s)));
  }

  s.lastTick = now;
}

export function buyOne(s: GameState, tier: number): boolean {
  const cfg = GEN_CFG[tier];
  const gen = s.gens[tier];
  if (!cfg || !gen) return false;

  const cost = nextCost(cfg, gen.bought);
  if (s.strings.lessThan(cost)) return false;

  s.strings = s.strings.sub(cost);
  gen.units = gen.units.add(1);
  gen.bought += 1;
  saveState(s);
  return true;
}

export function buyN(s: GameState, tier: number, n: number): boolean {
  if (n <= 0) return false;

  const cfg = GEN_CFG[tier];
  const gen = s.gens[tier];
  if (!cfg || !gen) return false;

  const cost = totalCostFor(cfg, gen.bought, n);
  if (s.strings.lessThan(cost)) return false;

  s.strings = s.strings.sub(cost);
  gen.units = gen.units.add(n);
  gen.bought += n;
  saveState(s);
  return true;
}

export function buyMax(s: GameState, tier: number): boolean {
  const cfg = GEN_CFG[tier];
  const gen = s.gens[tier];
  if (!cfg || !gen) return false;

  const { count, cost } = maxAffordablePurchase(cfg, gen.bought, s.strings);
  if (count <= 0) return false;

  s.strings = s.strings.sub(cost);
  gen.units = gen.units.add(count);
  gen.bought += count;
  saveState(s);
  return true;
}

export function buyMaxAll(s: GameState): boolean {
  let purchased = false;
  for (let tier = GEN_CFG.length - 1; tier >= 0; tier--) {
    const cfg = GEN_CFG[tier];
    const gen = s.gens[tier];
    if (!cfg || !gen) continue;
    const { count, cost } = maxAffordablePurchase(cfg, gen.bought, s.strings);
    if (count <= 0) continue;
    s.strings = s.strings.sub(cost);
    gen.units = gen.units.add(count);
    gen.bought += count;
    purchased = true;
  }
  if (purchased) saveState(s);
  return purchased;
}

// -------- internals --------

function maxAffordablePurchase(cfg: GeneratorConfig, bought: number, budget: Decimal) {
  if (budget.lessThanOrEqualTo(0)) {
    return { count: 0, cost: new Decimal(0) };
  }

  // Exponential search to find an upper bound
  let bestCount = 0;
  let bestCost = new Decimal(0);
  let high = 1;
  let highCost = totalCostFrom(cfg, bought, high);

  while (highCost.lessThanOrEqualTo(budget)) {
    bestCount = high;
    bestCost = highCost;
    high <<= 1;
    highCost = totalCostFrom(cfg, bought, high);
  }

  // Binary search between bestCount and high
  let low = bestCount;
  while (low + 1 < high) {
    const mid = (low + high) >> 1;
    const cost = totalCostFrom(cfg, bought, mid);
    if (cost.lessThanOrEqualTo(budget)) {
      low = mid;
      bestCount = mid;
      bestCost = cost;
    } else {
      high = mid;
    }
  }

  return { count: bestCount, cost: bestCost };
}

// Total cost from current 'bought' to buy 'count' more,
// with tier multiplier and super-scaling past SUPER_START.
function totalCostFrom(cfg: GeneratorConfig, bought: number, count: number): Decimal {
  if (count <= 0) return new Decimal(0);

  const ratio = costMultForTier(cfg.tier);
  const baseCostAtBought = cfg.baseCost.mul(ratio.pow(bought));

  let total = new Decimal(0);
  let remaining = count;
  let cursor = bought;

  // Pre-super segment (pure geometric with ratio)
  if (cursor < SUPER_START) {
    const preCount = Math.min(remaining, SUPER_START - cursor);
    if (preCount > 0) {
      total = total.add(geomSum(baseCostAtBought, ratio, preCount));
      cursor += preCount;
      remaining -= preCount;
    }
  }

  if (remaining <= 0) return total;

  // Post-super segment (ratio * SUPER_STEP)
  const advance = cursor - bought;
  let startCost = baseCostAtBought.mul(ratio.pow(advance));
  const superExponent = Math.max(0, cursor - SUPER_START);
  if (superExponent > 0) {
    startCost = startCost.mul(SUPER_STEP.pow(superExponent));
  }

  const postRatio = ratio.mul(SUPER_STEP);
  total = total.add(geomSum(startCost, postRatio, remaining));
  return total;
}

// Geometric sum: start + start*r + ... for 'count' terms
function geomSum(start: Decimal, ratio: Decimal, count: number): Decimal {
  if (count <= 0) return new Decimal(0);
  if (ratio.equals(1)) return start.mul(count);
  return start.mul(ratio.pow(count).sub(1)).div(ratio.sub(1));
}
