import nodemailer from "nodemailer";
import { CONTACT_ERROR, CONTACT_RATE_LIMIT, allowContact, buildContact, safeMailError } from "../src/lib/contact.ts";
import { smtpSettings } from "../src/lib/tracking-mail.ts";

function clientIp(req) {
  const headers = req.headers ?? {};
  const netlify = headers["x-nf-client-connection-ip"];
  if (netlify) return String(netlify).split(",")[0].trim();
  const forwarded = headers["x-forwarded-for"] || headers["X-Forwarded-For"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return "local";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido." });
    return;
  }
  const built = buildContact(req.body);
  if (!built.ok) {
    res.status(400).json({ error: built.error });
    return;
  }
  if (!allowContact(clientIp(req))) {
    if (built.message.honeypot) {
      res.status(200).json({ ok: true });
      return;
    }
    res.status(429).json({ error: CONTACT_RATE_LIMIT });
    return;
  }
  if (built.message.honeypot) {
    res.status(200).json({ ok: true });
    return;
  }
  const smtp = smtpSettings();
  if (!smtp) {
    console.warn("[mifotito] Contacto sin SMTP.");
    res.status(503).json({ error: CONTACT_ERROR });
    return;
  }
  try {
    const transport = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.pass },
    });
    const message = built.message;
    await transport.sendMail({
      from: smtp.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      ...(message.replyTo ? { replyTo: message.replyTo } : {}),
    });
    res.status(200).json({ ok: true });
  } catch (error) {
    console.warn("[mifotito] No se pudo enviar el contacto.", safeMailError(error));
    res.status(502).json({ error: CONTACT_ERROR });
  }
}
