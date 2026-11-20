import { safeMailError } from "../src/lib/contact.ts";
import { hashEmail, sha256Hex } from "../src/lib/game/hash.ts";
import { WINDOW_MS, clientIp, submitFlow } from "../src/lib/game/flow.ts";
import { createGameStore } from "../src/lib/game/supabase-store.ts";
import { smtpSettings } from "../src/lib/tracking-mail.ts";
import nodemailer from "nodemailer";

const UNAVAILABLE = "El ranking no está disponible en este momento.";

function mailer() {
  const smtp = smtpSettings();
  if (!smtp) return null;
  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
  });
  return {
    async send(message) {
      await transport.sendMail({
        from: smtp.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
    },
  };
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const db = createGameStore();
    if (!db) {
      res.status(200).json({ rows: [], unavailable: true });
      return;
    }
    try {
      const rows = await db.leaderboard();
      res.status(200).json({ rows });
    } catch (error) {
      console.warn("[mifotito] Ranking no disponible.", safeMailError(error));
      res.status(503).json({ error: UNAVAILABLE });
    }
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido." });
    return;
  }
  const db = createGameStore();
  if (!db) {
    res.status(503).json({ error: UNAVAILABLE });
    return;
  }
  try {
    const now = new Date();
    const since = new Date(now.getTime() - WINDOW_MS).toISOString();
    const ip = clientIp(req.headers ?? {});
    const ipBucket = `ip:${await sha256Hex(ip)}`;
    const ipCount = await db.recentAttempts(ipBucket, since);
    const email = req.body?.email;
    let emailBucket = "";
    let emailCount = 0;
    if (typeof email === "string" && email.trim()) {
      emailBucket = `em:${await hashEmail(email)}`;
      emailCount = await db.recentAttempts(emailBucket, since);
    }
    const result = await submitFlow(
      { db, mailer: mailer(), siteUrl: "https://mifotito.com" },
      req.body,
      { ip, now, ipCount, emailCount },
    );
    if (result.status !== 429) {
      await db.addAttempt(ipBucket);
      if (emailBucket) await db.addAttempt(emailBucket);
    }
    res.status(result.status).json(result.body);
  } catch (error) {
    console.warn("[mifotito] No se pudo guardar el puntaje.", safeMailError(error));
    res.status(503).json({ error: UNAVAILABLE });
  }
}
