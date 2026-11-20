import { CONTEST_CLOSE_LABEL, zoneName, type ZoneId } from "./contest";
import { escapeHtml } from "../contact";

export function confirmEmail(input: {
  nickname: string;
  score: number;
  distance: number;
  zone: ZoneId;
  confirmUrl: string;
  inContest: boolean;
}): { subject: string; text: string; html: string } {
  const subject = "Confirma tu puntaje en Santa a la Carrera";
  const contestLine = input.inContest
    ? `Esta partida entra al concurso hasta el ${CONTEST_CLOSE_LABEL}.`
    : "El concurso ya cerró: el puntaje se puede publicar, pero queda fuera de concurso.";
  const text = [
    `Hola ${input.nickname},`,
    "",
    "Recibimos tu puntaje de Santa a la Carrera en Mi Fotito.",
    `Distancia: ${input.distance} m`,
    `Zona: ${zoneName(input.zone)}`,
    `Puntaje: ${input.score}`,
    "",
    "Confirma para que tu apodo aparezca en el ranking. Tu correo no se muestra.",
    input.confirmUrl,
    "",
    contestLine,
    "",
    "Si no jugaste, ignora este mensaje.",
    "",
    "Mi Fotito",
  ].join("\n");
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#F6EFE6;color:#241714;font-family:Georgia,serif">
<div style="max-width:480px;margin:0 auto;padding:28px 20px">
<p style="margin:0 0 12px;font-family:sans-serif;letter-spacing:3px;font-size:12px;color:#8C2429">MI FOTITO</p>
<h1 style="margin:0 0 16px;font-weight:normal;font-size:32px">Santa a la Carrera</h1>
<p style="font-size:18px;line-height:1.5">Hola ${escapeHtml(input.nickname)},</p>
<p style="font-size:18px;line-height:1.5">Recibimos tu puntaje. Confirma para publicarlo en el ranking. Tu correo no se muestra.</p>
<p style="font-size:18px;line-height:1.5">Distancia: <strong>${input.distance} m</strong><br>Zona: <strong>${escapeHtml(zoneName(input.zone))}</strong><br>Puntaje: <strong>${input.score}</strong></p>
<p style="font-size:18px;line-height:1.5"><a href="${escapeHtml(input.confirmUrl)}" style="color:#8C2429">${escapeHtml(input.confirmUrl)}</a></p>
<p style="font-size:18px;line-height:1.5">${escapeHtml(contestLine)}</p>
<p style="font-size:16px;line-height:1.5;color:#6E564C">Si no jugaste, ignora este mensaje.</p>
</div></body></html>`;
  return { subject, text, html };
}

export const MAIL_FAILED = "No pudimos enviar el correo de confirmación. Tu puntaje quedó pendiente: vuelve a intentarlo en un momento.";
export const RATE_LIMITED = "Recibimos varios envíos seguidos. Espera un momento y vuelve a intentar.";
export const SCORE_MISMATCH = "El puntaje no coincide con la partida.";
export const SCORE_KEPT = "Este puntaje no supera el que ya registramos.";
export const SCORE_SENT = "Te enviamos un correo para confirmar tu puntaje. Aparece en el ranking cuando lo confirmes.";
export const OUT_OF_CONTEST = "Esta partida queda fuera de concurso.";
