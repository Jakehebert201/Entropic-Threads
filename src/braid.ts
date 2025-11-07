import Decimal from "break_eternity.js";
import { BRAID_CHAIN_BASE, BRAID_GAIN_DIVISOR, BRAID_GAIN_EXPONENT, BRAID_PATHS, BRAID_UNLOCK_STRINGS } from "./constants.js";
import { newGeneratorState } from "./generators.js";
import type { GameState } from "./state.js";

const ONE = new Decimal(1);
const STARTING_STRINGS = new Decimal(2);
const BRAID_PATH_COUNT = BRAID_PATHS.length;

function clampLog(strings: Decimal): number {
  const safe = Decimal.max(strings, ONE);
  const log = safe.log10();
  if (!Number.isFinite(log) || log <= 0) return 0;
  const exponent = Math.pow(log, BRAID_GAIN_EXPONENT) / BRAID_GAIN_DIVISOR;
  return Number.isFinite(exponent) && exponent > 0 ? exponent : 0;
}

function cloneMultiplier(multiplier: Decimal): Decimal {
  return new Decimal(multiplier);
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
  return arr[idx] ?? ONE;
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

  const multiplier = computeChainMultiplierFromStrings(state.braid.bestStrings);
  state.braid.chainMultipliers = Array.from({ length: BRAID_PATH_COUNT }, () => cloneMultiplier(multiplier));

  state.strings = new Decimal(STARTING_STRINGS);
  state.gens = newGeneratorState();
  state.lastTick = Date.now();
  state.created = Date.now();
  return true;
}
