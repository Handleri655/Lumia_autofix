import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const CATALOG_PATH = path.join(root, "data", "catalog.json");
const BLOB_PATHNAME = "lumia-catalog.json";

function seedCatalog() {
  return { services: [], offers: [] };
}

function readLocalCatalog() {
  try {
    if (!fs.existsSync(CATALOG_PATH)) return seedCatalog();
    const raw = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
    return {
      services: Array.isArray(raw.services) ? raw.services : [],
      offers: Array.isArray(raw.offers) ? raw.offers : [],
    };
  } catch {
    return seedCatalog();
  }
}

function writeLocalCatalog(catalog) {
  fs.mkdirSync(path.dirname(CATALOG_PATH), { recursive: true });
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), "utf8");

  const publicDir = path.join(root, "public", "data");
  fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(
    path.join(publicDir, "services.json"),
    JSON.stringify({ services: catalog.services }, null, 2),
    "utf8",
  );
  fs.writeFileSync(
    path.join(publicDir, "offers.json"),
    JSON.stringify({ offers: catalog.offers.filter((o) => o.active !== false) }, null, 2),
    "utf8",
  );
}

async function readBlobCatalog() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;

  try {
    const { list } = await import("@vercel/blob");
    const result = await list({ prefix: BLOB_PATHNAME, limit: 10, token });
    const blob = result.blobs.find((b) => b.pathname === BLOB_PATHNAME) || result.blobs[0];
    if (!blob?.url) return null;
    const res = await fetch(blob.url, { cache: "no-store" });
    if (!res.ok) return null;
    const raw = await res.json();
    return {
      services: Array.isArray(raw.services) ? raw.services : [],
      offers: Array.isArray(raw.offers) ? raw.offers : [],
    };
  } catch (err) {
    console.warn("Blob-luku epäonnistui:", err.message);
    return null;
  }
}

async function writeBlobCatalog(catalog) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error(
      "Tallennus Vercelissä vaatii BLOB_READ_WRITE_TOKEN-ympäristömuuttujan (Vercel → Storage → Blob).",
    );
  }

  const { put } = await import("@vercel/blob");
  await put(BLOB_PATHNAME, JSON.stringify(catalog, null, 2), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    token,
  });
}

export async function getCatalog() {
  const fromBlob = await readBlobCatalog();
  if (fromBlob) return fromBlob;
  return readLocalCatalog();
}

export async function saveCatalog(catalog) {
  const normalized = {
    services: Array.isArray(catalog.services) ? catalog.services : [],
    offers: Array.isArray(catalog.offers) ? catalog.offers : [],
  };

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    await writeBlobCatalog(normalized);
  } else if (process.env.VERCEL) {
    throw new Error(
      "Tallennus Vercelissä vaatii BLOB_READ_WRITE_TOKEN-ympäristömuuttujan (Vercel → Storage → Blob).",
    );
  } else {
    writeLocalCatalog(normalized);
  }

  return normalized;
}

export function activeOffers(catalog) {
  return (catalog.offers || []).filter((offer) => offer.active !== false);
}
