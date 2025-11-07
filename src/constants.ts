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

// Braiding chains: four alternating paths across the 12 generators
export const BRAID_PATHS = [
  [0, 4, 8],
  [1, 5, 9],
  [2, 6, 10],
  [3, 7, 11],
] as const;
export const BRAID_CHAIN_BASE = new Decimal(1.02); // base multiplier applied per chain
export const BRAID_GAIN_EXPONENT = 0.85;           // exponent for log10(strings) scaling
export const BRAID_GAIN_DIVISOR = 5;               // higher divisor = slower growth
export const BRAID_UNLOCK_STRINGS = Decimal.pow(10, 12); // reach 1e12 strings to unlock braiding

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
