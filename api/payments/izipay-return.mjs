import { confirmIzipay, returnOrigin } from "./izipay-confirm.mjs";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method" });
    return;
  }
  const origin = returnOrigin(req);
  const result = await confirmIzipay(req);
  if (!result.ok) {
    console.warn("[mifotito] Izipay rechazó la vuelta del pago.", result.error);
    res.redirect(`${origin}/pago?error=1`);
    return;
  }
  res.redirect(`${origin}/confirmacion/${result.publicToken}`);
}
