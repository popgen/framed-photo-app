import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function serviceSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function signingSecret(): string {
  return process.env.OTP_SIGNING_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "mifotito-demo-otp";
}

const WHATSAPP_ENV = ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_OTP_TEMPLATE", "WHATSAPP_OTP_TEMPLATE_LANG"] as const;

export function missingWhatsAppEnv(): string[] {
  return WHATSAPP_ENV.filter((key) => !process.env[key]);
}

export function whatsAppConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

export function whatsAppOtpReady(): boolean {
  return process.env.WHATSAPP_OTP_ENABLED === "true" && missingWhatsAppEnv().length === 0;
}

export function warnWhatsAppPending(where: string): void {
  const missing = missingWhatsAppEnv();
  if (!missing.length && process.env.WHATSAPP_OTP_ENABLED === "true") return;
  const why = missing.length ? `Faltan ${missing.join(", ")}.` : "WHATSAPP_OTP_ENABLED no está en true.";
  console.warn(`[mifotito] WhatsApp Business pendiente (${where}). ${why} No se llama a la Cloud API.`);
}
