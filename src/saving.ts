import type { SerializedGameState } from "./state.js";

const KEY_PREFIX = "entropic-threads-";
const SAVE_KEY = `${KEY_PREFIX}saves-v1`;
const LEGACY_STATE_KEY = `${KEY_PREFIX}state`;

export const SAVE_SCHEMA_VERSION = 1;
export const DEFAULT_AUTOSAVE_INTERVAL_MS = 10_000;
export const MIN_AUTOSAVE_INTERVAL_MS = 2_000;
export const MAX_AUTOSAVE_INTERVAL_MS = 600_000;
const SLOT_NAME_LIMIT = 40;

type SerializableState = Partial<SerializedGameState>;

type SaveFile = {
  version: number;
  autosaveIntervalMs: number;
  activeSlotId: string;
  slots: SaveSlot[];
};

export type SaveSlot = {
  id: string;
  name: string;
  created: number;
  updated: number;
  data: SerializableState;
};

export type SaveSlotSummary = {
  id: string;
  name: string;
  created: number;
  updated: number;
};

export type LoadedSlot = {
  slot: SaveSlot;
  data: SerializableState;
};

export type SaveExportPayload = {
  version: number;
  slot: SaveSlotSummary;
  data: SerializableState;
};

type NormalizedImport = {
  data: SerializableState;
  name?: string;
  created?: number;
  updated?: number;
};

let cachedFile: SaveFile | null = null;

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeStringify(value: unknown): string | null {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function createEmptyFile(): SaveFile {
  return {
    version: SAVE_SCHEMA_VERSION,
    autosaveIntervalMs: DEFAULT_AUTOSAVE_INTERVAL_MS,
    activeSlotId: "",
    slots: [],
  };
}

function clampAutosave(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return DEFAULT_AUTOSAVE_INTERVAL_MS;
  return Math.min(MAX_AUTOSAVE_INTERVAL_MS, Math.max(MIN_AUTOSAVE_INTERVAL_MS, Math.round(num)));
}

function sanitizeSlotName(name: unknown, fallback: string): string {
  if (typeof name === "string") {
    const trimmed = name.trim();
    if (trimmed.length > 0) {
      return trimmed.slice(0, SLOT_NAME_LIMIT);
    }
  }
  const alt = fallback.trim().length > 0 ? fallback.trim() : "Slot";
  return alt.slice(0, SLOT_NAME_LIMIT);
}

function coerceState(value: unknown): SerializableState {
  if (typeof value === "string") {
    const parsed = safeParse<unknown>(value);
    if (parsed && typeof parsed === "object") {
      return parsed as SerializableState;
    }
    return {};
  }
  if (value && typeof value === "object") {
    return value as SerializableState;
  }
  return {};
}

function toSummary(slot: SaveSlot): SaveSlotSummary {
  return {
    id: slot.id,
    name: slot.name,
    created: slot.created,
    updated: slot.updated,
  };
}

function defaultSlotName(file: SaveFile): string {
  return `Slot ${file.slots.length + 1}`;
}

function generateSlotId(used?: Set<string>): string {
  const make = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `slot-${Math.random().toString(36).slice(2, 10)}`;
  };
  let id = make();
  if (!used) return id;
  while (used.has(id)) {
    id = make();
  }
  return id;
}

function toTimestamp(value: unknown, fallback?: number): number {
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isFinite(num)) return num;
  return typeof fallback === "number" ? fallback : Date.now();
}

function createSlotInternal(
  file: SaveFile,
  opts: { name?: string; data: SerializableState; created?: number; updated?: number; id?: string }
): SaveSlot {
  const used = new Set(file.slots.map(slot => slot.id));
  const id = opts.id && !used.has(opts.id) ? opts.id : generateSlotId(used);
  const now = Date.now();
  const slot: SaveSlot = {
    id,
    name: sanitizeSlotName(opts.name, defaultSlotName(file)),
    created: opts.created && Number.isFinite(opts.created) ? opts.created : now,
    updated: opts.updated && Number.isFinite(opts.updated) ? opts.updated : now,
    data: coerceState(opts.data),
  };
  file.slots.push(slot);
  return slot;
}

function touchActiveSlotWithFile(defaultData: SerializableState): { file: SaveFile; slot: SaveSlot; changed: boolean } {
  const file = getSaveFile();
  let changed = false;
  if (file.slots.length === 0) {
    const slot = createSlotInternal(file, { name: "Slot 1", data: defaultData });
    file.activeSlotId = slot.id;
    return { file, slot, changed: true };
  }
  let slot = file.slots.find(s => s.id === file.activeSlotId);
  if (!slot) {
    slot = file.slots[0];
    file.activeSlotId = slot.id;
    changed = true;
  }
  const isEmpty =
    slot.data == null ||
    (typeof slot.data === "object" && Object.keys(slot.data as Record<string, unknown>).length === 0);
  if (isEmpty) {
    slot.data = coerceState(defaultData);
    slot.updated = Date.now();
    changed = true;
  }
  return { file, slot, changed };
}

function persistSaveFile(file: SaveFile) {
  file.version = SAVE_SCHEMA_VERSION;
  cachedFile = file;
  const storage = getStorage();
  if (!storage) return;
  const payload = safeStringify(file);
  if (payload === null) return;
  try {
    storage.setItem(SAVE_KEY, payload);
  } catch {
    // ignore storage write failures
  }
}

function sanitizeIncomingSlot(entry: Record<string, unknown>, used: Set<string>, ordinal: number): SaveSlot | null {
  const fallbackName = `Slot ${ordinal}`;
  if (!entry || typeof entry !== "object") return null;
  const desiredId = typeof entry.id === "string" ? entry.id : "";
  const id = desiredId && !used.has(desiredId) ? desiredId : generateSlotId(used);
  const created = toTimestamp(entry.created, Date.now());
  const updated = toTimestamp(entry.updated, created);
  const dataCandidate =
    (entry as { data?: unknown }).data ??
    (entry as { state?: unknown }).state ??
    (entry as { payload?: unknown }).payload ??
    {};
  return {
    id,
    name: sanitizeSlotName(entry.name, fallbackName),
    created,
    updated: Math.max(updated, created),
    data: coerceState(dataCandidate),
  };
}

function migrateSaveFile(raw: unknown): { file: SaveFile; changed: boolean } {
  if (!raw || typeof raw !== "object") {
    return { file: createEmptyFile(), changed: true };
  }
  const input = raw as Record<string, unknown>;
  const version = typeof input.version === "number" ? input.version : 0;
  let changed = version !== SAVE_SCHEMA_VERSION;
  const file = createEmptyFile();
  file.autosaveIntervalMs = clampAutosave(input.autosaveIntervalMs ?? DEFAULT_AUTOSAVE_INTERVAL_MS);
  if (file.autosaveIntervalMs !== input.autosaveIntervalMs) changed = true;
  const used = new Set<string>();
  const slotArray = Array.isArray((input as { slots?: unknown }).slots)
    ? ((input as { slots?: unknown }).slots as Array<Record<string, unknown>>)
    : [];
  slotArray.forEach((entry, index) => {
    const slot = sanitizeIncomingSlot(entry, used, index + 1);
    if (slot) {
      used.add(slot.id);
      file.slots.push(slot);
    } else {
      changed = true;
    }
  });
  const candidateActive = typeof input.activeSlotId === "string" ? input.activeSlotId : "";
  if (candidateActive && file.slots.some(slot => slot.id === candidateActive)) {
    file.activeSlotId = candidateActive;
  } else if (file.slots.length > 0) {
    file.activeSlotId = file.slots[0].id;
    if (candidateActive !== file.activeSlotId) changed = true;
  } else {
    file.activeSlotId = "";
  }
  file.version = SAVE_SCHEMA_VERSION;
  return { file, changed };
}

function loadSaveFileFromStorage(): SaveFile | null {
  const storage = getStorage();
  if (!storage) return null;
  const raw = storage.getItem(SAVE_KEY);
  if (raw) {
    const parsed = safeParse<unknown>(raw);
    const { file, changed } = migrateSaveFile(parsed);
    if (changed) {
      persistSaveFile(file);
    } else {
      cachedFile = file;
    }
    return file;
  }
  const legacyRaw = storage.getItem(LEGACY_STATE_KEY);
  if (!legacyRaw) return null;
  const legacyState = safeParse<unknown>(legacyRaw) ?? {};
  const file = createEmptyFile();
  const slot = createSlotInternal(file, {
    name: "Slot 1",
    data: coerceState(legacyState),
  });
  file.activeSlotId = slot.id;
  persistSaveFile(file);
  try {
    storage.removeItem(LEGACY_STATE_KEY);
  } catch {
    // ignore inability to remove legacy key
  }
  return file;
}

function getSaveFile(): SaveFile {
  if (cachedFile) return cachedFile;
  const fromStorage = loadSaveFileFromStorage();
  if (fromStorage) {
    cachedFile = fromStorage;
    return fromStorage;
  }
  const file = createEmptyFile();
  cachedFile = file;
  persistSaveFile(file);
  return file;
}

function normalizeImportPayload(payload: unknown): NormalizedImport | null {
  let source: unknown = payload;
  if (typeof source === "string") {
    source = safeParse<unknown>(source);
  }
  if (!source || typeof source !== "object") {
    return null;
  }
  const obj = source as Record<string, unknown>;
  const slotInfo =
    (typeof obj.slot === "object" && obj.slot) ? (obj.slot as Record<string, unknown>) :
    (typeof obj.meta === "object" && obj.meta) ? (obj.meta as Record<string, unknown>) :
    null;
  const dataCandidate =
    (obj as { data?: unknown }).data ??
    (obj as { state?: unknown }).state ??
    (obj as { payload?: unknown }).payload ??
    obj;
  return {
    data: coerceState(dataCandidate),
    name: slotInfo && typeof slotInfo.name === "string" ? slotInfo.name : undefined,
    created: slotInfo && typeof slotInfo.created === "number" ? slotInfo.created : undefined,
    updated: slotInfo && typeof slotInfo.updated === "number" ? slotInfo.updated : undefined,
  };
}

export function ensureActiveSlot(initialData: SerializableState): LoadedSlot {
  const result = touchActiveSlotWithFile(initialData);
  if (result.changed) {
    persistSaveFile(result.file);
  }
  return { slot: result.slot, data: result.slot.data };
}

export function getActiveSlot(): SaveSlotSummary | null {
  const file = getSaveFile();
  const slot = file.slots.find(s => s.id === file.activeSlotId);
  return slot ? toSummary(slot) : null;
}

export function listSlots(): SaveSlotSummary[] {
  const file = getSaveFile();
  return file.slots
    .slice()
    .sort((a, b) => a.created - b.created)
    .map(toSummary);
}

export function saveActiveSlot(data: SerializableState): SaveSlotSummary {
  const { file, slot } = touchActiveSlotWithFile(data);
  slot.data = coerceState(data);
  slot.updated = Date.now();
  persistSaveFile(file);
  return toSummary(slot);
}

export function resetActiveSlot(data: SerializableState, name?: string): LoadedSlot {
  const { file, slot } = touchActiveSlotWithFile(data);
  slot.data = coerceState(data);
  slot.updated = Date.now();
  if (name) {
    slot.name = sanitizeSlotName(name, name);
  }
  persistSaveFile(file);
  return { slot, data: slot.data };
}

export function switchActiveSlot(id: string, fallbackData: SerializableState): LoadedSlot | null {
  const file = getSaveFile();
  const slot = file.slots.find(s => s.id === id);
  if (!slot) return null;
  file.activeSlotId = id;
  const isEmpty =
    slot.data == null ||
    (typeof slot.data === "object" && Object.keys(slot.data as Record<string, unknown>).length === 0);
  if (isEmpty) {
    slot.data = coerceState(fallbackData);
    slot.updated = Date.now();
  }
  persistSaveFile(file);
  return { slot, data: slot.data };
}

export function createSlot(name: string | undefined, data: SerializableState): LoadedSlot {
  const file = getSaveFile();
  const slot = createSlotInternal(file, { name, data });
  file.activeSlotId = slot.id;
  persistSaveFile(file);
  return { slot, data: slot.data };
}

export function deleteSlot(id: string, fallbackData: SerializableState): LoadedSlot {
  const file = getSaveFile();
  const index = file.slots.findIndex(slot => slot.id === id);
  if (index >= 0) {
    file.slots.splice(index, 1);
  }
  if (file.slots.length === 0) {
    const slot = createSlotInternal(file, { name: "Slot 1", data: fallbackData });
    file.activeSlotId = slot.id;
    persistSaveFile(file);
    return { slot, data: slot.data };
  }
  if (file.activeSlotId === id) {
    file.activeSlotId = file.slots[0].id;
  }
  const current = file.slots.find(slot => slot.id === file.activeSlotId) ?? file.slots[0];
  file.activeSlotId = current.id;
  const isEmpty =
    current.data == null ||
    (typeof current.data === "object" && Object.keys(current.data as Record<string, unknown>).length === 0);
  if (isEmpty) {
    current.data = coerceState(fallbackData);
    current.updated = Date.now();
  }
  persistSaveFile(file);
  return { slot: current, data: current.data };
}

export function renameSlot(id: string, name: string): SaveSlotSummary | null {
  const file = getSaveFile();
  const slot = file.slots.find(s => s.id === id);
  if (!slot) return null;
  const nextName = sanitizeSlotName(name, slot.name);
  if (nextName === slot.name) return toSummary(slot);
  slot.name = nextName;
  slot.updated = Date.now();
  persistSaveFile(file);
  return toSummary(slot);
}

export function exportSlot(id?: string): SaveExportPayload | null {
  const file = getSaveFile();
  const slot = id
    ? file.slots.find(s => s.id === id)
    : file.slots.find(s => s.id === file.activeSlotId) ?? file.slots[0];
  if (!slot) return null;
  return {
    version: SAVE_SCHEMA_VERSION,
    slot: toSummary(slot),
    data: coerceState(slot.data),
  };
}

export function importIntoActiveSlot(
  payload: unknown,
  fallbackData: SerializableState,
  options?: { asNewSlot?: boolean; name?: string }
): LoadedSlot | null {
  const normalized = normalizeImportPayload(payload);
  if (!normalized) return null;
  const data = Object.keys(normalized.data).length > 0 ? normalized.data : coerceState(fallbackData);
  const preferredName = normalized.name ?? options?.name ?? "Imported Slot";
  if (options?.asNewSlot) {
    const file = getSaveFile();
    const slot = createSlotInternal(file, {
      name: preferredName,
      data,
      created: normalized.created,
      updated: normalized.updated,
    });
    file.activeSlotId = slot.id;
    persistSaveFile(file);
    return { slot, data: slot.data };
  }
  const { file, slot } = touchActiveSlotWithFile(data);
  slot.name = sanitizeSlotName(preferredName, slot.name);
  slot.data = data;
  if (normalized.created) {
    slot.created = toTimestamp(normalized.created, slot.created);
  }
  slot.updated = normalized.updated ? toTimestamp(normalized.updated, Date.now()) : Date.now();
  persistSaveFile(file);
  return { slot, data: slot.data };
}

export function getAutosaveInterval(): number {
  return getSaveFile().autosaveIntervalMs;
}

export function setAutosaveInterval(ms: number): number {
  const file = getSaveFile();
  const clamped = clampAutosave(ms);
  if (file.autosaveIntervalMs !== clamped) {
    file.autosaveIntervalMs = clamped;
    persistSaveFile(file);
  }
  return file.autosaveIntervalMs;
}

// Legacy wrappers retained for compatibility with existing imports.
export function save<T>(key: string, value: T) {
  if (key === "state") {
    saveActiveSlot(value as SerializableState);
    return;
  }
  const storage = getStorage();
  if (!storage) return;
  const payload = safeStringify(value);
  if (payload === null) return;
  try {
    storage.setItem(KEY_PREFIX + key, payload);
  } catch {
    // ignore
  }
}

export function load<T>(key: string, fallback: T): T {
  if (key === "state") {
    const result = ensureActiveSlot(fallback as SerializableState);
    return (result.data as T) ?? fallback;
  }
  const storage = getStorage();
  if (!storage) return fallback;
  const parsed = safeParse<T>(storage.getItem(KEY_PREFIX + key));
  return parsed ?? fallback;
}

export function deleteSaveData(key: string) {
  if (key === "state") {
    resetActiveSlot({} as SerializableState);
    return;
  }
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(KEY_PREFIX + key);
  } catch {
    // ignore
  }
}
