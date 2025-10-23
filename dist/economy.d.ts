import Decimal from "break_eternity.js";
import type { GeneratorConfig } from "./generators.js";
import type { GameState } from "./state.js";
type Dec = InstanceType<typeof Decimal>;
export declare function nextCost(cfg: GeneratorConfig, bought: number): Dec;
export declare function totalCostFor(cfg: GeneratorConfig, bought: number, n: number): Dec;
export declare function braidStrands(s: GameState): number;
export declare function braidMultiplier(s: GameState): Dec;
export {};
//# sourceMappingURL=economy.d.ts.map