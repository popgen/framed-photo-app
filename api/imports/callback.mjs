import { openImport, safeImportReturn } from "../../src/lib/photo-import.ts";
import { clientFor, importSecret, redirectUri, sealSession, sessionCookie, siteOrigin } from "./shared.mjs";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "method" });
    return;
  }
  const origin = siteOrigin(req);
  const state = await openImport(String(req.query?.state || ""), importSecret(), Date.now());
  const next = safeImportReturn(state?.next);
  const fail = () => res.redirect(`${origin}${next}?import=error`);
  if (req.query?.error) {
    fail();
    return;
  }
  const provider = state?.provider;
  const code = String(req.query?.code || "");
  if (!state || (provider !== "instagram" && provider !== "facebook" && provider !== "google") || !code) {
    fail();
    return;
  }
  const client = clientFor(provider);
  try {
    const accessToken = await exchangeCode(provider, code, client, redirectUri(origin));
    const session = { provider, accessToken };
    if (provider === "google") {
      const created = await createGoogleSession(accessToken);
      session.sessionId = created.id;
      session.pickerUri = created.pickerUri;
    }
    const sealed = await sealSession(session);
    res.redirect(`${origin}${next}?import=${provider}`, { "set-cookie": sessionCookie(sealed, origin) });
  } catch (error) {
    console.warn("[mifotito] No se pudo conectar la red de fotos.", error instanceof Error ? error.message : error);
    fail();
  }
}

async function exchangeCode(provider, code, client, redirect) {
  if (provider === "instagram") {
    const body = new URLSearchParams({
      client_id: client.id,
      client_secret: client.secret,
      grant_type: "authorization_code",
      redirect_uri: redirect,
      code,
    });
    const response = await fetch("https://api.instagram.com/oauth/access_token", { method: "POST", body });
    const json = await response.json();
    if (!response.ok || !json.access_token) throw new Error("instagram");
    return json.access_token;
  }
  if (provider === "google") {
    const body = new URLSearchParams({
      client_id: client.id,
      client_secret: client.secret,
      grant_type: "authorization_code",
      redirect_uri: redirect,
      code,
    });
    const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body });
    const json = await response.json();
    if (!response.ok || !json.access_token) throw new Error("google");
    return json.access_token;
  }
  const params = new URLSearchParams({
    client_id: client.id,
    client_secret: client.secret,
    redirect_uri: redirect,
    code,
  });
  const response = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?${params}`);
  const json = await response.json();
  if (!response.ok || !json.access_token) throw new Error("facebook");
  return json.access_token;
}

async function createGoogleSession(accessToken) {
  const response = await fetch("https://photospicker.googleapis.com/v1/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: "{}",
  });
  const json = await response.json();
  if (!response.ok || !json.id || !json.pickerUri) throw new Error("picker");
  return json;
}
