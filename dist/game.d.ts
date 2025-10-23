import type { GameState } from "./state.js";
export declare function tick(s: GameState, now?: number): void;
export declare function buyOne(s: GameState, tier: number): boolean;
export declare function buyN(s: GameState, tier: number, n: number): boolean;
export declare function buyMax(s: GameState, tier: number): boolean;
//# sourceMappingURL=game.d.ts.map