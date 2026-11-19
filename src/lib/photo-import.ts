export type ImportProvider = "instagram" | "facebook" | "google";

export const GOOGLE_SCOPE = "https://www.googleapis.com/auth/photospicker.mediaitems.readonly";
export const FACEBOOK_SCOPE = "user_photos";
export const INSTAGRAM_SCOPE = "instagram_business_basic";

const PROVIDERS: ImportProvider[] = ["instagram", "facebook", "google"];

const IMPORT_RETURNS = new Set(["/crear", "/collage", "/muro", "/tarjeta"]);

export function safeImportReturn(value: unknown): string {
  if (typeof value !== "string") return "/crear";
  const path = value.split("?")[0];
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return "/crear";
  return IMPORT_RETURNS.has(path) ? path : "/crear";
}

export function isImportProvider(value: string): value is ImportProvider {
  return PROVIDERS.includes(value as ImportProvider);
}

export function visibleImportSources(flags: { instagram: boolean; facebook: boolean; googlePhotos: boolean }): ImportProvider[] {
  return PROVIDERS.filter((provider) => (provider === "google" ? flags.googlePhotos : flags[provider]));
}

export function authorizeUrl(provider: ImportProvider, input: { clientId: string; redirectUri: string; state: string }): string {
  if (provider === "google") {
    const params = new URLSearchParams({
      client_id: input.clientId,
      redirect_uri: input.redirectUri,
      response_type: "code",
      scope: GOOGLE_SCOPE,
      access_type: "online",
      prompt: "select_account",
      state: input.state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }
  if (provider === "instagram") {
    const params = new URLSearchParams({
      client_id: input.clientId,
      redirect_uri: input.redirectUri,
      response_type: "code",
      scope: INSTAGRAM_SCOPE,
      state: input.state,
    });
    return `https://www.instagram.com/oauth/authorize?${params}`;
  }
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: FACEBOOK_SCOPE,
    state: input.state,
  });
  return `https://www.facebook.com/v21.0/dialog/oauth?${params}`;
}

export type ImportPhoto = { id: string; width: number; height: number; url: string; thumbUrl: string };

export function largestImage(images: { source?: string; width?: number; height?: number }[]): { source: string; width: number; height: number } | null {
  const usable = images.filter((item) => item.source && (item.width || 0) > 0);
  if (!usable.length) return null;
  const best = usable.reduce((left, right) => ((right.width || 0) > (left.width || 0) ? right : left));
  return { source: best.source || "", width: best.width || 0, height: best.height || 0 };
}

export function facebookPhotos(payload: { data?: { id?: string; images?: { source?: string; width?: number; height?: number }[] }[] }): ImportPhoto[] {
  return (payload.data ?? []).flatMap((item) => {
    const images = item.images ?? [];
    const best = largestImage(images);
    const small = [...images].filter((image) => image.source).sort((a, b) => (a.width || 0) - (b.width || 0))[0];
    if (!item.id || !best) return [];
    return [{ id: item.id, width: best.width, height: best.height, url: best.source, thumbUrl: small?.source || best.source }];
  });
}

export function instagramPhotos(payload: { data?: { id?: string; media_type?: string; media_url?: string }[] }): ImportPhoto[] {
  return (payload.data ?? []).flatMap((item) => {
    if (!item.id || !item.media_url || item.media_type === "VIDEO") return [];
    return [{ id: item.id, width: 0, height: 0, url: item.media_url, thumbUrl: item.media_url }];
  });
}

export function googleOriginalUrl(baseUrl: string): string {
  if (/=d($|&)/.test(baseUrl)) return baseUrl;
  return `${baseUrl}=d`;
}

export function googleThumbUrl(baseUrl: string): string {
  return `${baseUrl}=w256-h256`;
}

export function googlePhotos(payload: { mediaItems?: { id?: string; type?: string; mediaFile?: { baseUrl?: string; mimeType?: string } }[] }): ImportPhoto[] {
  return (payload.mediaItems ?? []).flatMap((item) => {
    const base = item.mediaFile?.baseUrl;
    const mime = item.mediaFile?.mimeType || "";
    if (!item.id || !base || item.type === "VIDEO" || mime.startsWith("video/")) return [];
    return [{ id: item.id, width: 0, height: 0, url: googleOriginalUrl(base), thumbUrl: googleThumbUrl(base) }];
  });
}

type Sealed = { exp: number; [key: string]: unknown };

export async function sealImport(data: Record<string, unknown>, secret: string, exp: number): Promise<string> {
  const body = b64url(new TextEncoder().encode(JSON.stringify({ ...data, exp })));
  const sig = await hmacHex(body, secret);
  return `${body}.${sig}`;
}

export async function openImport(token: string, secret: string, now: number): Promise<Sealed | null> {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = await hmacHex(body, secret);
  if (!fixedEqual(expected, sig)) return null;
  let parsed: Sealed;
  try {
    parsed = JSON.parse(new TextDecoder().decode(fromB64url(body))) as Sealed;
  } catch {
    return null;
  }
  if (!parsed.exp || parsed.exp < now) return null;
  return parsed;
}

export function importCookie(token: string, secure: boolean): string {
  return `mifotito-import=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export function readCookie(header: string | undefined, name: string): string {
  const hit = (header || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  if (!hit) return "";
  try {
    return decodeURIComponent(hit.slice(name.length + 1));
  } catch {
    return "";
  }
}

async function hmacHex(body: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  return [...sig].map((item) => item.toString(16).padStart(2, "0")).join("");
}

function fixedEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

function b64url(bytes: Uint8Array): string {
  let raw = "";
  bytes.forEach((item) => {
    raw += String.fromCharCode(item);
  });
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromB64url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const raw = atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}
