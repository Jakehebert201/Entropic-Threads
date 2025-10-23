import Decimal from "break_eternity.js";
import { NUM_TIERS, GEN1_BASE_COST, TIER_BASECOST_FACTOR, PROD_STRINGS_PER_GEN1, PROD_CHAIN_PER_TIER } from "./constants.js";
const D = (x) => x instanceof Decimal ? x : new Decimal(x);
export const GEN_CFG = Array.from({ length: NUM_TIERS }, (_, i) => ({
    tier: i,
    name: `Gen${i + 1}`,
    baseCost: i === 0 ? GEN1_BASE_COST : GEN1_BASE_COST.mul(TIER_BASECOST_FACTOR.pow(i)),
    producesTier: i === 0 ? null : i - 1,
    prodRate: i === 0 ? PROD_STRINGS_PER_GEN1 : PROD_CHAIN_PER_TIER,
}));
export function newGeneratorState() {
    return Array.from({ length: NUM_TIERS }, () => ({ units: new Decimal(0), bought: 0 }));
}
//# sourceMappingURL=generators.js.map