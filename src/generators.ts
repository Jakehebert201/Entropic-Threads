import Decimal from "break_eternity.js";
import {NUM_TIERS, GEN1_BASE_COST, TIER_BASECOST_FACTOR, PROD_STRINGS_PER_GEN1, PROD_CHAIN_PER_TIER} from "./constants.js";
type Dec = InstanceType<typeof Decimal>;
const D = (x:number | string| Dec) => 
    x instanceof Decimal ? x : new Decimal(x);

export type GeneratorConfig = {
    tier: number; //0-11
    name: string; //"Generator"
    baseCost: Dec; //BASE_GEN_COSTS[tier]
    producesTier: number | null; //0 for gen 1, else k-1 for cascade
    prodRate: Dec; //BASE_GEN_PRODUCTION_MULT.pow(tier)
}

export type GeneratorState = {
    units: Dec; // number of units total, including cascaded
    bought: number; // number of units bought
}

export const GEN_CFG: GeneratorConfig[] = Array.from({length: NUM_TIERS}, (_,  i)=>({
    tier:i,
    name: `Gen${i+1}`,
    baseCost: i === 0 ? GEN1_BASE_COST : GEN1_BASE_COST.mul(TIER_BASECOST_FACTOR.pow(i)),
    producesTier: i === 0 ? null : i - 1,
    prodRate : i === 0 ? PROD_STRINGS_PER_GEN1 : PROD_CHAIN_PER_TIER,
}));

export function newGeneratorState(): GeneratorState[] {
    return Array.from({ length: NUM_TIERS }, () => ({ units: new Decimal(0), bought: 0 }));
}
