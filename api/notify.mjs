export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method" });
    return;
  }
  const { to, body, channel = "whatsapp" } = req.body ?? {};
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (channel === "whatsapp" && token && phoneId && to) {
    const version = process.env.WHATSAPP_GRAPH_VERSION || "v21.0";
    const response = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body } }),
    });
    res.status(response.ok ? 200 : 502).json({ mock: false });
    return;
  }
  console.info(`[${channel}:mock]`, to, body);
  res.status(200).json({ mock: true });
}
