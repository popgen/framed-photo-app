export const ADMIN_UNAUTHORIZED = "Esta cuenta no está autorizada como administrador.";

export type AdminGate = { ok: true } | { ok: false; message: string | null };

type SessionUser = { id: string } | null;

type AdminLookup = { data: { user_id?: string | null } | null; error: { message?: string } | null };

export type AdminAuthClient = {
  auth: {
    getSession: () => Promise<{ data: { session: { user: SessionUser } | null } }>;
  };
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<AdminLookup>;
      };
    };
  };
};

/** A Supabase session is not enough: the user must have their own row in admin_users. */
export function decideAdminGate(input: { userId: string | null; isAdmin: boolean; lookupError?: boolean }): AdminGate {
  if (!input.userId) return { ok: false, message: null };
  if (input.lookupError || !input.isAdmin) return { ok: false, message: ADMIN_UNAUTHORIZED };
  return { ok: true };
}

export async function adminSessionFromClient(client: AdminAuthClient): Promise<AdminGate> {
  const { data } = await client.auth.getSession();
  const userId = data.session?.user?.id ?? null;
  if (!userId) return decideAdminGate({ userId: null, isAdmin: false });
  const row = await client.from("admin_users").select("user_id").eq("user_id", userId).maybeSingle();
  return decideAdminGate({
    userId,
    isAdmin: row.data?.user_id === userId,
    lookupError: Boolean(row.error),
  });
}
