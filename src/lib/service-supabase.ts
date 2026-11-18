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

export function whatsAppConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}
