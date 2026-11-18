import { dataMode } from "./env";
import { createLocalRepo } from "./repo-local";
import { createSupabaseRepo } from "./repo-supabase";

export type Repository = ReturnType<typeof createLocalRepo>;

let repo: Repository | null = null;

export function getRepo(): Repository {
  if (!repo) repo = dataMode() === "supabase" ? createSupabaseRepo() : createLocalRepo();
  return repo;
}
