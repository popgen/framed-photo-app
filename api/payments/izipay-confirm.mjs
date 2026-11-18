import shop from "../shop.mjs";
import { readIzipayEnv, readPaidAnswer, verifyKrHash } from "../../src/lib/izipay.ts";
import { serviceSupabase } from "../../src/lib/service-supabase.ts";

export function returnOrigin(req) {
  const raw = req.headers?.origin || req.headers?.referer || "";
  if (raw) {
    try {
      return new URL(raw).origin;
    } catch {
      /* fall through */
    }
  }
  return (process.env.SITE_URL || process.env.EXPO_PUBLIC_SITE_URL || "https://mifotito.com").replace(/\/$/, "");
}

export async function confirmIzipay(req) {
  const env = readIzipayEnv();
  const answer = String(req.body?.["kr-answer"] || "");
  const hash = String(req.body?.["kr-hash"] || "");
  if (!env.hmacKey || !answer || !(await verifyKrHash(answer, hash, env.hmacKey))) {
    return { ok: false, error: "La firma de Izipay no coincide." };
  }
  const paid = readPaidAnswer(answer);
  if (!paid?.paid) return { ok: false, error: "Izipay no marcó el pago como aprobado." };
  const supabase = serviceSupabase();
  if (!supabase) return { ok: false, error: "Supabase no está configurado." };
  const { data: row } = await supabase.from("orders").select("id, total_cents, public_token").eq("id", paid.orderId).maybeSingle();
  if (!row) return { ok: false, error: "No encontramos el pedido." };
  if (Number(row.total_cents) !== paid.amountCents) return { ok: false, error: "El monto de Izipay no coincide con el pedido." };
  let captured = null;
  const capture = {
    status() {
      return capture;
    },
    json(data) {
      captured = data;
      return capture;
    },
    send() {
      return capture;
    },
  };
  await shop(
    {
      method: "POST",
      body: { op: "orders-mark-paid", orderId: row.id, method: paid.method, provider: "izipay", ref: paid.ref },
      query: {},
      headers: {},
    },
    capture,
  );
  const token = captured?.publicToken || row.public_token;
  if (!token) return { ok: false, error: "No pudimos guardar el pago." };
  return { ok: true, publicToken: token };
}
