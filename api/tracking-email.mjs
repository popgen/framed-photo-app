import nodemailer from "nodemailer";
import { serviceSupabase } from "../src/lib/service-supabase.ts";
import { smtpSettings, trackingEmail, trackingWarning } from "../src/lib/tracking-mail.ts";

function bearer(req) {
  const headers = req.headers ?? {};
  const value = headers.authorization || headers.Authorization || "";
  return String(value).replace(/^Bearer\s+/i, "").trim();
}

async function requireAdmin(supabase, token) {
  if (!token) return null;
  const user = await supabase.auth.getUser(token);
  const id = user.data?.user?.id;
  if (!id) return null;
  const row = await supabase.from("admin_users").select("user_id").eq("user_id", id).maybeSingle();
  if (row.error || row.data?.user_id !== id) return null;
  return user.data.user;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido." });
    return;
  }
  const supabase = serviceSupabase();
  if (!supabase) {
    res.status(503).json({ error: "Supabase no está configurado." });
    return;
  }
  const admin = await requireAdmin(supabase, bearer(req));
  if (!admin) {
    res.status(401).json({ error: "Solo un administrador puede avisar el envío." });
    return;
  }
  const orderId = String(req.body?.orderId || "").trim();
  const tracking = String(req.body?.tracking || "").trim();
  if (!orderId || !tracking) {
    res.status(400).json({ error: "Escribe el número de guía." });
    return;
  }
  const existing = await supabase.from("orders").select("id, number, email, public_token, customer_name").eq("id", orderId).maybeSingle();
  if (existing.error || !existing.data) {
    res.status(404).json({ error: "No encontramos el pedido." });
    return;
  }
  const now = new Date().toISOString();
  const saved = await supabase.from("orders").update({ tracking_number: tracking, status: "shipped", updated_at: now }).eq("id", orderId);
  if (saved.error) {
    res.status(500).json({ error: saved.error.message || "No pudimos guardar la guía." });
    return;
  }
  const order = existing.data;
  const email = String(order.email || "").trim();
  const smtp = smtpSettings();
  if (!email || !smtp) {
    res.status(200).json({
      ok: true,
      saved: true,
      emailed: false,
      warning: trackingWarning({ email, smtpReady: Boolean(smtp), sent: false }),
    });
    return;
  }
  const message = trackingEmail({
    number: order.number,
    publicToken: order.public_token,
    trackingNumber: tracking,
    customerName: order.customer_name,
  });
  let sent = false;
  let reason = null;
  try {
    const transport = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.pass },
    });
    await transport.sendMail({ from: smtp.from, to: email, subject: message.subject, text: message.text, html: message.html });
    sent = true;
  } catch (error) {
    reason = error instanceof Error ? error.message : "el servidor de correo no respondió";
    console.warn("[mifotito] No se pudo enviar el correo de guía.", reason);
  }
  if (sent) {
    const logged = await supabase.from("notification_log").insert({
      order_id: order.id,
      channel: "email",
      to_address: email,
      body: message.text,
      event: "shipped",
    });
    if (logged.error) console.warn(`[mifotito] La guía se envió, pero no quedó en notification_log: ${logged.error.message}`);
  }
  const warning = trackingWarning({ email, smtpReady: true, sent, reason });
  res.status(200).json({ ok: true, saved: true, emailed: sent, warning });
}
