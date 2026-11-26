import { confirmIzipay } from "./izipay-confirm.mjs";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method" });
    return;
  }
  const result = await confirmIzipay(req);
  if (!result.ok && result.status === "bad_signature") {
    const hashKey = req.body?.["kr-hash-key"];
    const fields = req.body && typeof req.body === "object" ? Object.keys(req.body) : [];
    console.warn("[mifotito] Izipay IPN rechazado.", result.error, "kr-hash-key=", hashKey || "(vacío)", "campos=", fields.join(","));
    res.status(400).json({ ok: false });
    return;
  }
  if (!result.ok) console.warn("[mifotito] Izipay IPN sin cobro.", result.error);
  res.status(200).send("OK");
}
