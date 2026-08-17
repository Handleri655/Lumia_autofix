import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readOffers() {
  const catalogPath = path.join(__dirname, "..", "data", "catalog.json");
  const offersPath = path.join(__dirname, "..", "public", "data", "offers.json");

  if (fs.existsSync(catalogPath)) {
    const raw = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
    return raw.offers || [];
  }

  if (fs.existsSync(offersPath)) {
    const raw = JSON.parse(fs.readFileSync(offersPath, "utf8"));
    return raw.offers || [];
  }

  return [];
}

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Vain GET sallittu." });
  }

  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  res.status(200).json({ offers: readOffers() });
}
