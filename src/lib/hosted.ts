import { dataMode } from "./env";

export function shouldWarnLocalMode(host: string, mode: "local" | "supabase"): boolean {
  const hosted = host === "mifotito.com" || host === "www.mifotito.com" || host.endsWith(".netlify.app");
  return hosted && mode !== "supabase";
}

export function hostedWithoutDatabase(): boolean {
  if (typeof window === "undefined") return false;
  return shouldWarnLocalMode(window.location.hostname, dataMode());
}
