import { createLocalRepo } from "./repo-local";
import { getSupabase } from "./supabase";

export function createSupabaseRepo() {
  const local = createLocalRepo();
  return {
    ...local,
    mode: (): "local" | "supabase" => "supabase",
    async init() {
      const supabase = getSupabase();
      const { error } = await supabase.from("frames").select("id").limit(1);
      if (error) throw new Error(`Supabase no respondió: ${error.message}. Corre las migraciones del README.`);
      await local.init();
    },
    async adminLogin(email: string, password: string) {
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error || !data.user) return { ok: false as const, error: error?.message ?? "No pudimos entrar." };
      const row = await supabase.from("admin_users").select("user_id").eq("user_id", data.user.id).maybeSingle();
      if (row.error || !row.data) {
        await supabase.auth.signOut();
        return { ok: false as const, error: "Esta cuenta no está en admin_users." };
      }
      return { ok: true as const };
    },
    async adminLogout() {
      await getSupabase().auth.signOut();
    },
    async adminSession() {
      const { data } = await getSupabase().auth.getSession();
      return Boolean(data.session);
    },
  };
}
