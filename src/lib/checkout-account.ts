import { isEmail } from "./phone";

function passwordProblem(password: string): string | null {
  if ([...password].length < 8) return "La contraseña necesita al menos 8 caracteres.";
  return null;
}

export const EXISTING_ACCOUNT_NOTICE =
  "Este correo ya tiene una cuenta. El pedido quedó registrado. Entra con tu contraseña para seguirlo.";

export const CONFIRM_EMAIL_NOTICE =
  "Te enviamos un correo para confirmar la cuenta. El pedido ya está hecho. Cuando lo confirmes, entra para seguirlo.";

export const ACCOUNT_LATER_NOTICE = "No pudimos crear la cuenta ahora. El pedido sigue. Entra más tarde para seguirlo.";

export type CheckoutAuth = {
  createUser(
    email: string,
    password: string,
  ): Promise<{ status: "created"; userId: string; confirmed: boolean } | { status: "exists" } | { status: "failed" }>;
  signIn(
    email: string,
    password: string,
  ): Promise<{ status: "ok"; userId: string } | { status: "unconfirmed"; userId?: string | null } | { status: "rejected" } | { status: "failed" }>;
  findUserId(email: string): Promise<string | null>;
};

export type LinkedAccount = {
  proceed: true;
  userId: string | null;
  created: boolean;
  signedIn: boolean;
  notice: string | null;
};

export async function linkAccountForPurchase(
  input: { email?: string | null; password?: string | null; sessionUserId?: string | null },
  auth: CheckoutAuth,
): Promise<LinkedAccount | { proceed: false; error: string }> {
  if (input.sessionUserId) {
    return { proceed: true, userId: input.sessionUserId, created: false, signedIn: true, notice: null };
  }
  const email = (input.email || "").trim().toLowerCase();
  if (!isEmail(email)) return { proceed: false, error: "Ingresa un correo válido." };
  const problem = passwordProblem(input.password || "");
  if (problem) return { proceed: false, error: problem };
  const password = input.password || "";
  const created = await auth.createUser(email, password);
  if (created.status === "created") {
    return {
      proceed: true,
      userId: created.userId,
      created: true,
      signedIn: false,
      notice: created.confirmed ? null : CONFIRM_EMAIL_NOTICE,
    };
  }
  if (created.status === "exists") return finishExisting(email, password, auth);
  const found = await auth.findUserId(email);
  if (found) return finishExisting(email, password, auth);
  return { proceed: true, userId: null, created: false, signedIn: false, notice: ACCOUNT_LATER_NOTICE };
}

async function finishExisting(email: string, password: string, auth: CheckoutAuth): Promise<LinkedAccount> {
  const signed = await auth.signIn(email, password);
  if (signed.status === "ok") {
    return { proceed: true, userId: signed.userId, created: false, signedIn: true, notice: null };
  }
  if (signed.status === "unconfirmed") {
    const userId = signed.userId || (await auth.findUserId(email));
    return { proceed: true, userId: userId ?? null, created: false, signedIn: false, notice: CONFIRM_EMAIL_NOTICE };
  }
  const userId = await auth.findUserId(email);
  return { proceed: true, userId, created: false, signedIn: false, notice: EXISTING_ACCOUNT_NOTICE };
}
