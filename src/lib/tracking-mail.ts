export const TRACKING_SUBJECT = "Tu pedido va en camino";

const SMTP_KEYS = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"] as const;

export type SmtpSettings = { host: string; port: number; user: string; pass: string; from: string; secure: boolean };

export function trackingLink(publicToken: string): string {
  return `https://mifotito.com/pedido/${encodeURIComponent(publicToken)}`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function trackingEmail(order: {
  number: string;
  publicToken: string;
  trackingNumber: string;
  customerName?: string | null;
}): { subject: string; text: string; html: string; link: string } {
  const link = trackingLink(order.publicToken);
  const first = order.customerName?.trim().split(/\s+/)[0];
  const hello = first ? `Hola ${first},` : "Hola,";
  const text = [
    hello,
    "",
    `Tu pedido ${order.number} de Mi Fotito ya va en camino.`,
    `Número de guía: ${order.trackingNumber}`,
    `Sigue tu pedido: ${link}`,
    "",
    "Mi Fotito",
  ].join("\n");
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#F6EFE6;color:#241714;font-family:Georgia,serif">
<div style="max-width:480px;margin:0 auto;padding:28px 20px">
<p style="margin:0 0 12px;font-family:sans-serif;letter-spacing:3px;font-size:12px;color:#8C2429">MI FOTITO</p>
<h1 style="margin:0 0 16px;font-weight:normal;font-size:32px">${TRACKING_SUBJECT}</h1>
<p style="font-size:18px;line-height:1.5">${escapeHtml(hello)}</p>
<p style="font-size:18px;line-height:1.5">Tu pedido <strong>${escapeHtml(order.number)}</strong> ya va en camino.</p>
<p style="font-size:18px;line-height:1.5">Número de guía: <strong>${escapeHtml(order.trackingNumber)}</strong></p>
<p style="font-size:18px;line-height:1.5"><a href="${escapeHtml(link)}" style="color:#8C2429">${escapeHtml(link)}</a></p>
</div></body></html>`;
  return { subject: TRACKING_SUBJECT, text, html, link };
}

export function smtpSettings(env: NodeJS.ProcessEnv = process.env): SmtpSettings | null {
  const host = env.SMTP_HOST?.trim();
  const user = env.SMTP_USER?.trim();
  const pass = env.SMTP_PASS;
  const from = env.SMTP_FROM?.trim();
  const port = Number(env.SMTP_PORT || "");
  if (!host || !user || !pass || !from || !Number.isFinite(port) || port <= 0) return null;
  return { host, port, user, pass, from, secure: port === 465 };
}

export function missingSmtp(env: NodeJS.ProcessEnv = process.env): string[] {
  return SMTP_KEYS.filter((key) => !env[key]?.trim());
}

export function trackingWarning(input: { email?: string | null; smtpReady: boolean; sent: boolean; reason?: string | null }): string | null {
  if (!input.email?.trim()) return "Este pedido no tiene correo. Guardamos la guía, pero no enviamos el aviso.";
  if (!input.smtpReady) return "Guardamos la guía, pero el correo no salió: faltan SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS o SMTP_FROM.";
  if (!input.sent) {
    const reason = input.reason?.trim();
    return reason
      ? `Guardamos la guía, pero el correo no salió: ${reason}`
      : "Guardamos la guía, pero el correo no salió.";
  }
  return null;
}
