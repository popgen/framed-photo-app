import { describe, expect, it } from "vitest";
import { CONTEST_CLOSE_ISO, PHOTO_POINTS, contestOpen, zoneAt, zoneName } from "../src/lib/game/contest";
import { JUMP, createJumper, holdBit, jumpApex, keyHold, pressJump, releaseJump, stepJump, DT } from "../src/lib/game/jump";
import { foldNickname, nicknameProblem } from "../src/lib/game/nickname";
import { totalScore } from "../src/lib/game/score";
import {
  PX_PER_METER,
  SANTA_H,
  SANTA_W,
  SANTA_X,
  createRun,
  gapPx,
  play,
  resimulate,
  runCustom,
  simulate,
  speedPxPerSec,
  stepRun,
  type Actor,
} from "../src/lib/game/simulate";
import { MAIL_FAILED, OUT_OF_CONTEST, SCORE_KEPT, SCORE_MISMATCH, SCORE_SENT, confirmEmail } from "../src/lib/game/mail";
import { confirmFlow, parseSubmission, submitFlow, tooManyAttempts, type GameDb, type StoredScore } from "../src/lib/game/flow";

function actor(partial: Partial<Actor> & Pick<Actor, "kind" | "x" | "y" | "w" | "h">): Actor {
  return {
    id: partial.id ?? 1,
    photo: partial.photo ?? null,
    arc: partial.arc ?? null,
    arcSize: partial.arcSize ?? 0,
    caught: false,
    gone: false,
    scoredNear: false,
    minClear: Number.POSITIVE_INFINITY,
    zone: partial.zone ?? 1,
    ...partial,
  };
}

describe("variable jump", () => {
  const tap = jumpApex(0);
  const medium = jumpApex(0.14);
  const max = jumpApex(JUMP.maxHold);
  const longer = jumpApex(2);

  it("keeps a tap below a medium hold, and a max hold on the height cap", () => {
    expect(tap).toBeGreaterThan(40);
    expect(tap).toBeLessThan(medium);
    expect(medium).toBeLessThan(max);
    expect(max).toBe(JUMP.maxHeight);
    expect(longer).toBe(JUMP.maxHeight);
  });

  it("cuts the arc when the hold is released while rising", () => {
    const early = jumpApex(0.04);
    const held = jumpApex(0.1);
    expect(early).toBeLessThan(held);
    expect(held).toBeLessThan(JUMP.maxHeight);
    const jumper = createJumper();
    pressJump(jumper);
    stepJump(jumper, DT);
    expect(jumper.vy).toBeGreaterThan(0);
    expect(jumper.grounded).toBe(false);
    const rising = jumper.vy;
    releaseJump(jumper);
    expect(jumper.holding).toBe(false);
    expect(jumper.vy).toBeCloseTo(rising * JUMP.cutFactor, 5);
    expect(jumper.vy).toBeLessThan(rising);
  });

  it("uses the same bits for touch, mouse, space and arrow up", () => {
    for (const source of ["touch", "mouse", "space", "arrow"] as const) {
      expect(holdBit(source, true)).toBe(1);
      expect(holdBit(source, false)).toBe(0);
    }
    expect(keyHold("Space", true)).toBe(1);
    expect(keyHold("ArrowUp", false)).toBe(0);
    expect(keyHold("KeyA", true)).toBeNull();
    const taps = ["touch", "mouse", "space", "arrow"].map(() => jumpApex(0));
    expect(new Set(taps).size).toBe(1);
  });
});

describe("zones, speed and score", () => {
  it("switches zone on the distance thresholds", () => {
    expect(zoneAt(0)).toBe(1);
    expect(zoneAt(499.9)).toBe(1);
    expect(zoneAt(500)).toBe(2);
    expect(zoneAt(1199)).toBe(2);
    expect(zoneAt(1200)).toBe(3);
    expect(zoneAt(2499)).toBe(3);
    expect(zoneAt(2500)).toBe(4);
    expect(zoneAt(9000)).toBe(4);
    expect(zoneName(1)).toBe("Pueblo Nevado");
    expect(zoneName(2)).toBe("Bosque al Atardecer");
    expect(zoneName(3)).toBe("Noche Torcida");
    expect(zoneName(4)).toBe("Pesadilla");
  });

  it("speeds up about every 10 seconds and tightens the gaps", () => {
    expect(speedPxPerSec(0)).toBeLessThan(speedPxPerSec(10));
    expect(speedPxPerSec(10)).toBeLessThan(speedPxPerSec(20));
    expect(speedPxPerSec(9.9)).toBe(speedPxPerSec(0));
    expect(gapPx(0)).toBeGreaterThan(gapPx(10));
    expect(gapPx(10)).toBeGreaterThan(gapPx(40));
  });

  it("scores a meter, a photo by zone, a full arc and a near miss", () => {
    expect(PHOTO_POINTS).toEqual({ 1: 25, 2: 50, 3: 75, 4: 100 });
    expect(totalScore({ distanceMeters: 12.8, photoPoints: 25 + 100, arcs: 1, nearMisses: 2 })).toBe(12 + 125 + 100 + 20);
  });
});

describe("course simulation", () => {
  it("replays the same seed and inputs to the same result", () => {
    const inputs = [
      { f: 12, d: 1 as const },
      { f: 20, d: 0 as const },
      { f: 70, d: 1 as const },
      { f: 96, d: 0 as const },
    ];
    const first = simulate(42, inputs, 4000);
    const second = simulate(42, inputs, 4000);
    expect(second).toEqual(first);
    expect(resimulate(first.runLog)).toEqual(first);
    const still = simulate(42, [], 4000);
    expect(still).not.toEqual(first);
  });

  it("places at most one golden photo and grants a single save", () => {
    const state = createRun(9);
    state.saves = 5000;
    const goal = state.goldenMeter + 40;
    while (state.ended === "play" && state.camera / PX_PER_METER < goal && state.frame < 20000) {
      state.saves = 5000;
      stepRun(state);
    }
    expect(state.goldenPlaced).toBe(1);

    const saved = createRun(1);
    saved.actors = [
      actor({ id: 1, kind: "dorado", x: 160, y: 8, w: 30, h: 30, photo: "dorado", zone: 1 }),
      actor({ id: 2, kind: "pine", x: 340, y: 0, w: 40, h: 120 }),
      actor({ id: 3, kind: "pine", x: 760, y: 0, w: 40, h: 120 }),
    ];
    const withSave = runCustom(saved, [], 500);
    expect(withSave.goldenCaught).toBe(true);
    expect(withSave.saveUsed).toBe(true);
    expect(withSave.savesLeft).toBe(0);
    expect(withSave.ended).toBe("crash");
    expect(withSave.photos).toBe(1);

    const plain = createRun(1);
    plain.actors = [
      actor({ id: 2, kind: "pine", x: 340, y: 0, w: 40, h: 120 }),
      actor({ id: 3, kind: "pine", x: 760, y: 0, w: 40, h: 120 }),
    ];
    const crashed = runCustom(plain, [], 500);
    expect(crashed.ended).toBe("crash");
    expect(crashed.saveUsed).toBe(false);
    expect(crashed.distance).toBeLessThan(withSave.distance);
  });

  it("counts a low photo, a full arc and a close clearance", () => {
    const photos = createRun(2);
    photos.actors = [
      actor({ id: 1, kind: "familia", x: 200, y: 8, w: 30, h: 30, photo: "familia", zone: 1 }),
      actor({ id: 2, kind: "perro", x: 520, y: 8, w: 30, h: 30, photo: "perro", zone: 2 }),
    ];
    const caught = runCustom(photos, [], 400);
    expect(caught.photos).toBe(2);
    expect(caught.score).toBe(caught.distance + PHOTO_POINTS[1] + PHOTO_POINTS[2]);

    const arc = createRun(3);
    arc.actors = [0, 1, 2, 3, 4].map((index) =>
      actor({ id: index + 1, kind: "bebe", x: 180 + index * 50, y: 6, w: 28, h: 28, photo: "bebe", zone: 1, arc: 7, arcSize: 5 }),
    );
    const arced = runCustom(arc, [], 400);
    expect(arced.arcs).toBe(1);
    expect(arced.photos).toBe(5);
    expect(arced.score).toBe(arced.distance + 5 * PHOTO_POINTS[1] + 100);

    const near = createRun(4);
    near.actors = [actor({ id: 1, kind: "stump", x: 140, y: 0, w: 8, h: 40 })];
    const inputs = [{ f: 0, d: 1 as const }, { f: 0, d: 0 as const }];
    const cleared = runCustom(near, inputs, 180);
    expect(cleared.ended).not.toBe("crash");
    expect(cleared.nearMisses).toBe(1);
    expect(cleared.score).toBe(cleared.distance + 10);
  });

  it("keeps the actor list bounded over a long run", () => {
    const state = createRun(5);
    state.saves = 20000;
    const started = performance.now();
    const result = play(state, 60 * 45);
    const elapsed = performance.now() - started;
    expect(result.frames).toBe(60 * 45);
    expect(result.peakActors).toBeLessThan(40);
    expect(result.peakActors).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(1500);
    expect(SANTA_W).toBeGreaterThan(0);
    expect(SANTA_H).toBeGreaterThan(0);
    expect(SANTA_X).toBeGreaterThan(0);
    expect(PX_PER_METER).toBe(40);
  });
});

describe("nickname filter", () => {
  it("accepts a short public name and blocks Spanish and English slurs", () => {
    expect(nicknameProblem("Ana")).toBeNull();
    expect(nicknameProblem("Luz María")).toBeNull();
    expect(nicknameProblem("abuelo2")).toBeNull();
    expect(nicknameProblem("A")).not.toBeNull();
    expect(nicknameProblem("este apodo es demasiado largo")).not.toBeNull();
    expect(nicknameProblem("hola@ana")).not.toBeNull();
    expect(nicknameProblem("mierda")).not.toBeNull();
    expect(nicknameProblem("P3ndej0")).not.toBeNull();
    expect(nicknameProblem("oh fuck")).not.toBeNull();
    expect(nicknameProblem("f.u.c.k")).not.toBeNull();
    expect(foldNickname("Puta")).toContain("puta");
    expect(nicknameProblem("shithead")).not.toBeNull();
  });
});

function memoryDb(): GameDb & { rows: StoredScore[] } {
  const rows: StoredScore[] = [];
  return {
    rows,
    async getByEmailHash(hash) {
      return rows.find((row) => row.emailHash === hash) ?? null;
    },
    async getByToken(tokenHash) {
      return rows.find((row) => row.confirmToken === tokenHash) ?? null;
    },
    async insert(row) {
      rows.push({ ...row, runLog: { ...row.runLog, inputs: [...row.runLog.inputs] } });
    },
    async save(row) {
      const index = rows.findIndex((item) => item.emailHash === row.emailHash);
      const copy = { ...row, runLog: { ...row.runLog, inputs: [...row.runLog.inputs] } };
      if (index >= 0) rows[index] = copy;
      else rows.push(copy);
    },
    async leaderboard() {
      return rows
        .filter((row) => row.bestConfirmedAt && row.bestNickname && row.bestScore != null && row.bestZone != null)
        .map((row) => ({ nickname: row.bestNickname as string, score: row.bestScore as number, zone: row.bestZone as number, confirmedAt: row.bestConfirmedAt as string }))
        .sort((a, b) => b.score - a.score || a.confirmedAt.localeCompare(b.confirmedAt))
        .slice(0, 20);
    },
    async adminTop() {
      return [];
    },
    async recentAttempts() {
      return 0;
    },
    async addAttempt() {},
  };
}

function submission(over: Record<string, unknown> = {}) {
  const result = simulate(8, [{ f: 8, d: 1 }, { f: 16, d: 0 }], 3000);
  return {
    nickname: "Ana",
    email: "Ana@Ejemplo.com",
    marketingOptIn: false,
    score: result.score,
    distance: result.distance,
    zone: result.zone,
    photos: result.photos,
    runLog: result.runLog,
    ...over,
  };
}

describe("submission checks", () => {
  it("rejects a tampered score, a bad nickname and a closed-looking payload", () => {
    const good = parseSubmission(submission());
    expect(good.ok).toBe(true);
    const tampered = parseSubmission(submission({ score: 999999 }));
    expect(tampered.ok).toBe(false);
    if (!tampered.ok) expect(tampered.error).toBe(SCORE_MISMATCH);
    const rude = parseSubmission(submission({ nickname: "shit" }));
    expect(rude.ok).toBe(false);
    const mail = parseSubmission(submission({ email: "no-es-correo" }));
    expect(mail.ok).toBe(false);
    expect(tooManyAttempts(5, 5)).toBe(true);
    expect(tooManyAttempts(4, 5)).toBe(false);
  });

  it("stores the score as pending and keeps it pending when the mail fails", async () => {
    const db = memoryDb();
    const sent: string[] = [];
    const body = submission({ marketingOptIn: true });
    const ok = await submitFlow(
      { db, siteUrl: "https://mifotito.com", mailer: { send: async (message) => { sent.push(message.subject); } } },
      body,
      { ip: "203.0.113.8", now: new Date("2026-11-20T12:00:00-05:00"), ipCount: 0, emailCount: 0 },
    );
    expect(ok.status).toBe(200);
    expect(ok.body.message).toBe(SCORE_SENT);
    expect(db.rows).toHaveLength(1);
    expect(db.rows[0]?.confirmedAt).toBeNull();
    expect(db.rows[0]?.marketingOptIn).toBe(true);
    expect(db.rows[0]?.marketingOptInAt).toBeTruthy();
    expect(db.rows[0]?.email).toBe("ana@ejemplo.com");
    expect(sent).toEqual(["Confirma tu puntaje en Santa a la Carrera"]);
    const again = await submitFlow(
      { db, siteUrl: "https://mifotito.com", mailer: { send: async () => { throw new Error("smtp"); } } },
      body,
      { ip: "203.0.113.8", now: new Date("2026-11-20T12:10:00-05:00"), ipCount: 1, emailCount: 1 },
    );
    expect(again.status).toBe(502);
    expect(again.body.error).toBe(MAIL_FAILED);
    expect(db.rows[0]?.confirmedAt).toBeNull();
    expect(db.rows[0]?.confirmToken).toBeTruthy();
  });

  it("publishes only after confirmation and ignores a lower rerun", async () => {
    const db = memoryDb();
    let raw = "";
    const body = submission();
    await submitFlow(
      {
        db,
        siteUrl: "https://mifotito.com",
        mailer: { send: async (message) => { raw = message.text; } },
      },
      body,
      { ip: "198.51.100.4", now: new Date("2026-11-20T12:00:00-05:00"), ipCount: 0, emailCount: 0 },
    );
    expect(await db.leaderboard()).toEqual([]);
    const token = raw.match(/token=([0-9a-f]+)/)?.[1] ?? "";
    const confirmed = await confirmFlow(db, token, new Date("2026-11-20T13:00:00-05:00"));
    expect(confirmed.ok).toBe(true);
    const board = await db.leaderboard();
    expect(board).toHaveLength(1);
    expect(board[0]?.nickname).toBe("Ana");
    expect(board[0]?.score).toBe((body.score as number));
    const kept = await submitFlow(
      { db, siteUrl: "https://mifotito.com", mailer: { send: async () => { throw new Error("no debe enviar"); } } },
      { ...body, score: (body.score as number) },
      { ip: "198.51.100.4", now: new Date("2026-11-20T14:00:00-05:00"), ipCount: 0, emailCount: 0 },
    );
    expect(kept.status).toBe(200);
    expect(kept.body.kept).toBe(true);
    expect(kept.body.message).toBe(SCORE_KEPT);
    expect((await db.leaderboard())[0]?.score).toBe(body.score);
  });

  it("marks a run after the close as outside the contest", async () => {
    expect(contestOpen(new Date("2026-12-15T23:59:59-05:00"))).toBe(true);
    expect(contestOpen(new Date("2026-12-16T00:00:00-05:00"))).toBe(false);
    expect(CONTEST_CLOSE_ISO).toBe("2026-12-15T23:59:59-05:00");
    const db = memoryDb();
    const late = await submitFlow(
      { db, siteUrl: "https://mifotito.com", mailer: { send: async () => {} } },
      submission(),
      { ip: "198.51.100.9", now: new Date("2026-12-16T12:00:00-05:00"), ipCount: 0, emailCount: 0 },
    );
    expect(late.status).toBe(200);
    expect(String(late.body.message)).toContain(OUT_OF_CONTEST);
    expect(db.rows[0]?.inContest).toBe(false);
    const letter = confirmEmail({ nickname: "Ana", score: 10, distance: 10, zone: 1, confirmUrl: "https://mifotito.com/api/game-confirm?token=abc", inContest: false });
    expect(letter.html).toContain("MI FOTITO");
    expect(letter.text).toContain("fuera de concurso");
    expect(letter.html).not.toContain("<script");
  });
});
