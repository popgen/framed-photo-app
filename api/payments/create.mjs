import { IZIPAY_CREATE_URL, createPaymentBody, izipayAuthHeader, izipayReady, readIzipayEnv } from "../../src/lib/izipay.ts";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido." });
    return;
  }
  const { orderId, amountCents, method, description, payer } = req.body ?? {};
  const mode = process.env.PAYMENTS_MODE || process.env.EXPO_PUBLIC_PAYMENTS_MODE || "mock";
  if (mode !== "live") {
    res.status(200).json({ provider: "mock", providerPaymentId: `mock_${orderId}`, status: "approved", mock: true, method });
    return;
  }
  const izipay = readIzipayEnv();
  if ((method === "card" || method === "yape") && izipayReady(izipay)) {
    if (!payer?.email) {
      res.status(400).json({ error: "Izipay necesita un correo para abrir el pago." });
      return;
    }
    const response = await fetch(IZIPAY_CREATE_URL, {
      method: "POST",
      headers: { Authorization: izipayAuthHeader(izipay.commerceId, izipay.apiKey), "Content-Type": "application/json" },
      body: JSON.stringify(
        createPaymentBody({
          amountCents,
          orderId: String(orderId || ""),
          email: payer.email,
          name: payer.name || "Cliente",
          phone: payer.phone,
          identityType: payer.identityType,
          identityCode: payer.identityCode,
        }),
      ),
    });
    const json = await response.json().catch(() => ({}));
    if (response.ok && json.status === "SUCCESS" && json.answer?.formToken) {
      res.status(200).json({ provider: "izipay", status: "pending", formToken: json.answer.formToken, publicKey: izipay.publicKey, mock: false });
      return;
    }
    console.warn("[mifotito] Izipay no abrió el formulario.", json.answer?.errorMessage || json.status || response.status);
    res.status(502).json({ error: "Izipay no pudo abrir el pago. Inténtalo otra vez." });
    return;
  }
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if ((method === "card" || method === "yape") && token) {
    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ title: description || "Marco Mi Fotito", quantity: 1, currency_id: "PEN", unit_price: (amountCents || 0) / 100 }],
        payer: { name: payer?.name, email: payer?.email },
        external_reference: orderId,
        metadata: { method },
      }),
    });
    const json = await response.json();
    res.status(response.ok ? 200 : 502).json({ provider: "mercadopago", status: "pending", checkoutUrl: json.init_point, mock: false });
    return;
  }
  if (method === "plin") {
    res.status(200).json({
      provider: "plin",
      status: "pending",
      mock: false,
      instructions: `Plin al ${process.env.PLIN_PHONE || ""} y escribe el pedido ${orderId}.`,
    });
    return;
  }
  res.status(501).json({ error: "El pago en vivo no está configurado. Escríbenos por WhatsApp." });
}
