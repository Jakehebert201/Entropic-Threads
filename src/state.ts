import Decimal from "break_eternity.js";
import { newGeneratorState } from "./generators.js";
import type { GeneratorState } from "./generators.js";
import { BRAID_PATHS, BRAID_UNLOCK_STRINGS, FIBER_LIMIT } from "./constants.js";
import { ensureActiveSlot, saveActiveSlot, resetActiveSlot } from "./saving.js";

type Dec = InstanceType<typeof Decimal>;
const D = (x:number | string| Dec) => 
    x instanceof Decimal ? x : new Decimal(x);


const BRAID_PATH_COUNT = BRAID_PATHS.length;
const FIBER_DEFAULT_BOOST = new Decimal(1);

export type SerializedBraidState = {
  resets: number;
  bestStrings: string;
  lastResetStrings: string;
  chainMultipliers: string[];
  unlocked: boolean;
  peakStrings: string;
};

export type BraidState = {
  resets: number;
  bestStrings: Dec;
  lastResetStrings: Dec;
  chainMultipliers: Decimal[];
  unlocked: boolean;
  peakStrings: Dec;
};

export type SerializedFiberState = {
  resets: number;
  boost: string;
  limitReached: boolean;
};

export type FiberState = {
  resets: number;
  boost: Dec;
  limitReached: boolean;
};

function blankChainMultipliers(): Decimal[] {
  return Array.from({ length: BRAID_PATH_COUNT }, () => new Decimal(1));
}

export function newBraidState(): BraidState {
  return {
    resets: 0,
    bestStrings: new Decimal(0),
    lastResetStrings: new Decimal(0),
    chainMultipliers: blankChainMultipliers(),
    unlocked: false,
    peakStrings: new Decimal(2),
  };
}

export function newFiberState(): FiberState {
  return {
    resets: 0,
    boost: new Decimal(FIBER_DEFAULT_BOOST),
    limitReached: false,
  };
}

function normalizeSerializedBraid(data?: Partial<SerializedBraidState>): SerializedBraidState {
  const chain: string[] = [];
  for (let i = 0; i < BRAID_PATH_COUNT; i++) {
    const value = data?.chainMultipliers?.[i];
    chain.push(typeof value === 'string' ? value : String(value ?? '1'));
  }
  return {
    resets: typeof data?.resets === 'number' ? data.resets : 0,
    bestStrings: typeof data?.bestStrings === 'string' ? data.bestStrings : String(data?.bestStrings ?? '0'),
    lastResetStrings: typeof data?.lastResetStrings === 'string' ? data.lastResetStrings : String(data?.lastResetStrings ?? '0'),
    chainMultipliers: chain,
    unlocked: data?.unlocked === true,
    peakStrings: typeof data?.peakStrings === 'string'
      ? data.peakStrings
      : String(data?.peakStrings ?? data?.lastResetStrings ?? data?.bestStrings ?? '0'),
  };
}

function normalizeSerializedFiber(data?: Partial<SerializedFiberState>): SerializedFiberState {
  return {
    resets: typeof data?.resets === 'number' ? data.resets : 0,
    boost: typeof data?.boost === 'string' ? data.boost : String(data?.boost ?? '1'),
    limitReached: data?.limitReached === true,
  };
}

function serializeBraidState(braid: BraidState): SerializedBraidState {
  return {
    resets: braid.resets,
    bestStrings: braid.bestStrings.toString(),
    lastResetStrings: braid.lastResetStrings.toString(),
    chainMultipliers: braid.chainMultipliers.map(m => m.toString()),
    unlocked: braid.unlocked,
    peakStrings: braid.peakStrings.toString(),
  };
}

function serializeFiberState(fiber: FiberState): SerializedFiberState {
  return {
    resets: fiber.resets,
    boost: fiber.boost.toString(),
    limitReached: fiber.limitReached,
  };
}

function deserializeBraidState(data?: SerializedBraidState): BraidState {
  if (!data) return newBraidState();
  const results = data.chainMultipliers?.map(value => new Decimal(value)) ?? blankChainMultipliers();
  if (results.length < BRAID_PATH_COUNT) {
    const deficit = BRAID_PATH_COUNT - results.length;
    for (let i = 0; i < deficit; i++) results.push(new Decimal(1));
  } else if (results.length > BRAID_PATH_COUNT) {
    results.length = BRAID_PATH_COUNT;
  }
  const best = new Decimal(data.bestStrings ?? '0');
  const unlocked = typeof data.unlocked === 'boolean'
    ? data.unlocked
    : best.greaterThanOrEqualTo(BRAID_UNLOCK_STRINGS);
  return {
    resets: data.resets ?? 0,
    bestStrings: best,
    lastResetStrings: new Decimal(data.lastResetStrings ?? '0'),
    chainMultipliers: results,
    unlocked,
    peakStrings: new Decimal(data.peakStrings ?? data.lastResetStrings ?? data.bestStrings ?? '0'),
  };
}

function deserializeFiberState(data?: SerializedFiberState): FiberState {
  if (!data) return newFiberState();
  return {
    resets: typeof data.resets === 'number' ? data.resets : 0,
    boost: new Decimal(data.boost ?? '1'),
    limitReached: data.limitReached === true,
  };
}

export type SerializedGameState = {
  strings: string;
  gens: { units: string; bought: number }[];
  lastTick: number;
  created: number;
  braid: SerializedBraidState;
  totalStringsProduced: string;
  bestStrings: string;
  fiber: SerializedFiberState;
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
    braid: normalizeSerializedBraid(data.braid),
    totalStringsProduced: typeof data.totalStringsProduced === 'string'
      ? data.totalStringsProduced
      : String(data.totalStringsProduced ?? '0'),
    bestStrings: typeof data.bestStrings === 'string'
      ? data.bestStrings
      : (typeof data.braid?.bestStrings === 'string' ? data.braid.bestStrings : '0'),
    fiber: normalizeSerializedFiber(data.fiber),
  };
}

export function serializeGameState(state: GameState): SerializedGameState {
  return {
    strings: state.strings.toString(),
    gens: state.gens.map(g => ({ units: g.units.toString(), bought: g.bought })),
    lastTick: state.lastTick,
    created: state.created,
    braid: serializeBraidState(state.braid),
    totalStringsProduced: state.totalStringsProduced.toString(),
    bestStrings: state.braid.bestStrings.toString(),
    fiber: serializeFiberState(state.fiber),
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
  const braid = deserializeBraidState(normalized.braid);
  braid.bestStrings = new Decimal(normalized.bestStrings);
  const fiber = deserializeFiberState(normalized.fiber);
  let strings = new Decimal(normalized.strings);
  if (strings.greaterThanOrEqualTo(FIBER_LIMIT)) {
    strings = Decimal.min(strings, FIBER_LIMIT);
    fiber.limitReached = true;
  }
  let totalStringsProduced = new Decimal(normalized.totalStringsProduced);
  if (totalStringsProduced.greaterThan(FIBER_LIMIT)) {
    totalStringsProduced = FIBER_LIMIT;
  }
  braid.peakStrings = Decimal.max(braid.peakStrings ?? new Decimal(0), strings);
  if (braid.peakStrings.greaterThan(FIBER_LIMIT)) {
    braid.peakStrings = FIBER_LIMIT;
  }
  return {
    strings,
    gens,
    lastTick: normalized.lastTick,
    created: normalized.created,
    braid,
    totalStringsProduced,
    fiber,
  };
}

export type GameState = {
  strings: Dec;
  gens: GeneratorState[];
  lastTick: number;
  created: number;
  braid: BraidState;
  totalStringsProduced: Dec;
  fiber: FiberState;
};

export function newState(): GameState {
  return {
    strings: new Decimal(2),
    gens: newGeneratorState(),
    lastTick: Date.now(),
    created: Date.now(),
    braid: newBraidState(),
    totalStringsProduced: new Decimal(0),
    fiber: newFiberState(),
  };
}
//loading will break time created, how do I fix this?
export function loadState(): GameState {
  const fallback = serializeGameState(newState());
  const { data } = ensureActiveSlot(fallback);
  return deserializeGameState(data ?? fallback);
}

export function saveState(s: GameState) {
  saveActiveSlot(serializeGameState(s));
}

export function clearState() {
  resetActiveSlot(serializeGameState(newState()));
}
