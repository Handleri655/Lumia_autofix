import { readJsonBody, requireAdmin } from "../_lib/auth.js";
import { getCatalog, saveCatalog } from "../_lib/catalog.js";

function normalizeOffers(items) {
  return items.map((row, index) => {
    const title = String(row.title ?? "").trim();
    if (!title) throw new Error("Tarjouksella pitää olla otsikko.");
    if (title.length > 120) throw new Error("Otsikko on liian pitkä (max 120).");

    const description = String(row.description ?? "").trim();
    if (description.length > 500) throw new Error("Kuvaus on liian pitkä (max 500).");

    const priceText = String(row.priceText ?? row.price_text ?? "").trim();
    if (priceText.length > 120) throw new Error("Hinta on liian pitkä (max 120).");

    const id = Number(row.id);
    return {
      id: Number.isInteger(id) && id > 0 ? id : index + 1,
      title,
      description,
      priceText,
      active: !(row.active === false || row.is_active === 0 || row.is_active === false),
      sortOrder: index + 1,
    };
  });
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    if (!requireAdmin(req, res)) return;
    const catalog = await getCatalog();
    return res.status(200).json({ offers: catalog.offers || [] });
  }

  if (req.method === "PUT") {
    if (!requireAdmin(req, res)) return;
    try {
      const body = await readJsonBody(req);
      if (!Array.isArray(body.offers)) {
        return res.status(400).json({ error: "Tarjouslista puuttuu." });
      }
      const catalog = await getCatalog();
      catalog.offers = normalizeOffers(body.offers);
      // Keep stable unique ids
      let nextId = Math.max(0, ...catalog.services.map((s) => Number(s.id) || 0), ...catalog.offers.map((o) => Number(o.id) || 0)) + 1;
      const seen = new Set();
      catalog.offers = catalog.offers.map((offer) => {
        let id = Number(offer.id) || 0;
        if (!id || seen.has(id)) {
          id = nextId++;
        }
        seen.add(id);
        return { ...offer, id };
      });
      await saveCatalog(catalog);
      return res.status(200).json({ ok: true, offers: catalog.offers });
    } catch (err) {
      return res.status(400).json({ error: err.message || "Tallennus epäonnistui." });
    }
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).json({ error: "Method not allowed" });
}
