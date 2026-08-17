import { activeOffers, getCatalog } from "./_lib/catalog.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Vain GET sallittu." });
  }

  const catalog = await getCatalog();
  res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=120");
  res.status(200).json({ services: catalog.services || [] });
}
