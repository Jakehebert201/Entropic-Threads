import Decimal from "break_eternity.js";
type Dec = InstanceType<typeof Decimal>;
export declare const NUM_TIERS = 12;
export declare const COST_MULT_PER_LEVEL: Decimal;
export declare const TIER_BASECOST_FACTOR: Decimal;
export declare const GEN1_BASE_COST: Decimal;
export declare const PROD_STRINGS_PER_GEN1: Decimal;
export declare const PROD_CHAIN_PER_TIER: Decimal;
export declare const BRAID_BASE: Decimal;
export declare const BRAID_SIZE = 12;
export declare function tierBaseCost(tier: number): Dec;
export {};
//# sourceMappingURL=constants.d.ts.map