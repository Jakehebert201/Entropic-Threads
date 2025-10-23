import Decimal from "break_eternity.js";
import {COST_MULT_PER_LEVEL, BRAID_SIZE, BRAID_BASE} from "./constants.js";
import type {GeneratorConfig} from "./generators.js";
import type {GameState} from "./state.js";
type Dec = InstanceType<typeof Decimal>;
const D = (x:number | string| Dec) => 
    x instanceof Decimal ? x : new Decimal(x);

export function nextCost(cfg: GeneratorConfig, bought: number): Dec{
    return cfg.baseCost.mul(COST_MULT_PER_LEVEL.pow(bought));
}

export function totalCostFor(cfg: GeneratorConfig, bought: number, n: number): Dec{
    if (n <= 0) return D(0);
    const first = nextCost(cfg, bought);

    if(COST_MULT_PER_LEVEL.equals(1)) return first.mul(n);
    const r = COST_MULT_PER_LEVEL;
    return first.mul(r.pow(n).sub(1)).div(r.sub(1));
}

export function braidStrands(s: GameState): number{
    return s.gens.reduce((acc, g) => acc + Math.floor(g.bought/BRAID_SIZE), 0);
}

export function braidMultiplier(s: GameState): Dec{
    return BRAID_BASE.pow(braidStrands(s));
}

