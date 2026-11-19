import type { CheckoutInput } from "./types";

/** Printed gift note price in céntimos. 0 means the note is free. */
export const GIFT_NOTE_CENTS = 0;
export const GIFT_NOTE_MESSAGE_MAX = 250;
export const GIFT_NOTE_NAME_MAX = 60;

export const GIFT_NOTE_SUGGESTIONS = ["¡Feliz Navidad!", "Con mucho cariño", "Feliz cumpleaños"] as const;

export type GiftNote = {
  to: string | null;
  message: string;
  from: string | null;
  hidePrices: boolean;
};

export function giftNoteEnabled(input: Pick<CheckoutInput, "giftPrinted" | "giftNote" | "giftNoteMessage">): boolean {
  if (input.giftPrinted === true) return true;
  if (input.giftPrinted === false) return false;
  return Boolean(String(input.giftNoteMessage || input.giftNote || "").trim());
}

export function giftNoteFromCheckout(input: Pick<CheckoutInput, "giftPrinted" | "giftNote" | "giftNoteTo" | "giftNoteMessage" | "giftNoteFrom" | "hidePrices" | "customerName">): { ok: true; note: GiftNote | null } | { ok: false; error: string } {
  if (!giftNoteEnabled(input)) return { ok: true, note: null };
  const message = normalizeMessage(input.giftNoteMessage ?? input.giftNote);
  if (!message) return { ok: false, error: "Escribe el mensaje de la nota impresa." };
  if (message.length > GIFT_NOTE_MESSAGE_MAX) return { ok: false, error: "La nota impresa admite hasta 250 caracteres." };
  const to = normalizeName(input.giftNoteTo);
  const fromRaw = normalizeName(input.giftNoteFrom);
  if (to.length > GIFT_NOTE_NAME_MAX || fromRaw.length > GIFT_NOTE_NAME_MAX) {
    return { ok: false, error: "Para y De admiten hasta 60 caracteres." };
  }
  const buyer = normalizeName(input.customerName).slice(0, GIFT_NOTE_NAME_MAX);
  return {
    ok: true,
    note: {
      to: to || null,
      message,
      from: fromRaw || buyer || null,
      hidePrices: Boolean(input.hidePrices),
    },
  };
}

export function readStoredGiftNote(row: {
  gift_note?: unknown;
  gift_note_to?: unknown;
  gift_note_message?: unknown;
  gift_note_from?: unknown;
  hide_prices?: unknown;
}): GiftNote | null {
  const columnMessage = normalizeMessage(row.gift_note_message);
  const columnTo = normalizeName(row.gift_note_to);
  const columnFrom = normalizeName(row.gift_note_from);
  if (columnMessage || columnTo || columnFrom) {
    return {
      to: columnTo ? columnTo.slice(0, GIFT_NOTE_NAME_MAX) : null,
      message: columnMessage.slice(0, GIFT_NOTE_MESSAGE_MAX),
      from: columnFrom ? columnFrom.slice(0, GIFT_NOTE_NAME_MAX) : null,
      hidePrices: Boolean(row.hide_prices),
    };
  }
  const raw = typeof row.gift_note === "string" ? row.gift_note.trim() : "";
  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as { to?: unknown; message?: unknown; from?: unknown; hidePrices?: unknown };
      const message = normalizeMessage(parsed.message);
      if (message) {
        const to = normalizeName(parsed.to);
        const from = normalizeName(parsed.from);
        return {
          to: to ? to.slice(0, GIFT_NOTE_NAME_MAX) : null,
          message: message.slice(0, GIFT_NOTE_MESSAGE_MAX),
          from: from ? from.slice(0, GIFT_NOTE_NAME_MAX) : null,
          hidePrices: Boolean(parsed.hidePrices),
        };
      }
    } catch {
      // A plain note that happens to start with a brace falls through.
    }
  }
  const plain = normalizeMessage(raw);
  if (!plain) return null;
  return { to: null, message: plain.slice(0, GIFT_NOTE_MESSAGE_MAX), from: null, hidePrices: false };
}

export function giftNoteJson(note: GiftNote): string {
  return JSON.stringify({ to: note.to, message: note.message, from: note.from, hidePrices: note.hidePrices });
}

export function giftNoteDocument(note: { to?: string | null; message: string; from?: string | null }): string {
  const to = note.to ? `<p class="to">Para ${escapeHtml(note.to)}</p>` : "";
  const from = note.from ? `<p class="from">De ${escapeHtml(note.from)}</p>` : "";
  const message = escapeHtml(note.message).replace(/\n/g, "<br>");
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Nota de regalo</title>
<style>
  @page { size: 105mm 148mm; margin: 0; }
  html, body { margin: 0; background: #efe6dc; color: #241714; }
  .hint { font-family: Georgia, "Iowan Old Style", serif; text-align: center; padding: 12px; font-size: 14px; }
  .sheet {
    width: 105mm; height: 148mm; box-sizing: border-box; margin: 0 auto;
    padding: 12mm; background: #fffdf8; border: 1px dashed #c4ad98;
    display: flex; flex-direction: column; font-family: Georgia, "Iowan Old Style", Palatino, serif;
  }
  .brand { font-family: "Gill Sans", "Trebuchet MS", sans-serif; letter-spacing: 0.22em; font-size: 11px; color: #8c2429; }
  .to { margin: 14mm 0 0; font-size: 16px; }
  .message { margin: 8mm 0; font-size: 22px; line-height: 1.35; flex: 1; }
  .from { margin: 0; text-align: right; font-size: 16px; }
  @media print {
    html, body { background: white; }
    .hint { display: none; }
    .sheet { border: 1px dashed #c4ad98; }
  }
</style>
</head>
<body>
  <p class="hint">Tarjeta A6 (10,5 × 14,8 cm). Corta por la línea punteada.</p>
  <article class="sheet">
    <div class="brand">MI FOTITO</div>
    ${to}
    <p class="message">${message}</p>
    ${from}
  </article>
  <script>window.addEventListener("load", function () { window.print(); });</script>
</body>
</html>`;
}

export function openGiftNotePrint(note: { to?: string | null; message: string; from?: string | null }): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([giftNoteDocument(note)], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), opened ? 60_000 : 0);
}

function normalizeMessage(value: unknown): string {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeName(value: unknown): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    if (char === '"') return "&quot;";
    return "&#39;";
  });
}
