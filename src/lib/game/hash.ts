const PREFIX = "mifotito-game-v1:";

export function normalizeEmail(raw: string): string {
  return raw.normalize("NFKC").trim().toLowerCase();
}

export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashEmail(email: string): Promise<string> {
  return sha256Hex(`${PREFIX}${normalizeEmail(email)}`);
}

export async function newConfirmToken(): Promise<{ raw: string; hash: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const raw = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const hash = await sha256Hex(raw);
  return { raw, hash };
}
