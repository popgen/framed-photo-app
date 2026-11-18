import { authorizeUrl, importCookie, isImportProvider, openImport, readCookie, sealImport } from "../../src/lib/photo-import.ts";

export function importSecret() {
  return process.env.OTP_SIGNING_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "mifotito-import";
}

export function siteOrigin(req) {
  const raw = req.headers?.origin || req.headers?.referer || "";
  if (raw) {
    try {
      return new URL(raw).origin;
    } catch {
      /* fall through */
    }
  }
  return (process.env.SITE_URL || process.env.EXPO_PUBLIC_SITE_URL || "https://mifotito.com").replace(/\/$/, "");
}

export function redirectUri(origin) {
  return `${origin}/api/imports/callback`;
}

export function clientFor(provider) {
  if (provider === "google") {
    return {
      id: process.env.GOOGLE_PHOTOS_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_PHOTOS_CLIENT_ID || "",
      secret: process.env.GOOGLE_PHOTOS_CLIENT_SECRET || "",
    };
  }
  return {
    id: process.env.META_APP_ID || process.env.EXPO_PUBLIC_META_APP_ID || "",
    secret: process.env.META_APP_SECRET || "",
  };
}

export async function beginImport(req) {
  const provider = String(req.query?.provider || "");
  if (!isImportProvider(provider)) return { error: "Esa red no está disponible.", status: 400 };
  const client = clientFor(provider);
  if (!client.id || !client.secret) return { error: "Falta la configuración de esa red en el servidor.", status: 400 };
  const origin = siteOrigin(req);
  const state = await sealImport({ provider }, importSecret(), Date.now() + 10 * 60 * 1000);
  return { url: authorizeUrl(provider, { clientId: client.id, redirectUri: redirectUri(origin), state }) };
}

export async function sessionFrom(req) {
  const token = readCookie(req.headers?.cookie, "mifotito-import");
  if (!token) return null;
  const opened = await openImport(token, importSecret(), Date.now());
  if (!opened || !isImportProvider(String(opened.provider || "")) || !opened.accessToken) return null;
  return opened;
}

export function sessionCookie(token, origin) {
  return importCookie(token, origin.startsWith("https://"));
}

export async function sealSession(data) {
  return sealImport(data, importSecret(), Date.now() + 10 * 60 * 1000);
}
