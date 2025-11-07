import Decimal from "break_eternity.js";
import { BRAID_CHAIN_BASE, BRAID_PATHS } from "../constants.js";
import { braidChainMultiplier } from "../braid.js";
import type { GameState } from "../state.js";

export type BraidPathRefs = {
  multiplier: HTMLSpanElement;
  targets: HTMLSpanElement;
};

export function describeChainTargets(tiers: readonly number[]): string {
  const gens = tiers.map(tier => tier + 1);
  return `Boosts Gen ${gens.join(", ")}`;
}

export function buildBraidPathRows(container: HTMLDivElement | null): BraidPathRefs[] {
  if (!container) return [];
  container.innerHTML = '';
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
    container.appendChild(row);
    return { multiplier, targets };
  });
}

const BRAID_BASE_LOG10 = BRAID_CHAIN_BASE.log10();

function formatMultiplier(mult: Decimal): string {
  if (mult.lessThan(1000)) {
    const num = mult.toNumber();
    const digits = mult.lessThan(1.1) ? 3 : 2;
    return num.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
  return mult.toNumber().toExponential(3);
}

function formatChainDisplay(mult: Decimal): string {
  if (mult.lessThanOrEqualTo(0)) return '×1.000';
  const exponent = BRAID_BASE_LOG10.equals(0) ? new Decimal(0) : mult.log10().div(BRAID_BASE_LOG10);
  const expNum = exponent.toNumber();
  const expText = Number.isFinite(expNum) ? expNum.toFixed(3) : exponent.toString();
  const baseText = BRAID_CHAIN_BASE.toNumber().toFixed(2);
  return `${baseText}^${expText} (×${formatMultiplier(mult)})`;
}

export type BraidPanelRenderOptions = {
  state: GameState;
  panel: HTMLDivElement | null;
  resetButton: HTMLButtonElement | null;
  refs: BraidPathRefs[];
  bestEl: HTMLSpanElement | null;
  lastEl: HTMLSpanElement | null;
  countEl: HTMLSpanElement | null;
  formatNumber: (value: Decimal) => string;
};

export function renderBraidPanel({
  state,
  panel,
  resetButton,
  refs,
  bestEl,
  lastEl,
  countEl,
  formatNumber,
}: BraidPanelRenderOptions) {
  if (!state.braid || !panel) return;
  const unlocked = state.braid.unlocked;
  panel.hidden = !unlocked;
  if (!unlocked) {
    if (resetButton) resetButton.disabled = true;
    return;
  }

  if (bestEl) bestEl.textContent = formatNumber(state.braid.bestStrings);
  if (lastEl) lastEl.textContent = formatNumber(state.braid.lastResetStrings);
  if (countEl) countEl.textContent = state.braid.resets.toLocaleString();
  if (resetButton) {
    const canReset = state.braid.unlocked &&
      state.strings.greaterThan(0) &&
      state.strings.greaterThanOrEqualTo(state.braid.bestStrings);
    resetButton.disabled = !canReset;
  }

  refs.forEach((row, idx) => {
    const path = BRAID_PATHS[idx];
    const referenceTier = path && path.length > 0 ? path[0] : idx;
    const multiplier = braidChainMultiplier(state, referenceTier);
    if (!row || !multiplier) return;
    row.multiplier.textContent = formatChainDisplay(multiplier);
  });
}
