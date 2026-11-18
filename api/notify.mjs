export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method" });
    return;
  }
  const { to, body, channel = "whatsapp" } = req.body ?? {};
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (channel === "whatsapp" && (!token || !phoneId)) {
    console.warn("[mifotito] WhatsApp Business pendiente (notify). Faltan WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID. El aviso queda solo en el log.");
  }
  if (channel === "whatsapp" && token && phoneId && to) {
    const version = process.env.WHATSAPP_GRAPH_VERSION || "v21.0";
    try {
      const response = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body } }),
      });
      if (!response.ok) console.warn(`[mifotito] WhatsApp rechazó el aviso: ${await response.text()}`);
      res.status(200).json({ mock: !response.ok });
      return;
    } catch (error) {
      console.warn("[mifotito] WhatsApp Cloud API no respondió al aviso.", error);
      res.status(200).json({ mock: true });
      return;
    }
  }
  console.info(`[${channel}:mock]`, to, body);
  res.status(200).json({ mock: true });
}
