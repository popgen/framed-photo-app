import { zoneAt, zoneName, type ZoneId } from "./contest";
import { createJumper, DT, pressJump, releaseJump, stepJump, type Jumper } from "./jump";
import { mulberry32, type Rng } from "./rng";
import { photoValue, totalScore } from "./score";

export const PX_PER_METER = 40;
export const SANTA_X = 78;
export const SANTA_W = 32;
export const SANTA_H = 46;
export const SPAWN_AHEAD = 720;
export const NEAR_PX = 22;
export const MAX_FRAMES = 12 * 60 * 60;
export const INVULN_FRAMES = 48;

export type PhotoKind = "familia" | "perro" | "atardecer" | "abuelos" | "bebe" | "dorado";

export type RunInput = { f: number; d: 0 | 1 };

export type Actor = {
  id: number;
  kind: string;
  x: number;
  y: number;
  w: number;
  h: number;
  photo: PhotoKind | null;
  arc: number | null;
  arcSize: number;
  caught: boolean;
  gone: boolean;
  scoredNear: boolean;
  minClear: number;
  zone: ZoneId;
};

export type RunState = {
  seed: number;
  frame: number;
  camera: number;
  jumper: Jumper;
  actors: Actor[];
  nextId: number;
  rng: Rng;
  nextSpawn: number;
  goldenMeter: number;
  goldenSpawned: boolean;
  goldenPlaced: number;
  saves: number;
  invuln: number;
  photosCaught: number;
  photoPoints: number;
  arcsDone: number;
  arcGot: number[];
  nearMisses: number;
  ended: "play" | "crash" | "time";
  lockCourse: boolean;
  inputs: RunInput[];
  inputIndex: number;
  peakActors: number;
  goldenCaught: boolean;
  saveUsed: boolean;
  submittable: boolean;
};

export type RunLog = { v: 1; seed: number; inputs: number[] };

export type RunResult = {
  score: number;
  distance: number;
  photos: number;
  zone: ZoneId;
  zoneName: string;
  arcs: number;
  nearMisses: number;
  ended: RunState["ended"];
  goldenCaught: boolean;
  goldenPlaced: number;
  saveUsed: boolean;
  savesLeft: number;
  peakActors: number;
  frames: number;
  submittable: boolean;
  runLog: RunLog;
};

const PHOTO_KINDS: PhotoKind[] = ["familia", "perro", "atardecer", "abuelos", "bebe"];

type KindDef = { id: string; w: number; h: number; y: number };

function kindsFor(zone: ZoneId): KindDef[] {
  if (zone === 1) {
    return [
      { id: "sleigh", w: 72, h: 34, y: 0 },
      { id: "stump", w: 36, h: 32, y: 0 },
      { id: "pine", w: 44, h: 86, y: 0 },
    ];
  }
  if (zone === 2) {
    return [
      { id: "snowman", w: 42, h: 92, y: 0 },
      { id: "reindeer", w: 68, h: 48, y: 0 },
      { id: "stump", w: 34, h: 36, y: 0 },
    ];
  }
  if (zone === 3) {
    return [
      { id: "house", w: 58, h: 78, y: 0 },
      { id: "hand-snow", w: 34, h: 52, y: 0 },
      { id: "toy", w: 36, h: 30, y: 0 },
    ];
  }
  return [
    { id: "knife", w: 26, h: 64, y: 0 },
    { id: "hand-sky", w: 36, h: 280, y: 118 },
    { id: "toy", w: 34, h: 34, y: 0 },
  ];
}

export function speedPxPerSec(elapsedSec: number): number {
  const steps = Math.floor(Math.max(0, elapsedSec) / 10);
  return 220 + steps * 18;
}

export function gapPx(elapsedSec: number): number {
  const steps = Math.floor(Math.max(0, elapsedSec) / 10);
  return Math.max(250, 580 - steps * 24);
}

export function createRun(seed: number, opts?: { startMeters?: number }): RunState {
  const safeSeed = seed >>> 0 || 1;
  const rng = mulberry32(safeSeed);
  const goldenMeter = 90 + rng.next() * 3400;
  const start = Math.max(0, opts?.startMeters ?? 0);
  const state: RunState = {
    seed: safeSeed,
    frame: 0,
    camera: start * PX_PER_METER,
    jumper: createJumper(),
    actors: [],
    nextId: 1,
    rng,
    nextSpawn: start * PX_PER_METER + 720,
    goldenMeter,
    goldenSpawned: start > goldenMeter,
    goldenPlaced: 0,
    saves: 0,
    invuln: 0,
    photosCaught: 0,
    photoPoints: 0,
    arcsDone: 0,
    arcGot: [],
    nearMisses: 0,
    ended: "play",
    lockCourse: false,
    inputs: [],
    inputIndex: 0,
    peakActors: 0,
    goldenCaught: false,
    saveUsed: false,
    submittable: start === 0,
  };
  return state;
}

function pushActor(state: RunState, actor: Omit<Actor, "id" | "caught" | "gone" | "scoredNear" | "minClear">): Actor {
  const full: Actor = { ...actor, id: state.nextId, caught: false, gone: false, scoredNear: false, minClear: Number.POSITIVE_INFINITY };
  state.nextId += 1;
  state.actors.push(full);
  return full;
}

function spawnPhoto(state: RunState, x: number, zone: ZoneId, kind: PhotoKind, bottom: number, arc: number | null, arcSize: number): void {
  pushActor(state, { kind, x, y: bottom, w: 30, h: 30, photo: kind, arc, arcSize, zone });
}

function photoBottom(rng: Rng): number {
  const band = rng.next();
  if (band < 0.4) return 8;
  if (band < 0.7) return 62 + rng.next() * 18;
  return 118 + rng.next() * 28;
}

function spawnArc(state: RunState, x: number, zone: ZoneId): void {
  const arc = state.nextId;
  const bottoms = [16, 70, 128, 70, 16];
  bottoms.forEach((bottom, index) => {
    const kind = PHOTO_KINDS[Math.floor(state.rng.next() * PHOTO_KINDS.length)] ?? "familia";
    spawnPhoto(state, x + index * 62, zone, kind, bottom, arc, bottoms.length);
  });
}

function maybeSpawnGolden(state: RunState): void {
  if (state.goldenSpawned) return;
  const x = state.goldenMeter * PX_PER_METER;
  if (x > state.camera + SPAWN_AHEAD) return;
  state.goldenSpawned = true;
  state.goldenPlaced += 1;
  const zone = zoneAt(state.goldenMeter);
  const bottom = 12 + state.rng.next() * 130;
  spawnPhoto(state, x, zone, "dorado", bottom, null, 0);
}

function spawnOne(state: RunState): void {
  const x = state.nextSpawn;
  const meters = x / PX_PER_METER;
  const zone = zoneAt(meters);
  const catalog = kindsFor(zone);
  const kind = catalog[Math.floor(state.rng.next() * catalog.length)] ?? catalog[0];
  const heightJitter = Math.floor(state.rng.next() * 8);
  pushActor(state, {
    kind: kind.id,
    x,
    y: kind.y,
    w: kind.w,
    h: kind.y > 0 ? kind.h : kind.h + heightJitter,
    photo: null,
    arc: null,
    arcSize: 0,
    zone,
  });
  const elapsed = state.frame * DT;
  const gap = gapPx(elapsed);
  const roll = state.rng.next();
  if (roll < 0.14 && gap > 380) spawnArc(state, x + kind.w + 36, zone);
  else if (roll < 0.7) {
    const photoKind = PHOTO_KINDS[Math.floor(state.rng.next() * PHOTO_KINDS.length)] ?? "familia";
    spawnPhoto(state, x + kind.w + gap * 0.46, zone, photoKind, photoBottom(state.rng), null, 0);
  }
  state.nextSpawn = x + kind.w + gap;
}

function santaBox(state: RunState): { x: number; y: number; w: number; h: number } {
  return { x: state.camera + SANTA_X, y: state.jumper.y, w: SANTA_W, h: SANTA_H };
}

function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function catchPhoto(state: RunState, actor: Actor): void {
  actor.caught = true;
  actor.gone = true;
  state.photosCaught += 1;
  state.photoPoints += photoValue(actor.zone);
  if (actor.photo === "dorado" && !state.goldenCaught) {
    state.goldenCaught = true;
    if (state.saves < 1) state.saves = 1;
  }
  if (actor.arc != null) {
    state.arcGot[actor.arc] = (state.arcGot[actor.arc] ?? 0) + 1;
    if (state.arcGot[actor.arc] === actor.arcSize) state.arcsDone += 1;
  }
}

function hitObstacle(state: RunState, actor: Actor): void {
  if (state.invuln > 0) return;
  if (state.saves > 0) {
    state.saves -= 1;
    state.saveUsed = true;
    state.invuln = INVULN_FRAMES;
    actor.gone = true;
    return;
  }
  state.ended = "crash";
}

function trackClearance(actor: Actor, santa: { x: number; y: number; w: number; h: number }): void {
  const overlapsX = santa.x < actor.x + actor.w && santa.x + santa.w > actor.x;
  if (!overlapsX) return;
  const gap = actor.y > 80 ? actor.y - (santa.y + santa.h) : santa.y - (actor.y + actor.h);
  if (gap < actor.minClear) actor.minClear = gap;
}

function resolvePassed(state: RunState, santa: { x: number; y: number; w: number; h: number }): void {
  for (const actor of state.actors) {
    if (actor.photo || actor.gone || actor.scoredNear) continue;
    if (actor.x + actor.w < santa.x) {
      actor.scoredNear = true;
      if (actor.minClear >= 0 && actor.minClear < NEAR_PX) state.nearMisses += 1;
    }
  }
}

function cull(state: RunState): void {
  const limit = state.camera - 240;
  if (state.actors.length > 48 || state.actors.some((actor) => actor.x + actor.w < limit)) {
    state.actors = state.actors.filter((actor) => actor.x + actor.w >= limit);
  }
}

export function stepRun(state: RunState): void {
  if (state.ended !== "play") return;
  const frame = state.frame;
  while (state.inputIndex < state.inputs.length && state.inputs[state.inputIndex].f <= frame) {
    const event = state.inputs[state.inputIndex];
    state.inputIndex += 1;
    if (!event) break;
    if (event.d === 1) pressJump(state.jumper);
    else releaseJump(state.jumper);
  }
  stepJump(state.jumper, DT);
  state.camera += speedPxPerSec(frame * DT) * DT;
  if (state.invuln > 0) state.invuln -= 1;
  if (!state.lockCourse) {
    maybeSpawnGolden(state);
    let guard = 0;
    while (state.nextSpawn < state.camera + SPAWN_AHEAD && guard < 8) {
      spawnOne(state);
      guard += 1;
    }
  }
  const santa = santaBox(state);
  for (const actor of state.actors) {
    if (actor.gone) continue;
    if (actor.photo) {
      if (!actor.caught && overlaps(santa, actor)) catchPhoto(state, actor);
    } else if (overlaps(santa, actor)) {
      hitObstacle(state, actor);
      if (state.ended !== "play") break;
    } else {
      trackClearance(actor, santa);
    }
  }
  if (state.ended === "play") resolvePassed(state, santa);
  cull(state);
  if (state.actors.length > state.peakActors) state.peakActors = state.actors.length;
  state.frame += 1;
  if (state.frame >= MAX_FRAMES && state.ended === "play") state.ended = "time";
}

export function flattenInputs(inputs: RunInput[]): number[] {
  const flat: number[] = [];
  for (const input of inputs) flat.push(input.f, input.d);
  return flat;
}

export function decodeInputs(flat: number[]): RunInput[] | null {
  if (flat.length % 2 !== 0) return null;
  const inputs: RunInput[] = [];
  for (let i = 0; i < flat.length; i += 2) {
    const f = flat[i];
    const d = flat[i + 1];
    if (!Number.isInteger(f) || f < 0 || f > MAX_FRAMES) return null;
    if (d !== 0 && d !== 1) return null;
    const prev = inputs[inputs.length - 1];
    if (prev && f < prev.f) return null;
    inputs.push({ f, d: d as 0 | 1 });
  }
  return inputs;
}

export function snapshot(state: RunState): RunResult {
  const distance = Math.floor(state.camera / PX_PER_METER);
  const zone = zoneAt(distance);
  return {
    score: totalScore({ distanceMeters: distance, photoPoints: state.photoPoints, arcs: state.arcsDone, nearMisses: state.nearMisses }),
    distance,
    photos: state.photosCaught,
    zone,
    zoneName: zoneName(zone),
    arcs: state.arcsDone,
    nearMisses: state.nearMisses,
    ended: state.ended,
    goldenCaught: state.goldenCaught,
    goldenPlaced: state.goldenPlaced,
    saveUsed: state.saveUsed,
    savesLeft: state.saves,
    peakActors: state.peakActors,
    frames: state.frame,
    submittable: state.submittable && state.ended !== "play",
    runLog: { v: 1, seed: state.seed, inputs: flattenInputs(state.inputs) },
  };
}

export function play(state: RunState, maxFrames = MAX_FRAMES): RunResult {
  const limit = Math.min(maxFrames, MAX_FRAMES);
  while (state.ended === "play" && state.frame < limit) stepRun(state);
  if (state.ended === "play") state.ended = "time";
  return snapshot(state);
}

export function simulate(seed: number, inputs: RunInput[], maxFrames = MAX_FRAMES): RunResult {
  const state = createRun(seed);
  state.inputs = inputs;
  return play(state, maxFrames);
}

export function resimulate(log: RunLog): RunResult | null {
  if (!log || log.v !== 1 || !Number.isInteger(log.seed) || log.seed < 0) return null;
  const inputs = decodeInputs(log.inputs);
  if (!inputs || inputs.length > 4000) return null;
  return simulate(log.seed >>> 0, inputs);
}

/** Steps a hand-built course. Used by tests; live runs never lock the course. */
export function runCustom(state: RunState, inputs: RunInput[], frames: number): RunResult {
  state.lockCourse = true;
  state.submittable = false;
  state.inputs = inputs;
  return play(state, frames);
}
