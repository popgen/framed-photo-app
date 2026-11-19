import { siteOrigin } from "../imports/shared.mjs";
import { activateGiftCardPayment, paymentStore } from "../shop.mjs";
import { readPaidAnswer, verifyKrHash, readIzipayEnv } from "../../src/lib/izipay.ts";
import { completeIzipayCallback, PAYMENT_BAD_SIGNATURE, PAYMENT_DECLINED } from "../../src/lib/payments.ts";
import { serviceSupabase } from "../../src/lib/service-supabase.ts";

export function returnOrigin(req) {
  return siteOrigin(req);
}

export async function confirmIzipay(req) {
  const env = readIzipayEnv();
  const answer = String(req.body?.["kr-answer"] || "");
  const hash = String(req.body?.["kr-hash"] || "");
  if (!env.hmacKey || !answer || !(await verifyKrHash(answer, hash, env.hmacKey))) {
    return { ok: false, status: "bad_signature", error: PAYMENT_BAD_SIGNATURE };
  }
  const paid = readPaidAnswer(answer);
  if (!paid?.paid) return { ok: false, status: "declined", error: PAYMENT_DECLINED };
  if (paid.orderId.startsWith("gc:")) {
    try {
      const activated = await activateGiftCardPayment(serviceSupabase(), paid.orderId.slice(3), paid.amountCents);
      return { ok: true, redirectPath: `/regalo?listo=1&codigo=${encodeURIComponent(activated.card.code)}` };
    } catch (error) {
      return { ok: false, status: "amount", error: error.message || "No pudimos activar la tarjeta." };
    }
  }
  const result = await completeIzipayCallback(paymentStore(), req.body, env.hmacKey);
  if (result.http !== 200 || !result.body.ok) {
    return { ok: false, status: result.body.status || "amount", error: result.body.error || "No pudimos guardar el pago." };
  }
  return { ok: true, publicToken: result.body.publicToken, redirectPath: `/confirmacion/${result.body.publicToken}` };
}
