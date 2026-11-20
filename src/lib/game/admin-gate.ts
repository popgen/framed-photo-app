import { createClient } from "@supabase/supabase-js";
import { serviceSupabase } from "../service-supabase";

export async function requireAdmin(token: string): Promise<boolean> {
  const url = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon || !token.trim()) return false;
  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token.trim());
  if (error || !data.user) return false;
  const service = serviceSupabase();
  if (!service) return false;
  const row = await service.from("admin_users").select("user_id").eq("user_id", data.user.id).maybeSingle();
  return row.data?.user_id === data.user.id;
}
