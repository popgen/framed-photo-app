export function dataMode(): "local" | "supabase" {
  const mode = process.env.EXPO_PUBLIC_DATA_MODE;
  if (mode === "supabase") return "supabase";
  if (mode === "local") return "local";
  if (process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) return "supabase";
  return "local";
}

export function paymentsMode(): "mock" | "live" {
  return process.env.EXPO_PUBLIC_PAYMENTS_MODE === "live" ? "live" : "mock";
}

export function notifyMode(): "mock" | "live" {
  return process.env.EXPO_PUBLIC_NOTIFY_MODE === "live" ? "live" : "mock";
}

export function siteUrl(): string {
  return (process.env.EXPO_PUBLIC_SITE_URL || "https://mifotito.com").replace(/\/$/, "");
}

export function supportNumber(): string {
  return process.env.EXPO_PUBLIC_WHATSAPP_SUPPORT_NUMBER || "51999999999";
}

export function demoAdmin(): { email: string; password: string } | null {
  if (dataMode() === "supabase") return null;
  return {
    email: process.env.EXPO_PUBLIC_DEMO_ADMIN_EMAIL || "admin@mifotito.pe",
    password: process.env.EXPO_PUBLIC_DEMO_ADMIN_PASSWORD || "recuerdo-demo",
  };
}

export type ImportFlags = {
  sandbox: boolean;
  instagram: boolean;
  facebook: boolean;
  googlePhotos: boolean;
};

export function importFlags(): ImportFlags {
  const sandbox = process.env.EXPO_PUBLIC_IMPORT_SANDBOX === "true";
  const metaApp = process.env.EXPO_PUBLIC_META_APP_ID;
  const googleId = process.env.EXPO_PUBLIC_GOOGLE_PHOTOS_CLIENT_ID;
  return {
    sandbox,
    instagram: process.env.EXPO_PUBLIC_ENABLE_INSTAGRAM === "true" && (sandbox || Boolean(metaApp)),
    facebook: process.env.EXPO_PUBLIC_ENABLE_FACEBOOK === "true" && (sandbox || Boolean(metaApp)),
    googlePhotos: process.env.EXPO_PUBLIC_ENABLE_GOOGLE_PHOTOS === "true" && (sandbox || Boolean(googleId)),
  };
}

export type PaymentMethod = "card" | "yape" | "plin";
export type PaymentProviderName = "mock" | "mercadopago" | "plin";

export function providerFor(method: PaymentMethod, mode: "mock" | "live"): PaymentProviderName {
  if (mode === "mock") return "mock";
  if (method === "plin") return "plin";
  return "mercadopago";
}
