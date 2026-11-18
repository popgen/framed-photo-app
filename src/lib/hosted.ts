import { dataMode } from "./env";

export function hostedWithoutDatabase(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  const hosted = host === "mifotito.com" || host === "www.mifotito.com" || host.endsWith(".netlify.app");
  return hosted && dataMode() !== "supabase";
}
