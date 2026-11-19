import { paymentStore } from "../shop.mjs";
import { completeMercadoPagoNotification } from "../../src/lib/payments.ts";

export async function mercadoPagoWebhook(req, res, deps = {}) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido." });
    return;
  }
  const env = deps.env || process.env;
  const result = await completeMercadoPagoNotification(
    deps.store || paymentStore(),
    {
      headers: req.headers || {},
      query: req.query || {},
      body: req.body || {},
      secret: env.MERCADOPAGO_WEBHOOK_SECRET,
      accessToken: env.MERCADOPAGO_ACCESS_TOKEN,
    },
    deps.fetchImpl || fetch,
  );
  const body = { ...result.body };
  delete body.order;
  if (result.http === 400 && body.status === "bad_signature") console.warn("[mifotito] Mercado Pago webhook rechazado.");
  res.status(result.http).json(body);
}

export default function handler(req, res) {
  return mercadoPagoWebhook(req, res);
}
