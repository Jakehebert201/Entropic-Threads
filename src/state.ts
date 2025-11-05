import Decimal from "break_eternity.js";
import { newGeneratorState } from "./generators.js";
import type { GeneratorState } from "./generators.js";
import { save, load, deleteSaveData } from "./saving.js";

type Dec = InstanceType<typeof Decimal>;
const D = (x:number | string| Dec) => 
    x instanceof Decimal ? x : new Decimal(x);


export type SerializedGameState = {
  strings: string;
  gens: { units: string; bought: number }[];
  lastTick: number;
  created: number;
};

function normalizeSerialized(data: Partial<SerializedGameState>): SerializedGameState {
  const gens = Array.isArray(data.gens) ? data.gens.map(entry => ({
    units: typeof entry?.units === 'string' ? entry.units : String(entry?.units ?? '0'),
    bought: Number(entry?.bought ?? 0) || 0,
  })) : [];
  return {
    strings: typeof data.strings === 'string' ? data.strings : String(data.strings ?? '0'),
    gens,
    lastTick: typeof data.lastTick === 'number' ? data.lastTick : Date.now(),
    created: typeof data.created === 'number' ? data.created : Date.now(),
  };
}

export function serializeGameState(state: GameState): SerializedGameState {
  return {
    strings: state.strings.toString(),
    gens: state.gens.map(g => ({ units: g.units.toString(), bought: g.bought })),
    lastTick: state.lastTick,
    created: state.created,
  };
}

export function deserializeGameState(serialized: Partial<SerializedGameState>): GameState {
  const normalized = normalizeSerialized(serialized);
  const defaults = newGeneratorState();
  const gens = defaults.map((base, idx) => {
    const entry = normalized.gens[idx];
    if (!entry) return base;
    return { units: new Decimal(entry.units), bought: entry.bought };
  });
  return {
    strings: new Decimal(normalized.strings),
    gens,
    lastTick: normalized.lastTick,
    created: normalized.created,
  };
}

export type GameState = {
  strings: Dec;
  gens: GeneratorState[];
  lastTick: number;
  created: number;
};

const KEY = "state";

export function newState(): GameState {
  return {
    strings: new Decimal(2),
    gens: newGeneratorState(),
    lastTick: Date.now(),
    created: Date.now(),
  };
}
//loading will break time created, how do I fix this?
export function loadState(): GameState {
  const fallback: SerializedGameState = {
    strings: "2",
    gens: [],
    lastTick: Date.now(),
    created: Date.now(),
  };
  const raw = load<Partial<SerializedGameState>>(KEY, fallback);
  return deserializeGameState(raw ?? fallback);
}

export function saveState(s: GameState) {
  save(KEY, serializeGameState(s));
}

export function clearState() {
  deleteSaveData(KEY);
}
