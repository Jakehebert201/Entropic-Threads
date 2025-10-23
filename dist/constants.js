import Decimal from "break_eternity.js";
const D = (x) => x instanceof Decimal ? x : new Decimal(x);
export const NUM_TIERS = 12;
export const COST_MULT_PER_LEVEL = new Decimal(1.15);
export const TIER_BASECOST_FACTOR = new Decimal(25);
export const GEN1_BASE_COST = new Decimal(10);
export const PROD_STRINGS_PER_GEN1 = new Decimal(1);
export const PROD_CHAIN_PER_TIER = new Decimal(0.2);
export const BRAID_BASE = new Decimal(10);
export const BRAID_SIZE = 12;
export function tierBaseCost(tier) {
    return tier === 0
        ? GEN1_BASE_COST
        : GEN1_BASE_COST.mul(TIER_BASECOST_FACTOR.pow(tier));
}
//# sourceMappingURL=constants.js.map