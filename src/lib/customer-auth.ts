import { dataMode, siteUrl } from "./env";
import { isEmail } from "./phone";
import { uid } from "./ids";
import { getSupabase } from "./supabase";

export type CustomerSession = { id: string; email: string; accessToken?: string };

const ACCOUNTS = "mifotito-accounts";
const SESSION = "mifotito-customer";

export function passwordError(password: string): string | null {
  if ([...password].length < 8) return "La contraseña necesita al menos 8 caracteres.";
  return null;
}

export function authText(message: string | undefined): string {
  const raw = (message || "").toLowerCase();
  if (raw.includes("invalid login") || raw.includes("invalid credentials")) return "El correo o la contraseña no coinciden.";
  if (raw.includes("already")) return "Ya hay una cuenta con ese correo. Entra o recupera la contraseña.";
  if (raw.includes("not confirmed")) return "Falta confirmar el correo. Revisa tu bandeja y luego entra.";
  return "No pudimos entrar. Revisa el correo y la contraseña.";
}

export async function currentCustomer(): Promise<CustomerSession | null> {
  if (dataMode() === "supabase") {
    const { data } = await getSupabase().auth.getSession();
    const user = data.session?.user;
    if (!user) return null;
    return { id: user.id, email: user.email || "", accessToken: data.session?.access_token };
  }
  return readLocalCustomer();
}

export async function signInCustomer(email: string, password: string): Promise<{ ok: true; session: CustomerSession } | { ok: false; error: string }> {
  const problem = passwordError(password);
  if (problem) return { ok: false, error: problem };
  if (!isEmail(email)) return { ok: false, error: "Ingresa un correo válido." };
  const clean = email.trim().toLowerCase();
  if (dataMode() === "supabase") {
    const { data, error } = await getSupabase().auth.signInWithPassword({ email: clean, password });
    if (error || !data.user || !data.session) return { ok: false, error: authText(error?.message) };
    return { ok: true, session: { id: data.user.id, email: data.user.email || clean, accessToken: data.session.access_token } };
  }
  const accounts = readAccounts();
  const found = accounts.find((item) => item.email === clean && item.password === password);
  if (!found) return { ok: false, error: "El correo o la contraseña no coinciden." };
  const session = { id: found.id, email: found.email };
  writeLocalCustomer(session);
  return { ok: true, session };
}

export async function signUpCustomer(email: string, password: string): Promise<{ ok: true; session: CustomerSession } | { ok: false; error: string; pending?: boolean }> {
  const problem = passwordError(password);
  if (problem) return { ok: false, error: problem };
  if (!isEmail(email)) return { ok: false, error: "Ingresa un correo válido." };
  const clean = email.trim().toLowerCase();
  if (dataMode() === "supabase") {
    const { data, error } = await getSupabase().auth.signUp({
      email: clean,
      password,
      options: { emailRedirectTo: `${siteUrl()}/cuenta` },
    });
    if (error || !data.user) return { ok: false, error: authText(error?.message) };
    if (!data.session) {
      return { ok: false, pending: true, error: "Te enviamos un correo para confirmar tu cuenta. Ábrelo y luego entra." };
    }
    return { ok: true, session: { id: data.user.id, email: data.user.email || clean, accessToken: data.session.access_token } };
  }
  const accounts = readAccounts();
  if (accounts.some((item) => item.email === clean)) return { ok: false, error: "Ya hay una cuenta con ese correo. Entra o recupera la contraseña." };
  const session = { id: uid("cu_"), email: clean };
  accounts.push({ ...session, password });
  writeAccounts(accounts);
  writeLocalCustomer(session);
  return { ok: true, session };
}

export async function sendPasswordReset(email: string): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  if (!isEmail(email)) return { ok: false, error: "Ingresa un correo válido." };
  const clean = email.trim().toLowerCase();
  const message = "Si el correo está registrado, te enviamos un enlace para elegir una contraseña nueva.";
  if (dataMode() === "supabase") {
    const { error } = await getSupabase().auth.resetPasswordForEmail(clean, { redirectTo: `${siteUrl()}/cuenta` });
    if (error) return { ok: false, error: "No pudimos enviar el enlace. Intenta de nuevo en un momento." };
    return { ok: true, message };
  }
  return { ok: true, message };
}

export async function updateCustomerPassword(password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const problem = passwordError(password);
  if (problem) return { ok: false, error: problem };
  if (dataMode() === "supabase") {
    const { error } = await getSupabase().auth.updateUser({ password });
    if (error) return { ok: false, error: "No pudimos guardar la contraseña nueva." };
    return { ok: true };
  }
  const session = readLocalCustomer();
  if (!session) return { ok: false, error: "Entra de nuevo para cambiar la contraseña." };
  const accounts = readAccounts();
  const found = accounts.find((item) => item.id === session.id);
  if (!found) return { ok: false, error: "No encontramos la cuenta." };
  found.password = password;
  writeAccounts(accounts);
  return { ok: true };
}

export async function signOutCustomer(): Promise<void> {
  if (dataMode() === "supabase") await getSupabase().auth.signOut();
  if (typeof localStorage !== "undefined") localStorage.removeItem(SESSION);
}

export function recoveryFromLocation(): boolean {
  if (typeof window === "undefined") return false;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  return hash.get("type") === "recovery" || query.get("type") === "recovery";
}

function readAccounts(): { id: string; email: string; password: string }[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(ACCOUNTS) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAccounts(accounts: { id: string; email: string; password: string }[]) {
  if (typeof localStorage !== "undefined") localStorage.setItem(ACCOUNTS, JSON.stringify(accounts));
}

export function readLocalCustomer(): CustomerSession | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(SESSION) || "null") as CustomerSession | null;
    if (!parsed?.id || !parsed.email) return null;
    return { id: parsed.id, email: parsed.email };
  } catch {
    return null;
  }
}

function writeLocalCustomer(session: CustomerSession) {
  if (typeof localStorage !== "undefined") localStorage.setItem(SESSION, JSON.stringify({ id: session.id, email: session.email }));
}
