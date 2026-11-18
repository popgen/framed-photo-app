const KEY = "recuerdo-wa-boot";

export type Boot = {
  frameId?: string | null;
  photo?: { id: string; width: number; height: number } | null;
  mode?: "single" | "wall" | "set" | null;
  orderId?: string | null;
  pago?: string | null;
};

export function writeBoot(value: Boot) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(KEY, JSON.stringify(value));
}

export function rememberWaOrder(id: string | null) {
  if (typeof sessionStorage === "undefined") return;
  if (!id) sessionStorage.removeItem("recuerdo-wa-order");
  else sessionStorage.setItem("recuerdo-wa-order", id);
}

export function readWaOrder(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage.getItem("recuerdo-wa-order");
}

export function readBoot(): Boot | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  sessionStorage.removeItem(KEY);
  try {
    return JSON.parse(raw) as Boot;
  } catch {
    return null;
  }
}
