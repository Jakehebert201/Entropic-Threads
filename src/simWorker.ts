/// <reference lib="webworker" />
import { advanceSimulation, buyMax, buyMaxAll, buyN, buyOne } from "./game.js";
import { deserializeGameState, newState, serializeGameState, type SerializedGameState } from "./state.js";
import type { GameState } from "./state.js";

const STEP_SECONDS = 0.05;
const TICK_INTERVAL_MS = STEP_SECONDS * 1000;
const BROADCAST_INTERVAL_MS = 200;
const MAX_FRAME_MS = 250;
const MAX_STEPS_PER_FRAME = 40;
const MAX_OFFLINE_SECONDS = 60 * 60; // 1 hour cap

let state: GameState = newState();
let running = false;
let accumulator = 0;
let lastFrameTime = 0;
let lastBroadcast = 0;
let loopHandle: number | null = null;
let totalSimulatedSeconds = 0;
let workerStartWall = performance.now();
let warnedAboutDrift = false;

function postSnapshot(reason: string) {
  const wallSeconds = (performance.now() - workerStartWall) / 1000;
  if (wallSeconds > 0) {
    const ratio = totalSimulatedSeconds / wallSeconds;
    if (ratio > 1.5 && !warnedAboutDrift) {
      log(`Simulation is running ${ratio.toFixed(2)}× faster than wall clock; trimming backlog.`, "warn");
      warnedAboutDrift = true;
    } else if (ratio < 1.2) {
      warnedAboutDrift = false;
    }
  }
  const snapshot = serializeGameState(state);
  postMessage({
    type: "state",
    reason,
    snapshot,
    metrics: {
      simulatedSeconds: totalSimulatedSeconds,
      wallSeconds,
    },
  });
}

function log(message: string, level: "info" | "warn" = "info") {
  postMessage({ type: "log", level, message });
}

function simulateStep(stepSeconds: number) {
  advanceSimulation(state, stepSeconds);
  totalSimulatedSeconds += stepSeconds;
}

function flushAccumulator() {
  let steps = 0;
  while (accumulator >= STEP_SECONDS && steps < MAX_STEPS_PER_FRAME) {
    simulateStep(STEP_SECONDS);
    accumulator -= STEP_SECONDS;
    steps += 1;
  }
  if (steps === MAX_STEPS_PER_FRAME && accumulator >= STEP_SECONDS) {
    log("Simulation falling behind real time; dropping excess accumulator.", "warn");
    accumulator = STEP_SECONDS; // keep small remainder to avoid freeze
  }
}

function stepFrame() {
  if (!running) return;
  const now = performance.now();
  const frameMs = Math.min(now - lastFrameTime, MAX_FRAME_MS);
  lastFrameTime = now;

  accumulator += frameMs / 1000;
  flushAccumulator();

  if (now - lastBroadcast >= BROADCAST_INTERVAL_MS) {
    lastBroadcast = now;
    postSnapshot("tick");
  }
}

function startLoop() {
  if (running) return;
  running = true;
  warnedAboutDrift = false;
  lastFrameTime = performance.now();
  lastBroadcast = lastFrameTime;
  if (loopHandle !== null) self.clearInterval(loopHandle);
  loopHandle = self.setInterval(stepFrame, TICK_INTERVAL_MS);
}

function stopLoop() {
  running = false;
  if (loopHandle !== null) {
    self.clearInterval(loopHandle);
    loopHandle = null;
  }
}

function applyState(serialized: SerializedGameState) {
  state = deserializeGameState(serialized);
}

function simulateOffline(seconds: number) {
  if (seconds <= 0) return;
  const capped = Math.min(seconds, MAX_OFFLINE_SECONDS);
  if (seconds > MAX_OFFLINE_SECONDS) {
    log(`Offline progress capped to ${MAX_OFFLINE_SECONDS / 3600} hour(s).`, "warn");
  }
  let remaining = capped;
  while (remaining > 0) {
    const step = Math.min(remaining, STEP_SECONDS);
    simulateStep(step);
    remaining -= step;
  }
  state.lastTick = Date.now();
  accumulator = 0;
  totalSimulatedSeconds = 0;
  workerStartWall = performance.now();
  lastFrameTime = workerStartWall;
  warnedAboutDrift = false;
  postSnapshot("offline");
}

function handleAction(msg: any) {
  const action: string = msg.action;
  let changed = false;
  switch (action) {
    case "buyOne":
      if (typeof msg.tier === "number") changed = buyOne(state, msg.tier);
      break;
    case "buyN":
      if (typeof msg.tier === "number" && typeof msg.amount === "number") {
        changed = buyN(state, msg.tier, msg.amount | 0);
      }
      break;
    case "buyMax":
      if (typeof msg.tier === "number") changed = buyMax(state, msg.tier);
      break;
    case "buyMaxAll":
      changed = buyMaxAll(state);
      break;
    default:
      break;
  }
  if (changed) {
    postSnapshot("action");
  }
}

self.onmessage = event => {
  const msg = event.data;
  if (!msg || typeof msg !== "object") return;

  switch (msg.type) {
    case "init": {
      stopLoop();
      const serialized: SerializedGameState = msg.state;
      applyState(serialized);
      totalSimulatedSeconds = 0;
      workerStartWall = performance.now();
      lastFrameTime = workerStartWall;
      const offlineSeconds = typeof msg.offlineSeconds === "number" ? msg.offlineSeconds : 0;
      simulateOffline(offlineSeconds);
      if (msg.autoStart !== false) {
        startLoop();
      }
      break;
    }
    case "start":
      startLoop();
      break;
    case "pause":
      stopLoop();
      break;
    case "action":
      handleAction(msg);
      break;
    case "requestSnapshot": {
      postSnapshot(msg.reason ?? "manual");
      break;
    }
    case "replaceState": {
      const serialized: SerializedGameState = msg.state;
      applyState(serialized);
      accumulator = 0;
      totalSimulatedSeconds = 0;
      warnedAboutDrift = false;
      workerStartWall = performance.now();
      lastFrameTime = workerStartWall;
      postSnapshot("replace");
      break;
    }
    default:
      break;
  }
};
