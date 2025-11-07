import Decimal from "break_eternity.js";
import { BRAID_CHAIN_BASE, BRAID_GAIN_DIVISOR, BRAID_GAIN_EXPONENT, BRAID_GAIN_OFFSET, BRAID_PATHS, BRAID_UNLOCK_STRINGS, BRAID_PURCHASE_BASE, BRAID_PURCHASE_POWER } from "./constants.js";
import { newGeneratorState } from "./generators.js";
import type { GameState } from "./state.js";

const ONE = new Decimal(1);
const STARTING_STRINGS = new Decimal(2);
const BRAID_PATH_COUNT = BRAID_PATHS.length;

function cloneMultiplier(multiplier: Decimal): Decimal {
  return new Decimal(multiplier);
}

function createChainBaseArray(base: Decimal): Decimal[] {
  return Array.from({ length: BRAID_PATH_COUNT }, () => cloneMultiplier(base));
}

function clampLog(strings: Decimal): number {
  const safe = Decimal.max(strings, ONE);
  const rawLog = safe.log10().toNumber();
  if (!Number.isFinite(rawLog) || rawLog <= 0) return 0;
  const softened = Math.pow(rawLog + BRAID_GAIN_OFFSET, BRAID_GAIN_EXPONENT) - Math.pow(BRAID_GAIN_OFFSET, BRAID_GAIN_EXPONENT);
  const exponent = softened / BRAID_GAIN_DIVISOR;
  return Number.isFinite(exponent) && exponent > 0 ? exponent : 0;
}

function chainPurchaseCount(state: GameState, chainIndex: number): number {
  const tiers = BRAID_PATHS[chainIndex] ?? [];
  let total = 0;
  for (const tier of tiers) {
    const gen = state.gens[tier];
    if (!gen) continue;
    total += gen.bought;
  }
  return total;
}

function chainPurchaseBonus(state: GameState, chainIndex: number): Decimal {
  const total = chainPurchaseCount(state, chainIndex);
  if (total <= 0) return ONE;
  const effective = Math.pow(total, BRAID_PURCHASE_POWER);
  return BRAID_PURCHASE_BASE.pow(effective);
}
function computeBaseFromBestStrings(state: GameState): Decimal {
  return computeChainMultiplierFromStrings(state.braid.bestStrings);
}

export function rebuildBraidBase(state: GameState): Decimal {
  const base = computeBaseFromBestStrings(state);
  state.braid.chainMultipliers = createChainBaseArray(base);
  return base;
}

export function ensureBraidBase(state: GameState): boolean {
  const base = computeBaseFromBestStrings(state);
  const arr = Array.isArray(state.braid.chainMultipliers) ? state.braid.chainMultipliers : [];
  let needsUpdate = arr.length !== BRAID_PATH_COUNT;
  if (!needsUpdate) {
    for (let i = 0; i < BRAID_PATH_COUNT; i++) {
      const entry = arr[i];
      if (!entry || !entry.equals(base)) {
        needsUpdate = true;
        break;
      }
    }
  }
  if (needsUpdate) {
    state.braid.chainMultipliers = createChainBaseArray(base);
    return true;
  }
  return false;
}

export function ensureBraidUnlock(state: GameState): boolean {
  if (state.braid.unlocked) return false;
  const progress = Decimal.max(state.strings, state.braid.bestStrings);
  if (progress.greaterThanOrEqualTo(BRAID_UNLOCK_STRINGS)) {
    state.braid.unlocked = true;
    return true;
  }
  return false;
}

export function braidPathIndexForTier(tier: number): number {
  if (tier < 0) return -1;
  return tier % BRAID_PATH_COUNT;
}

export function computeChainMultiplierFromStrings(strings: Decimal): Decimal {
  const exponent = clampLog(strings);
  if (exponent <= 0) return ONE;
  return BRAID_CHAIN_BASE.pow(exponent);
}

export function braidChainMultiplier(state: GameState, tier: number): Decimal {
  const idx = braidPathIndexForTier(tier);
  if (idx < 0) return ONE;
  const arr = state.braid?.chainMultipliers ?? [];
  const base = arr[idx] ?? ONE;
  return base.mul(chainPurchaseBonus(state, idx));
}

export function canBraidReset(state: GameState): boolean {
  if (!state.braid.unlocked) return false;
  return state.strings.greaterThan(0);
}

export function applyBraidReset(state: GameState): boolean {
  ensureBraidUnlock(state);
  if (!canBraidReset(state)) return false;
  const totalStrings = new Decimal(state.strings);

  state.braid.lastResetStrings = totalStrings;
  if (totalStrings.greaterThan(state.braid.bestStrings)) {
    state.braid.bestStrings = totalStrings;
  }
  state.braid.resets += 1;

  rebuildBraidBase(state);

  state.strings = new Decimal(STARTING_STRINGS);
  state.gens = newGeneratorState();
  state.lastTick = Date.now();
  state.created = Date.now();
  return true;
}
