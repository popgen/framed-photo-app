import { paymentStore } from "../shop.mjs";
import { openMockToken, paymentMockSecret, paymentsServerMode, PAYMENT_DECLINED, settleOrderToken } from "../../src/lib/payments.ts";

export async function mockConfirm(req, res, deps = {}) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido." });
    return;
  }
  const env = deps.env || process.env;
  if (paymentsServerMode(env) === "live") {
    res.status(401).json({ error: "Solo un pago verificado puede marcar el pedido." });
    return;
  }
  const parsed = await openMockToken(String(req.body?.token || ""), deps.secret || paymentMockSecret(env));
  if (!parsed || parsed.kind === "gift_card") {
    res.status(400).json({ ok: false, error: "La firma del pago no coincide." });
    return;
  }
  if (req.body?.outcome === "declined") {
    res.status(200).json({ ok: false, declined: true, error: PAYMENT_DECLINED });
    return;
  }
  const result = await settleOrderToken(deps.store || paymentStore(), parsed);
  res.status(result.http).json(result.body);
}

export default function handler(req, res) {
  return mockConfirm(req, res);
}
