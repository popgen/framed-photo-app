import { loadPayableOrder } from "../shop.mjs";
import {
  configuredSite,
  mercadoPagoOffered,
  PAYMENT_YAPE_NEEDS_IZIPAY,
  PAYMENTS_NOT_CONFIGURED,
  paymentMockSecret,
  requestIzipayForm,
  requestMercadoPagoCheckout,
  requestStripeCheckout,
  selectCardProvider,
  signMockToken,
} from "../../src/lib/payments.ts";

export async function createPayment(req, res, deps = {}) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido." });
    return;
  }
  const env = deps.env || process.env;
  const fetchImpl = deps.fetchImpl || fetch;
  const loadOrder = deps.loadOrder || loadPayableOrder;
  const { orderId, method } = req.body ?? {};
  const provider = selectCardProvider(env);
  if (method === "plin") {
    res.status(200).json({
      provider: "plin",
      status: "pending",
      mock: provider === "mock",
      instructions: provider === "mock" ? null : `Plin al ${env.PLIN_PHONE || ""} y escribe el pedido ${orderId}.`,
    });
    return;
  }
  if (method === "mercadopago") {
    await createMercadoPagoPayment(res, { env, fetchImpl, loadOrder, orderId });
    return;
  }
  if (provider === "mock" && !deps.loadOrder && !(env.SUPABASE_URL || env.EXPO_PUBLIC_SUPABASE_URL)) {
    res.status(200).json({ provider: "mock", status: "pending", mock: true, method });
    return;
  }
  const order = await loadOrder(String(orderId || ""));
  if (!order && provider === "mock") {
    res.status(200).json({ provider: "mock", status: "pending", mock: true, method });
    return;
  }
  if (!order) {
    res.status(404).json({ error: "No encontramos el pedido." });
    return;
  }
  const amountCents = Number(order.totalCents);
  if (provider === "mock") {
    const token = await signMockToken(
      { orderId: order.id, amountCents, exp: Date.now() + 30 * 60 * 1000, kind: "order", method: method === "yape" ? "yape" : "card" },
      paymentMockSecret(env),
    );
    res.status(200).json({ provider: "mock", status: "pending", mock: true, method, token, amountCents });
    return;
  }
  if (provider === "unconfigured") {
    res.status(501).json({ error: PAYMENTS_NOT_CONFIGURED });
    return;
  }
  if (method === "yape" && provider === "stripe") {
    res.status(400).json({ error: PAYMENT_YAPE_NEEDS_IZIPAY });
    return;
  }
  if (!order.email) {
    res.status(400).json({ error: "El pago necesita un correo." });
    return;
  }
  if (provider === "stripe") {
    const site = configuredSite(env);
    const opened = await requestStripeCheckout(
      env,
      {
        amountCents,
        orderId: order.id,
        email: order.email,
        description: `Pedido ${order.number || "Mi Fotito"}`,
        successUrl: `${site}/pago?estado=esperando&pedido=${encodeURIComponent(order.publicToken || "")}`,
        cancelUrl: `${site}/pago?error=cancelado`,
      },
      fetchImpl,
    );
    if (opened.error) {
      res.status(502).json({ error: opened.error });
      return;
    }
    res.status(200).json({ provider: "stripe", status: "pending", checkoutUrl: opened.checkoutUrl, mock: false });
    return;
  }
  const opened = await requestIzipayForm(
    env,
    {
      amountCents,
      orderId: order.id,
      email: order.email,
      name: order.customerName || "Cliente",
      phone: order.phone,
      identityType: order.taxIdType || null,
      identityCode: order.taxId || null,
      method: method === "yape" ? "yape" : "card",
    },
    fetchImpl,
  );
  if (opened.error) {
    res.status(502).json({ error: opened.error });
    return;
  }
  res.status(200).json({
    provider: "izipay",
    status: "pending",
    formToken: opened.formToken,
    publicKey: opened.publicKey,
    method: method === "yape" ? "yape" : "card",
    yapeFallback: Boolean(opened.yapeFallback),
    mock: false,
  });
}

async function createMercadoPagoPayment(res, { env, fetchImpl, loadOrder, orderId }) {
  if (!mercadoPagoOffered(env)) {
    res.status(501).json({ error: PAYMENTS_NOT_CONFIGURED });
    return;
  }
  const order = await loadOrder(String(orderId || ""));
  if (!order) {
    res.status(404).json({ error: "No encontramos el pedido." });
    return;
  }
  const amountCents = Number(order.totalCents);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    res.status(400).json({ error: "El pedido no tiene un monto por cobrar." });
    return;
  }
  if (!order.email) {
    res.status(400).json({ error: "El pago necesita un correo." });
    return;
  }
  if (!order.publicToken) {
    res.status(400).json({ error: "El pedido no tiene un enlace de confirmación." });
    return;
  }
  const opened = await requestMercadoPagoCheckout(
    env,
    {
      amountCents,
      orderId: order.id,
      email: order.email,
      name: order.customerName || "Cliente",
      description: `Pedido ${order.number || "Mi Fotito"}`,
      publicToken: order.publicToken || "",
    },
    fetchImpl,
  );
  if (opened.error) {
    res.status(502).json({ error: opened.error });
    return;
  }
  res.status(200).json({ provider: "mercadopago", status: "pending", checkoutUrl: opened.checkoutUrl, mock: false });
}

export default function handler(req, res) {
  return createPayment(req, res);
}
