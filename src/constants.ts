import Decimal from "break_eternity.js";

// 12 tiers: Gen1..Gen12
export const NUM_TIERS = 12;

// Base costs are spaced by powers of 10. Generator 2 is lowered to 10^2 = 100,
// while the remaining early tiers retain their previous prices.
const BASE_COST_EXPONENTS = [1, 2, 5, 7, 9, 12, 15, 18, 21, 24, 27, 30] as const;
const BASE_COSTS = BASE_COST_EXPONENTS.map(exp => Decimal.pow10(exp));

// Per-purchase scaling grows by 10× for each generator tier.
const COST_RATIOS = Array.from({ length: NUM_TIERS }, (_, tier) => Decimal.pow10(tier + 1));

// Production: slower cascade, slower base strings
export const PROD_STRINGS_PER_GEN1 = new Decimal(0.25); // was 1
export const PROD_CHAIN_PER_TIER   = new Decimal(0.05); // was 0.2

// Braiding: gentler & with diminishing returns
export const BRAID_SIZE = 25;                 // every 25 buys per tier = 1 strand
export const BRAID_BASE = new Decimal(2.0);   // 2× per strand (was 10×)

// Optional “super-scaling” to stop late-game blowups:
// after this many buys on a tier, add an extra factor per buy.
export const SUPER_START = 50;                // begin extra scaling after 50 buys
export const SUPER_STEP  = new Decimal(1.03); // each buy past 50 multiplies cost by 1.03

// Production boost per purchase
export const PER_PURCHASE_MULT = new Decimal(2);

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
