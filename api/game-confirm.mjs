import { safeMailError } from "../src/lib/contact.ts";
import { confirmFlow } from "../src/lib/game/flow.ts";
import { createGameStore } from "../src/lib/game/supabase-store.ts";

function page(title, body) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head><body style="margin:0;background:#F6EFE6;color:#241714;font-family:Georgia,serif"><div style="max-width:480px;margin:0 auto;padding:28px 20px"><p style="margin:0 0 12px;font-family:sans-serif;letter-spacing:3px;font-size:12px;color:#8C2429">MI FOTITO</p><h1 style="font-weight:normal;font-size:32px">${title}</h1><p style="font-size:18px;line-height:1.5">${body}</p><p style="font-size:18px"><a href="/juego" style="color:#8C2429">Volver al juego</a></p></div></body></html>`;
}

function sendHtml(res, status, markup) {
  if (typeof res.html === "function") {
    res.status(status).html(markup);
    return;
  }
  res.status(status);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (typeof res.end === "function") res.end(markup);
  else res.send(markup);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    sendHtml(res, 405, page("Santa a la Carrera", "Ese método no está permitido."));
    return;
  }
  const token = String(req.query?.token ?? "");
  const db = createGameStore();
  if (!db) {
    sendHtml(res, 503, page("Santa a la Carrera", "El ranking no está disponible en este momento."));
    return;
  }
  try {
    const result = await confirmFlow(db, token, new Date());
    sendHtml(res, result.ok ? 200 : 400, page("Santa a la Carrera", result.message));
  } catch (error) {
    console.warn("[mifotito] No se pudo confirmar el puntaje.", safeMailError(error));
    sendHtml(res, 503, page("Santa a la Carrera", "No pudimos confirmar el puntaje. Vuelve a abrir el enlace en un momento."));
  }
}
