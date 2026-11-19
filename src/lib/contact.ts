import { isEmail } from "./phone";
import { retabloMessage } from "./retablo";

export const PEDIDOS_EMAIL = "pedidos@mifotito.com";
export const CUENTAS_EMAIL = "cuentas@mifotito.com";
export const CONTACT_PATH = "/api/contact";
export const HONEYPOT_FIELD = "hp_field";

export const CONTACT_SUCCESS = "¡Gracias! Recibimos tu solicitud y te escribiremos pronto.";
export const CONTACT_ERROR = "No pudimos enviar tu mensaje. Inténtalo de nuevo en un momento.";
export const CONTACT_RATE_LIMIT = "Recibimos varios mensajes seguidos. Espera un momento y vuelve a intentar.";

export const CONTACT_TYPES = ["retablo", "pedido", "contacto", "reclamo", "cuenta"] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

const LIMITS = {
  name: 80,
  email: 120,
  phone: 24,
  message: 2000,
  size: 280,
  orderNumber: 40,
  token: 80,
} as const;

const WINDOW_MS = 10 * 60 * 1000;
const MAX_SENDS = 5;
const hits = new Map<string, number[]>();

export function recipientFor(type: ContactType): string {
  return type === "cuenta" ? CUENTAS_EMAIL : PEDIDOS_EMAIL;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function asRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return input as Record<string, unknown>;
}

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function clean(value: unknown, max: number, multiline = false): string {
  let text = asText(value).replace(/\u0000/g, "");
  if (multiline) text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  else text = text.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/[ \t]{2,}/g, " ");
  return text.trim().slice(0, max);
}

export type ContactMessage = {
  type: ContactType;
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
  honeypot: boolean;
};

function honeypotMessage(): ContactMessage {
  return {
    type: "contacto",
    to: PEDIDOS_EMAIL,
    subject: "Contacto",
    text: "",
    html: "",
    honeypot: true,
  };
}

function subjectFor(type: ContactType, fields: { name: string; email: string; size: string; orderNumber: string }): string {
  if (type === "retablo") return `Solicitud de retablo – ${fields.name || fields.size}`;
  if (type === "pedido") return fields.orderNumber ? `Consulta sobre mi pedido ${fields.orderNumber}` : "Consulta sobre mi pedido";
  if (type === "reclamo") return `Reclamo – ${fields.name || fields.email || "un pedido"}`;
  if (type === "cuenta") return `Consulta de cuenta – ${fields.name}`;
  return `Contacto – ${fields.name}`;
}

function htmlBody(lines: { label: string; value: string }[]): string {
  const blocks = lines
    .map((line) => `<p style="font-size:18px;line-height:1.5"><strong>${escapeHtml(line.label)}</strong><br>${escapeHtml(line.value).replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<!doctype html><html lang="es"><body style="margin:0;background:#F6EFE6;color:#241714;font-family:Georgia,serif">
<div style="max-width:480px;margin:0 auto;padding:28px 20px">
<p style="margin:0 0 12px;font-family:sans-serif;letter-spacing:3px;font-size:12px;color:#8C2429">MI FOTITO</p>
${blocks}
</div></body></html>`;
}

export function buildContact(input: unknown): { ok: true; message: ContactMessage } | { ok: false; error: string } {
  const body = asRecord(input);
  if (clean(body[HONEYPOT_FIELD], 200)) return { ok: true, message: honeypotMessage() };

  const type = clean(body.type, 24);
  if (!CONTACT_TYPES.includes(type as ContactType)) return { ok: false, error: "No reconocemos ese tipo de mensaje." };
  const kind = type as ContactType;
  const name = clean(body.name, LIMITS.name);
  const email = clean(body.email, LIMITS.email);
  const phone = clean(body.phone, LIMITS.phone);
  const message = clean(body.message, LIMITS.message, true);
  const size = clean(body.size, LIMITS.size);
  const orderNumber = clean(body.orderNumber, LIMITS.orderNumber);
  const token = clean(body.token, LIMITS.token);

  if (email && !isEmail(email)) return { ok: false, error: "Revisa el correo. No tiene un formato válido." };

  if (kind === "retablo") {
    if (size.length < 2) return { ok: false, error: "Cuéntanos el tamaño en una frase." };
  } else if (kind === "pedido") {
    if (message.length < 2) return { ok: false, error: "Escribe tu mensaje." };
  } else if (kind === "reclamo") {
    if (!email) return { ok: false, error: "Ingresa el correo donde te escribimos." };
    if (message.length < 2) return { ok: false, error: "Cuéntanos qué pasó." };
  } else if (name.length < 2) {
    return { ok: false, error: "Escribe tu nombre." };
  } else if (!email) {
    return { ok: false, error: "Ingresa un correo válido." };
  } else if (message.length < 2) {
    return { ok: false, error: "Escribe tu mensaje." };
  }

  const lines: { label: string; value: string }[] = [];
  if (kind === "retablo") lines.push({ label: "Pedido", value: retabloMessage(size) });
  if (name) lines.push({ label: "Nombre", value: name });
  if (email) lines.push({ label: "Correo", value: email });
  if (phone) lines.push({ label: "Celular", value: phone });
  if (size && kind !== "retablo") lines.push({ label: "Tamaño", value: size });
  if (orderNumber) lines.push({ label: "Número de pedido", value: orderNumber });
  if (token) lines.push({ label: "Código del enlace", value: token });
  if (message) lines.push({ label: "Mensaje", value: message });

  const text = lines.map((line) => `${line.label}: ${line.value}`).join("\n");
  return {
    ok: true,
    message: {
      type: kind,
      to: recipientFor(kind),
      replyTo: email ? email : undefined,
      subject: subjectFor(kind, { name, email, size, orderNumber }),
      text,
      html: htmlBody(lines),
      honeypot: false,
    },
  };
}

export function allowContact(ip: string, now = Date.now()): boolean {
  const key = ip.trim() || "desconocido";
  const recent = (hits.get(key) ?? []).filter((at) => now - at < WINDOW_MS);
  if (recent.length >= MAX_SENDS) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

export function resetContactLimiter(): void {
  hits.clear();
}

export function safeMailError(error: unknown, env: NodeJS.ProcessEnv = process.env): string {
  const raw = error instanceof Error ? error.message : "el servidor de correo no respondió";
  const pass = env.SMTP_PASS;
  const redacted = pass ? raw.split(pass).join("[redacted]") : raw;
  return redacted.slice(0, 300);
}

export async function submitContact(body: Record<string, string>): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch(CONTACT_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: unknown } | null;
    if (!response.ok || !data || data.ok !== true) {
      const error = data && typeof data.error === "string" && data.error.trim() ? data.error : CONTACT_ERROR;
      return { ok: false, error };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: CONTACT_ERROR };
  }
}
