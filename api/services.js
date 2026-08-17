import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readCatalog() {
  const candidates = [
    path.join(__dirname, "..", "data", "catalog.json"),
    path.join(__dirname, "..", "public", "data", "services.json"),
  ];

  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    if (raw.services) return raw;
    if (Array.isArray(raw)) return { services: raw, offers: [] };
  }

  return { services: [], offers: [] };
}

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Vain GET sallittu." });
  }

  const catalog = readCatalog();
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  res.status(200).json({ services: catalog.services || [] });
}
