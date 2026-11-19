import { serviceSupabase } from "../src/lib/service-supabase.ts";

const hits = new Map();

function clientIp(req) {
  const raw = req.headers?.["x-nf-client-connection-ip"] || req.headers?.["x-forwarded-for"] || "local";
  return String(raw).split(",")[0].trim() || "local";
}

function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((at) => now - at < 3_600_000);
  if (recent.length >= 20) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

async function allowed(req) {
  const secret = process.env.NOTIFY_SECRET || "";
  const header = req.headers?.["x-notify-secret"] || req.headers?.["X-Notify-Secret"] || "";
  if (secret && header && header === secret) return true;
  const supabase = serviceSupabase();
  const token = String(req.headers?.authorization || req.headers?.Authorization || "").replace(/^Bearer\s+/i, "");
  if (!supabase || !token) return false;
  const user = await supabase.auth.getUser(token);
  if (!user.data.user) return false;
  const row = await supabase.from("admin_users").select("user_id").eq("user_id", user.data.user.id).maybeSingle();
  return Boolean(row.data);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido." });
    return;
  }
  if (limited(clientIp(req)) || !(await allowed(req))) {
    res.status(401).json({ error: "No podemos enviar ese aviso." });
    return;
  }
  const { to, body, channel = "whatsapp" } = req.body ?? {};
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
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
