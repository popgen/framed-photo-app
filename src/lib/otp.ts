import { normalizePhone } from "./phone";

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MIN_INTERVAL_MS = 60 * 1000;
export const OTP_HOUR_MAX = 5;
export const SESSION_TTL_MS = 30 * 60 * 1000;
export const OTP_TEMPLATE_NAME = "mifotito_codigo";

export type OtpRecord = {
  phone: string;
  codeHash: string;
  salt: string;
  expiresAt: number;
  attempts: number;
};

export type SendStamp = { at: number };

export function generateCode(): string {
  const roll = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(roll).padStart(6, "0");
}

export function randomSalt(): string {
  return hex(crypto.getRandomValues(new Uint8Array(16)));
}

export async function hashCode(code: string, salt: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${code}`));
  return hex(new Uint8Array(digest));
}

export function canSend(sends: SendStamp[], now: number): { ok: true } | { ok: false; retryAt: number } {
  const hour = sends.filter((item) => now - item.at < 3_600_000);
  const last = hour.reduce((max, item) => Math.max(max, item.at), 0);
  if (last && now - last < OTP_MIN_INTERVAL_MS) return { ok: false, retryAt: last + OTP_MIN_INTERVAL_MS };
  if (hour.length >= OTP_HOUR_MAX) {
    const oldest = Math.min(...hour.map((item) => item.at));
    return { ok: false, retryAt: oldest + 3_600_000 };
  }
  return { ok: true };
}

export function canSendPair(phoneSends: SendStamp[], ipSends: SendStamp[], now: number) {
  const phone = canSend(phoneSends, now);
  const ip = canSend(ipSends, now);
  if (phone.ok && ip.ok) return { ok: true as const };
  return { ok: false as const, retryAt: Math.max(phone.ok ? 0 : phone.retryAt, ip.ok ? 0 : ip.retryAt) };
}

export async function prepareSend(input: { phone: string; now: number; phoneSends: SendStamp[]; ipSends: SendStamp[] }) {
  const phone = normalizePhone(input.phone);
  if (!phone) return { ok: false as const, error: "Revisa el celular." };
  const gate = canSendPair(input.phoneSends, input.ipSends, input.now);
  if (!gate.ok) return { ok: false as const, error: "Espera un momento antes de pedir otro código.", retryAt: gate.retryAt };
  const code = generateCode();
  const salt = randomSalt();
  const record: OtpRecord = { phone, codeHash: await hashCode(code, salt), salt, expiresAt: input.now + OTP_TTL_MS, attempts: 0 };
  return { ok: true as const, code, record };
}

export function publicSendResult(prepared: Awaited<ReturnType<typeof prepareSend>>, demo: boolean) {
  if (!prepared.ok) return { ok: false as const, error: prepared.error, retryAt: "retryAt" in prepared ? prepared.retryAt : undefined };
  if (demo) {
    return { ok: true as const, demo: true, demoCode: prepared.code, message: "Modo demo: este código no se envió por WhatsApp." };
  }
  return { ok: true as const, demo: false, message: "Si el número tiene WhatsApp, te enviamos un código." };
}

export async function checkOtp(record: OtpRecord | null, code: string, now: number) {
  if (!record) return { ok: false as const, reason: "missing" as const, attempts: 0, record };
  if (record.attempts >= OTP_MAX_ATTEMPTS) return { ok: false as const, reason: "attempts" as const, attempts: record.attempts, record };
  if (now > record.expiresAt) return { ok: false as const, reason: "expired" as const, attempts: record.attempts, record };
  const hashed = await hashCode(code.trim(), record.salt);
  if (hashed !== record.codeHash) {
    const attempts = record.attempts + 1;
    const next = { ...record, attempts };
    return { ok: false as const, reason: attempts >= OTP_MAX_ATTEMPTS ? ("attempts" as const) : ("mismatch" as const), attempts, record: next };
  }
  return { ok: true as const, reason: "ok" as const, attempts: record.attempts, record };
}

export function otpFailureMessage(): string {
  return "Código incorrecto o vencido.";
}

export function otpTemplateBody(to: string, code: string, name = process.env.WHATSAPP_OTP_TEMPLATE || OTP_TEMPLATE_NAME, lang = process.env.WHATSAPP_OTP_TEMPLATE_LANG || "es") {
  return {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name,
      language: { code: lang },
      components: [
        { type: "body", parameters: [{ type: "text", text: code }] },
        { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
      ],
    },
  };
}

export async function signSession(phone: string, secret: string, exp: number): Promise<string> {
  const body = b64url(new TextEncoder().encode(JSON.stringify({ phone, exp, purpose: "phone" })));
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, bytesOf(body)));
  return `${body}.${b64url(sig)}`;
}

export async function readSession(token: string, secret: string, now: number): Promise<{ phone: string } | null> {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const key = await hmacKey(secret);
  const valid = await crypto.subtle.verify("HMAC", key, bytesOf(sig, true), bytesOf(body));
  if (!valid) return null;
  const payload = JSON.parse(new TextDecoder().decode(fromB64url(body))) as { phone?: string; exp?: number; purpose?: string };
  if (payload.purpose !== "phone" || !payload.phone || !payload.exp || payload.exp < now) return null;
  return { phone: payload.phone };
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((item) => item.toString(16).padStart(2, "0")).join("");
}

function b64url(bytes: Uint8Array): string {
  let raw = "";
  bytes.forEach((item) => {
    raw += String.fromCharCode(item);
  });
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function bytesOf(value: string, encoded = false): ArrayBuffer {
  const bytes = encoded ? fromB64url(value) : new TextEncoder().encode(value);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function fromB64url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const raw = atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}
