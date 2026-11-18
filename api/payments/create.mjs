export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method" });
    return;
  }
  const { orderId, amountCents, method, description, payer } = req.body ?? {};
  const mode = process.env.PAYMENTS_MODE || process.env.EXPO_PUBLIC_PAYMENTS_MODE || "mock";
  if (mode !== "live") {
    res.status(200).json({ provider: "mock", providerPaymentId: `mock_${orderId}`, status: "approved", mock: true, method });
    return;
  }
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if ((method === "card" || method === "yape") && token) {
    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ title: description || "Marco Recuerdo", quantity: 1, currency_id: "PEN", unit_price: (amountCents || 0) / 100 }],
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
  res.status(501).json({ error: "Configura MERCADOPAGO_ACCESS_TOKEN o deja PAYMENTS_MODE=mock." });
}
