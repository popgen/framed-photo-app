import { safeMailError } from "../src/lib/contact.ts";
import { requireAdmin } from "../src/lib/game/admin-gate.ts";
import { createGameStore } from "../src/lib/game/supabase-store.ts";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Método no permitido." });
    return;
  }
  const header = req.headers?.authorization || req.headers?.Authorization || "";
  const token = String(header).replace(/^Bearer\s+/i, "");
  if (!(await requireAdmin(token))) {
    res.status(401).json({ error: "Esta cuenta no está autorizada como administrador." });
    return;
  }
  const db = createGameStore();
  if (!db) {
    res.status(503).json({ error: "El ranking no está disponible en este momento." });
    return;
  }
  try {
    const rows = await db.adminTop();
    res.status(200).json({ rows });
  } catch (error) {
    console.warn("[mifotito] No se pudo leer el ranking.", safeMailError(error));
    res.status(503).json({ error: "El ranking no está disponible en este momento." });
  }
}
