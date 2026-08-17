import { readJsonBody, requireAdmin } from "../_lib/auth.js";
import { getCatalog, saveCatalog } from "../_lib/catalog.js";

export default async function handler(req, res) {
  if (req.method !== "PUT") {
    res.setHeader("Allow", "PUT");
    return res.status(405).json({ error: "Vain PUT sallittu." });
  }

  if (!requireAdmin(req, res)) return;

  try {
    const body = await readJsonBody(req);
    const items = body.services;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Palvelulista puuttuu." });
    }

    const catalog = await getCatalog();
    const byId = new Map(catalog.services.map((row) => [Number(row.id), row]));

    for (const row of items) {
      const id = Number(row.id);
      if (!Number.isInteger(id) || id <= 0 || !byId.has(id)) {
        throw new Error(`Palvelua ei löydy: ${row.id}`);
      }
      const priceText = String(row.priceText ?? row.price_text ?? "").trim();
      if (priceText.length > 120) {
        throw new Error("Hinta on liian pitkä (max 120 merkkiä).");
      }
      byId.get(id).priceText = priceText;
    }

    catalog.services = [...byId.values()].sort(
      (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.name.localeCompare(b.name, "fi"),
    );

    await saveCatalog(catalog);
    return res.status(200).json({ ok: true, services: catalog.services });
  } catch (err) {
    return res.status(400).json({ error: err.message || "Tallennus epäonnistui." });
  }
}
