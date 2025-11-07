import Decimal from "break_eternity.js";
import type { GeneratorConfig } from "./generators.js";
import {
  SUPER_START, SUPER_STEP,
  costMultForTier
} from "./constants.js";

type Dec = InstanceType<typeof Decimal>;
const D = (x:number | string| Dec) => 
    x instanceof Decimal ? x : new Decimal(x);

export function nextCost(cfg: GeneratorConfig, bought: number): Decimal {
  const ratio = costMultForTier(cfg.tier);
  const base = cfg.baseCost.mul(ratio.pow(bought));
  const extra = Math.max(0, bought - SUPER_START);
  return extra > 0 ? base.mul(SUPER_STEP.pow(extra)) : base;
}

export function totalCostFor(cfg: GeneratorConfig, bought: number, n: number): Decimal {
  if (n <= 0) return new Decimal(0);
  let total = new Decimal(0);
  for (let i = 0; i < n; i++) total = total.add(nextCost(cfg, bought + i));
  return total;
}

