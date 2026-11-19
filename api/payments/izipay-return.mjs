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
    const code = result.status === "declined" ? "rechazado" : result.status === "bad_signature" ? "firma" : "1";
    res.redirect(`${origin}/pago?error=${code}`);
    return;
  }
  res.redirect(`${origin}${result.redirectPath}`);
}
