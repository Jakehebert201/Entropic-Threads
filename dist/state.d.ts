import Decimal from "break_eternity.js";
import type { GeneratorState } from "./generators.js";
type Dec = InstanceType<typeof Decimal>;
export type GameState = {
    strings: Dec;
    gens: GeneratorState[];
    lastTick: number;
};
export declare function newState(): GameState;
export declare function loadState(): GameState;
export declare function saveState(s: GameState): void;
export {};
//# sourceMappingURL=state.d.ts.map