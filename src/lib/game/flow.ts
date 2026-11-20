import { contestOpen, type ZoneId } from "./contest";
import { hashEmail, newConfirmToken, normalizeEmail, sha256Hex } from "./hash";
import { MAIL_FAILED, OUT_OF_CONTEST, RATE_LIMITED, SCORE_KEPT, SCORE_MISMATCH, SCORE_SENT, confirmEmail } from "./mail";
import { nicknameProblem, normalizeNickname } from "./nickname";
import { isEmail } from "../phone";
import { decodeInputs, resimulate, type RunLog, type RunResult } from "./simulate";

export const EMAIL_LIMIT = 5;
export const IP_LIMIT = 15;
export const WINDOW_MS = 30 * 60 * 1000;

export type StoredScore = {
  email: string;
  emailHash: string;
  nickname: string;
  score: number;
  distance: number;
  zone: number;
  runLog: RunLog;
  confirmedAt: string | null;
  confirmToken: string | null;
  marketingOptIn: boolean;
  marketingOptInAt: string | null;
  inContest: boolean;
  createdAt: string;
  bestScore: number | null;
  bestNickname: string | null;
  bestDistance: number | null;
  bestZone: number | null;
  bestConfirmedAt: string | null;
  bestInContest: boolean | null;
};

export type PublicRow = { nickname: string; score: number; zone: number; confirmedAt: string };

export type AdminRow = PublicRow & {
  email: string;
  distance: number;
  inContest: boolean;
  marketingOptIn: boolean;
  marketingOptInAt: string | null;
  pendingScore: number | null;
};

export type GameDb = {
  getByEmailHash(hash: string): Promise<StoredScore | null>;
  getByToken(tokenHash: string): Promise<StoredScore | null>;
  insert(row: StoredScore): Promise<void>;
  save(row: StoredScore): Promise<void>;
  leaderboard(): Promise<PublicRow[]>;
  adminTop(): Promise<AdminRow[]>;
};

export type Mailer = {
  send(message: { to: string; subject: string; text: string; html: string }): Promise<void>;
};

export function tooManyAttempts(count: number, limit: number): boolean {
  return count >= limit;
}

type Parsed =
  | { ok: false; error: string }
  | {
      ok: true;
      nickname: string;
      email: string;
      marketingOptIn: boolean;
      claimed: { score: number; distance: number; zone: ZoneId; photos: number };
      runLog: RunLog;
      result: RunResult;
    };

function asRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return input as Record<string, unknown>;
}

export function parseSubmission(input: unknown): Parsed {
  const body = asRecord(input);
  const nickname = typeof body.nickname === "string" ? normalizeNickname(body.nickname) : "";
  const nickError = nicknameProblem(nickname);
  if (nickError) return { ok: false, error: nickError };
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  if (!isEmail(email) || email.length > 120) return { ok: false, error: "Revisa el correo. No tiene un formato válido." };
  const marketingOptIn = body.marketingOptIn === true;
  const score = body.score;
  const distance = body.distance;
  const zone = body.zone;
  const photos = body.photos;
  if (!Number.isInteger(score) || (score as number) < 0 || (score as number) > 9_999_999) return { ok: false, error: SCORE_MISMATCH };
  if (!Number.isInteger(distance) || (distance as number) < 0) return { ok: false, error: SCORE_MISMATCH };
  if (zone !== 1 && zone !== 2 && zone !== 3 && zone !== 4) return { ok: false, error: SCORE_MISMATCH };
  if (!Number.isInteger(photos) || (photos as number) < 0) return { ok: false, error: SCORE_MISMATCH };
  const log = asRecord(body.runLog);
  if (log.v !== 1 || log.preview === true) return { ok: false, error: SCORE_MISMATCH };
  if (!Number.isInteger(log.seed) || (log.seed as number) < 0 || (log.seed as number) > 0xffffffff) return { ok: false, error: SCORE_MISMATCH };
  if (!Array.isArray(log.inputs) || log.inputs.length > 8000 || log.inputs.some((item) => typeof item !== "number")) {
    return { ok: false, error: SCORE_MISMATCH };
  }
  const runLog: RunLog = { v: 1, seed: (log.seed as number) >>> 0, inputs: log.inputs as number[] };
  if (!decodeInputs(runLog.inputs)) return { ok: false, error: SCORE_MISMATCH };
  const result = resimulate(runLog);
  if (!result || !result.submittable) return { ok: false, error: SCORE_MISMATCH };
  if (result.score !== score || result.distance !== distance || result.zone !== zone || result.photos !== photos) {
    return { ok: false, error: SCORE_MISMATCH };
  }
  return {
    ok: true,
    nickname,
    email,
    marketingOptIn,
    claimed: { score: score as number, distance: distance as number, zone: zone as ZoneId, photos: photos as number },
    runLog,
    result,
  };
}

function applyMarketing(row: StoredScore, optIn: boolean, now: Date): void {
  if (!optIn) return;
  row.marketingOptIn = true;
  row.marketingOptInAt = now.toISOString();
}

function writePending(row: StoredScore, parsed: Extract<Parsed, { ok: true }>, tokenHash: string, now: Date): void {
  row.nickname = parsed.nickname;
  row.email = parsed.email;
  row.score = parsed.claimed.score;
  row.distance = parsed.claimed.distance;
  row.zone = parsed.claimed.zone;
  row.runLog = parsed.runLog;
  row.confirmToken = tokenHash;
  row.confirmedAt = null;
  row.inContest = contestOpen(now);
  applyMarketing(row, parsed.marketingOptIn, now);
}

export async function submitFlow(
  deps: { db: GameDb; mailer: Mailer | null; siteUrl: string },
  input: unknown,
  ctx: { ip: string; now: Date; ipCount: number; emailCount: number },
): Promise<{ status: number; body: Record<string, unknown> }> {
  const parsed = parseSubmission(input);
  if (!parsed.ok) return { status: 400, body: { error: parsed.error } };
  if (tooManyAttempts(ctx.ipCount, IP_LIMIT) || tooManyAttempts(ctx.emailCount, EMAIL_LIMIT)) {
    return { status: 429, body: { error: RATE_LIMITED } };
  }
  const emailHash = await hashEmail(parsed.email);
  const existing = await deps.db.getByEmailHash(emailHash);
  const best = existing?.bestScore ?? -1;
  const pendingScore = existing && existing.confirmedAt == null ? existing.score : null;
  if (existing && parsed.claimed.score < best) return { status: 200, body: { ok: true, kept: true, message: SCORE_KEPT } };
  if (existing && existing.bestConfirmedAt && parsed.claimed.score === best && pendingScore == null) {
    return { status: 200, body: { ok: true, kept: true, message: SCORE_KEPT } };
  }
  if (pendingScore != null && parsed.claimed.score < pendingScore) {
    return { status: 200, body: { ok: true, kept: true, message: SCORE_KEPT } };
  }
  const token = await newConfirmToken();
  const createdAt = existing?.createdAt ?? ctx.now.toISOString();
  const row: StoredScore = existing ?? {
    email: parsed.email,
    emailHash,
    nickname: parsed.nickname,
    score: parsed.claimed.score,
    distance: parsed.claimed.distance,
    zone: parsed.claimed.zone,
    runLog: parsed.runLog,
    confirmedAt: null,
    confirmToken: null,
    marketingOptIn: false,
    marketingOptInAt: null,
    inContest: contestOpen(ctx.now),
    createdAt,
    bestScore: null,
    bestNickname: null,
    bestDistance: null,
    bestZone: null,
    bestConfirmedAt: null,
    bestInContest: null,
  };
  row.emailHash = emailHash;
  row.createdAt = createdAt;
  writePending(row, parsed, token.hash, ctx.now);
  if (existing) await deps.db.save(row);
  else await deps.db.insert(row);
  const inContest = row.inContest;
  if (!deps.mailer) return { status: 502, body: { error: MAIL_FAILED, pending: true } };
  const message = confirmEmail({
    nickname: parsed.nickname,
    score: parsed.claimed.score,
    distance: parsed.claimed.distance,
    zone: parsed.claimed.zone,
    confirmUrl: `${deps.siteUrl}/api/game-confirm?token=${token.raw}`,
    inContest,
  });
  try {
    await deps.mailer.send({ to: parsed.email, ...message });
  } catch {
    return { status: 502, body: { error: MAIL_FAILED, pending: true } };
  }
  return {
    status: 200,
    body: {
      ok: true,
      pending: true,
      inContest,
      message: inContest ? SCORE_SENT : `${SCORE_SENT} ${OUT_OF_CONTEST}`,
    },
  };
}

export async function confirmFlow(db: GameDb, tokenRaw: string, now: Date): Promise<{ ok: boolean; message: string }> {
  const raw = tokenRaw.trim();
  if (!/^[0-9a-f]{64}$/i.test(raw)) return { ok: false, message: "Este enlace no es válido." };
  const row = await db.getByToken(await sha256Hex(raw.toLowerCase()));
  if (!row || !row.confirmToken) return { ok: false, message: "Este enlace ya se usó o no es válido." };
  const confirmedAt = now.toISOString();
  row.bestScore = row.score;
  row.bestNickname = row.nickname;
  row.bestDistance = row.distance;
  row.bestZone = row.zone;
  row.bestConfirmedAt = confirmedAt;
  row.bestInContest = row.inContest;
  row.confirmedAt = confirmedAt;
  row.confirmToken = null;
  await db.save(row);
  const note = row.inContest ? "Ya está en el ranking." : "Quedó publicado y fuera de concurso.";
  return { ok: true, message: `Listo, ${row.nickname}. Confirmamos ${row.score} puntos. ${note}` };
}

function headerValue(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.split(",")[0]?.trim() ?? "";
}

export function clientIp(headers: Record<string, string | string[] | undefined>): string {
  return headerValue(headers["x-nf-client-connection-ip"]) || headerValue(headers["x-forwarded-for"]) || headerValue(headers["X-Forwarded-For"]) || "local";
}
