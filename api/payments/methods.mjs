import { mercadoPagoOffered } from "../../src/lib/payments.ts";

export async function paymentMethods(req, res, deps = {}) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Método no permitido." });
    return;
  }
  const env = deps.env || process.env;
  res.status(200).json({ mercadopago: mercadoPagoOffered(env) });
}

export default function handler(req, res) {
  return paymentMethods(req, res);
}
