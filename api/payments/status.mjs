import { serviceSupabase } from "../../src/lib/service-supabase.ts";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido." });
    return;
  }
  const supabase = serviceSupabase();
  if (!supabase) {
    res.status(200).json({ status: "pending" });
    return;
  }
  const code = String(req.query?.codigo || req.body?.codigo || "");
  if (code) {
    const card = await supabase.from("gift_cards").select("status, balance_cents").eq("code", code).maybeSingle();
    const approved = card.data?.status === "active" && Number(card.data.balance_cents) > 0;
    res.status(200).json({ status: approved ? "approved" : "pending" });
    return;
  }
  const token = String(req.query?.pedido || req.body?.pedido || "");
  if (!token) {
    res.status(400).json({ error: "Falta el pedido." });
    return;
  }
  const order = await supabase.from("orders").select("payment_status").eq("public_token", token).maybeSingle();
  const status = order.data?.payment_status;
  res.status(200).json({ status: status === "approved" || status === "rejected" ? status : "pending" });
}
