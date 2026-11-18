const KEY = "mifotito-phone-session";

export type PhoneSession = { token: string; phone: string; exp: number };

export function savePhoneSession(session: PhoneSession): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(KEY, JSON.stringify(session));
}

export function readPhoneSession(): PhoneSession | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PhoneSession;
    if (!parsed.token || !parsed.phone || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPhoneSession(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(KEY);
}
