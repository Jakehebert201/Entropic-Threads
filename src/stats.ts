import Decimal from "break_eternity.js";
import type { GameState } from "./state.js";

function formatDecimal(value: Decimal): string {
  if (value.lessThan(1e6)) {
    return value.toNumber().toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  // @ts-ignore
  if (typeof value.mantissa === 'number' && typeof value.exponent === 'number') {
    // @ts-ignore
    return `${value.mantissa.toFixed(3)}e${value.exponent}`;
  }
  return value.toString();
}

export function timePlayedMs(state: GameState, now = Date.now()): number {
  const created = state.created ?? now;
  return Math.max(0, now - created);
}

export type TimePlayedBreakdown = {
  totalMilliseconds: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

export function timePlayed(state: GameState, now = Date.now()): TimePlayedBreakdown {
  const totalMilliseconds = timePlayedMs(state, now);
  const totalSeconds = Math.floor(totalMilliseconds / 1000);

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    totalMilliseconds,
    days,
    hours,
    minutes,
    seconds,
  };
}

export type GameStats = {
  totalUnits: Decimal;
  totalBought: number;
  highestTier: number;
};

export function aggregateStats(state: GameState): GameStats {
  const gens = state.gens;
  let totalUnits = new Decimal(0);
  let totalBought = 0;
  let highestTier = -1;

  for (let tier = 0; tier < gens.length; tier++) {
    const gen = gens[tier];
    if (!gen) continue;
    totalUnits = totalUnits.add(gen.units);
    totalBought += gen.bought;
    if (gen.bought > 0 || gen.units.greaterThan(0)) {
      highestTier = tier;
    }
  }

  return {
    totalUnits,
    totalBought,
    highestTier,
  };
}

/** Minimal renderer; expand as you track more stats. */
export function renderStats(state: GameState) {
  const root = document.getElementById("stats-container");
  if (!root) return;

  const t = timePlayed(state);
  const fmt = (n: number) => n.toLocaleString();

  root.innerHTML = `
    <div class="stats">
      <div class="stat">
        <span>Total Strings Produced</span>
        <span class="stat-value">${formatDecimal(state.totalStringsProduced)}</span>
      </div>
      <div class="stat">
        <span>Strings Owned</span>
        <span class="stat-value">${formatDecimal(state.strings)}</span>
      </div>
      <div class="stat">
        <span>Time Played</span>
        <span class="stat-value">${t.days}d ${t.hours}h ${t.minutes}m ${t.seconds}s</span>
      </div>
      <div class="stat">
        <span>Generators Owned</span>
        <span class="stat-value">${
          state.gens.reduce((sum, g) => sum + Number(g.units.toString()), 0).toLocaleString()
        }</span>
      </div>
      <div class="stat">
        <span>Best Braid Strings</span>
        <span class="stat-value">${formatDecimal(state.braid.bestStrings)}</span>
      </div>
      <div class="stat">
        <span>Braid Resets</span>
        <span class="stat-value">${state.braid.resets.toLocaleString()}</span>
      </div>
    </div>
  `;
}
