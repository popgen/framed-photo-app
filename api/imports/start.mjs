import { beginImport, siteOrigin } from "./shared.mjs";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "method" });
    return;
  }
  const started = await beginImport(req);
  if (started.error) {
    const origin = siteOrigin(req);
    res.redirect(`${origin}/crear?import=error`);
    return;
  }
  res.redirect(started.url);
}
