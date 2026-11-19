import { paidMessage } from "./templates";
import type { Order } from "./types";

export function paidEmailRequest(
  order: Pick<Order, "number" | "customerName" | "totalCents" | "christmasNote" | "publicToken" | "isGift" | "giftNote" | "giftNoteTo" | "giftNoteMessage" | "giftNoteFrom" | "hidePrices" | "email">,
  env: Record<string, string | undefined>,
): { from: string; to: string; subject: string; text: string } | null {
  const key = env.RESEND_API_KEY;
  const from = env.EMAIL_FROM;
  const to = order.email?.trim();
  if (!key || !from || !to) return null;
  return {
    from,
    to,
    subject: `Pedido ${order.number}`,
    text: paidMessage(order),
  };
}
