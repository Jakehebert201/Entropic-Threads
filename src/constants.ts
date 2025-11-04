import Decimal from "break_eternity.js";

// 12 tiers: Gen1..Gen12
export const NUM_TIERS = 12;

// Base costs follow powers of two (Gen1 = 2, Gen2 = 16, etc.).
const BASE_COSTS = Array.from(
  { length: NUM_TIERS },
  (_, tier) => Decimal.pow(2, (tier + 1) * (tier + 1))
);

// Per-purchase scaling grows by tier-specific powers of two.
const COST_RATIOS = Array.from(
  { length: NUM_TIERS },
  (_, tier) => Decimal.pow(2, tier + 1)
);

// Production: Gen1 starts at 2 strings/sec to match the new baseline.
export const PROD_STRINGS_PER_GEN1 = new Decimal(2);
export const PROD_CHAIN_PER_TIER   = new Decimal(0.05); // was 0.2

// Braiding: gentler & with diminishing returns
export const BRAID_SIZE = 25;                 // every 25 buys per tier = 1 strand
export const BRAID_BASE = new Decimal(2.0);   // 2× per strand (was 10×)

// Optional “super-scaling” to stop late-game blowups:
// after this many buys on a tier, add an extra factor per buy.
export const SUPER_START = 50;                // begin extra scaling after 50 buys
export const SUPER_STEP  = new Decimal(1.03); // each buy past 50 multiplies cost by 1.03

// Production boost per purchase
export const PER_PURCHASE_MULT = new Decimal(1.1);

export function tierBaseCost(tier: number): Decimal {
  const cost = BASE_COSTS[tier];
  if (!cost) throw new RangeError(`tierBaseCost out of bounds for tier ${tier}`);
  return cost;
}

export function costMultForTier(tier: number): Decimal {
  const ratio = COST_RATIOS[tier];
  if (!ratio) throw new RangeError(`costMultForTier out of bounds for tier ${tier}`);
  return ratio;
}
