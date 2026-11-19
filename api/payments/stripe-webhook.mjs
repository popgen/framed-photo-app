import { paymentStore } from "../shop.mjs";
import { completeStripeCallback } from "../../src/lib/payments.ts";

export async function stripeWebhook(req, res, deps = {}) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido." });
    return;
  }
  const env = deps.env || process.env;
  const rawBody = req.rawBody || "";
  const header = req.headers?.["stripe-signature"] || req.headers?.["Stripe-Signature"] || "";
  const result = await completeStripeCallback(deps.store || paymentStore(), rawBody, String(header), env.STRIPE_WEBHOOK_SECRET);
  res.status(result.http).json(result.body);
}

export default function handler(req, res) {
  return stripeWebhook(req, res);
}
