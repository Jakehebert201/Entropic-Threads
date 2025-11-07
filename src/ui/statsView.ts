import Decimal from "break_eternity.js";
import { timePlayed, aggregateStats } from "../stats.js";
import type { GameState } from "../state.js";

export function renderStatsView(state: GameState, root: HTMLElement, formatNumber: (value: Decimal) => string) {
  const toStr = (v: any) =>
    v == null ? '—'
    : typeof v === 'string' ? v
    : typeof v === 'number' ? v.toLocaleString()
    : typeof v.toString === 'function' ? v.toString()
    : String(v);

  const { days, hours, minutes, seconds } = timePlayed(state);
  const { totalBought, highestTier } = aggregateStats(state);

  const timeParts: string[] = [];
  if (days) timeParts.push(`${days}d`);
  if (hours || timeParts.length) timeParts.push(`${hours}h`);
  if (minutes || timeParts.length) timeParts.push(`${minutes}m`);
  timeParts.push(`${seconds}s`);
  const timeString = timeParts.join(' ');

  const rows: Array<[string, string]> = [
    ['Time Played', timeString],
    ['Total Strings Produced', formatNumber(state.totalStringsProduced)],
    ['Strings Owned', formatNumber(state.strings)],
    ['Total Purchases', typeof totalBought === 'number' ? totalBought.toLocaleString() : toStr(totalBought)],
    ['Highest Active Tier', highestTier >= 0 ? `Gen${highestTier + 1}` : 'None'],
  ];

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
}
