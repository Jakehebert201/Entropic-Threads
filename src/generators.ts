import Decimal from "break_eternity.js";
import { NUM_TIERS, PROD_STRINGS_PER_GEN1, PROD_CHAIN_PER_TIER, tierBaseCost } from "./constants.js";

export type GeneratorConfig = {
  tier: number;
  name: string;
  baseCost: Decimal;
  producesTier: number | null;
  prodRate: Decimal;
};

export type GeneratorState = {
  units: Decimal;
  bought: number;
};

export const GEN_CFG: GeneratorConfig[] = Array.from({ length: NUM_TIERS }, (_, i) => ({
  tier: i,
  name: `Gen${i + 1}`,
  baseCost: tierBaseCost(i),
  producesTier: i === 0 ? null : i - 1,
  prodRate: i === 0 ? PROD_STRINGS_PER_GEN1 : PROD_CHAIN_PER_TIER,
}));

export function newGeneratorState(): GeneratorState[] {
  return Array.from({ length: NUM_TIERS }, () => ({ units: new Decimal(0), bought: 0 }));
}
