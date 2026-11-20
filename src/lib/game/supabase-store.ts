import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceSupabase } from "../service-supabase";
import type { AdminRow, GameDb, PublicRow, StoredScore } from "./flow";
import type { RunLog } from "./simulate";

type ScoreRecord = {
  nickname: string;
  email: string;
  email_hash: string;
  score: number;
  distance: number;
  zone: number;
  run_log: RunLog;
  confirmed_at: string | null;
  confirm_token: string | null;
  marketing_opt_in: boolean;
  marketing_opt_in_at: string | null;
  in_contest: boolean;
  created_at: string;
  best_score: number | null;
  best_nickname: string | null;
  best_distance: number | null;
  best_zone: number | null;
  best_confirmed_at: string | null;
  best_in_contest: boolean | null;
};

function fromRow(row: ScoreRecord): StoredScore {
  return {
    email: row.email,
    emailHash: row.email_hash,
    nickname: row.nickname,
    score: row.score,
    distance: row.distance,
    zone: row.zone,
    runLog: row.run_log,
    confirmedAt: row.confirmed_at,
    confirmToken: row.confirm_token,
    marketingOptIn: row.marketing_opt_in,
    marketingOptInAt: row.marketing_opt_in_at,
    inContest: row.in_contest,
    createdAt: row.created_at,
    bestScore: row.best_score,
    bestNickname: row.best_nickname,
    bestDistance: row.best_distance,
    bestZone: row.best_zone,
    bestConfirmedAt: row.best_confirmed_at,
    bestInContest: row.best_in_contest,
  };
}

function toRow(row: StoredScore): ScoreRecord {
  return {
    nickname: row.nickname,
    email: row.email,
    email_hash: row.emailHash,
    score: row.score,
    distance: row.distance,
    zone: row.zone,
    run_log: row.runLog,
    confirmed_at: row.confirmedAt,
    confirm_token: row.confirmToken,
    marketing_opt_in: row.marketingOptIn,
    marketing_opt_in_at: row.marketingOptInAt,
    in_contest: row.inContest,
    created_at: row.createdAt,
    best_score: row.bestScore,
    best_nickname: row.bestNickname,
    best_distance: row.bestDistance,
    best_zone: row.bestZone,
    best_confirmed_at: row.bestConfirmedAt,
    best_in_contest: row.bestInContest,
  };
}

export type GameStore = GameDb & {
  recentAttempts(bucket: string, sinceIso: string): Promise<number>;
  addAttempt(bucket: string): Promise<void>;
};

export function createGameStore(client: SupabaseClient | null = serviceSupabase()): GameStore | null {
  if (!client) return null;
  return {
    async getByEmailHash(hash) {
      const { data, error } = await client.from("game_scores").select("*").eq("email_hash", hash).maybeSingle();
      if (error) throw error;
      return data ? fromRow(data as ScoreRecord) : null;
    },
    async getByToken(tokenHash) {
      const { data, error } = await client.from("game_scores").select("*").eq("confirm_token", tokenHash).maybeSingle();
      if (error) throw error;
      return data ? fromRow(data as ScoreRecord) : null;
    },
    async insert(row) {
      const { error } = await client.from("game_scores").insert({ ...toRow(row), updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    async save(row) {
      const { error } = await client.from("game_scores").update({ ...toRow(row), updated_at: new Date().toISOString() }).eq("email_hash", row.emailHash);
      if (error) throw error;
    },
    async leaderboard() {
      const { data, error } = await client
        .from("game_scores")
        .select("best_nickname, best_score, best_zone, best_confirmed_at")
        .not("best_confirmed_at", "is", null)
        .order("best_score", { ascending: false })
        .order("best_confirmed_at", { ascending: true })
        .limit(20);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        nickname: String(row.best_nickname),
        score: Number(row.best_score),
        zone: Number(row.best_zone),
        confirmedAt: String(row.best_confirmed_at),
      })) satisfies PublicRow[];
    },
    async adminTop() {
      const { data, error } = await client
        .from("game_scores")
        .select("email, best_nickname, best_score, best_zone, best_distance, best_confirmed_at, best_in_contest, marketing_opt_in, marketing_opt_in_at, score, confirmed_at")
        .not("best_confirmed_at", "is", null)
        .order("best_score", { ascending: false })
        .order("best_confirmed_at", { ascending: true })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        email: String(row.email),
        nickname: String(row.best_nickname),
        score: Number(row.best_score),
        zone: Number(row.best_zone),
        distance: Number(row.best_distance),
        confirmedAt: String(row.best_confirmed_at),
        inContest: Boolean(row.best_in_contest),
        marketingOptIn: Boolean(row.marketing_opt_in),
        marketingOptInAt: row.marketing_opt_in_at ? String(row.marketing_opt_in_at) : null,
        pendingScore: row.confirmed_at == null && Number(row.score) !== Number(row.best_score) ? Number(row.score) : null,
      })) satisfies AdminRow[];
    },
    async recentAttempts(bucket, sinceIso) {
      const { count, error } = await client
        .from("game_submit_attempts")
        .select("id", { count: "exact", head: true })
        .eq("bucket", bucket)
        .gte("created_at", sinceIso);
      if (error) throw error;
      return count ?? 0;
    },
    async addAttempt(bucket) {
      const { error } = await client.from("game_submit_attempts").insert({ bucket });
      if (error) throw error;
    },
  };
}
