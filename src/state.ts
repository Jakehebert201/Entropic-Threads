import Decimal from "break_eternity.js";
import { newGeneratorState } from "./generators.js";
import type { GeneratorState } from "./generators.js";
import { save, load, deleteSaveData } from "./saving.js";

type Dec = InstanceType<typeof Decimal>;
const D = (x:number | string| Dec) => 
    x instanceof Decimal ? x : new Decimal(x);


export type GameState = {
  strings: Dec;
  gens: GeneratorState[];
  lastTick: number;
  created: number;
};

const KEY = "state";

export function newState(): GameState {
  return {
    strings: new Decimal(10),
    gens: newGeneratorState(),
    lastTick: Date.now(),
    created: Date.now(),
  };
}
//loading will break time created, how do I fix this?
export function loadState(): GameState {
  const raw = load<{
    strings: string;
    gens: { units: string; bought: number }[];
    lastTick: number;
    created: number;
  }>(KEY, { strings: "10", gens: [], lastTick: Date.now(), created: Date.now() });

  const gens = raw.gens?.length
    ? raw.gens.map(g => ({ units: new Decimal(g.units), bought: g.bought|0 }))
    : newGeneratorState();

  return {
    strings: new Decimal(raw.strings ?? "10"),
    gens,
    lastTick: raw.lastTick ?? Date.now(),
    created: raw.created ?? Date.now(),
  };
}

export function saveState(s: GameState) {
  save(KEY, {
    strings: s.strings.toString(),
    gens: s.gens.map(g => ({ units: g.units.toString(), bought: g.bought })),
    lastTick: s.lastTick,
    created: s.created,
  });
}

export function clearState() {
  deleteSaveData(KEY);
}
