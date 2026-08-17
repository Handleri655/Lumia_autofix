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

function blobEnabled() {
  // Private Blob Vercelissä: BLOB_STORE_ID + OIDC (VERCEL_OIDC_TOKEN)
  // Tai vanha tapa: BLOB_READ_WRITE_TOKEN
  return Boolean(
    process.env.BLOB_STORE_ID ||
      process.env.BLOB_READ_WRITE_TOKEN ||
      process.env.VERCEL,
  );
}

function blobOptions(extra = {}) {
  const options = {
    access: "private",
    ...extra,
  };
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    options.token = process.env.BLOB_READ_WRITE_TOKEN;
  }
  if (process.env.BLOB_STORE_ID) {
    options.storeId = process.env.BLOB_STORE_ID;
  }
  return options;
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

async function streamToString(stream) {
  if (!stream) return "";
  if (typeof stream.text === "function") return stream.text();

  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function readBlobCatalog() {
  if (!blobEnabled()) return null;

  try {
    const { get } = await import("@vercel/blob");
    const result = await get(
      BLOB_PATHNAME,
      blobOptions({ useCache: false }),
    );

    if (!result || result.statusCode !== 200) return null;

    const text = await streamToString(result.stream);
    if (!text) return null;
    const raw = JSON.parse(text);
    return {
      services: Array.isArray(raw.services) ? raw.services : [],
      offers: Array.isArray(raw.offers) ? raw.offers : [],
    };
  } catch (err) {
    // Ensimmäisellä kerralla blobia ei vielä ole — se on ok
    console.warn("Blob-luku:", err.message);
    return null;
  }
}

async function writeBlobCatalog(catalog) {
  if (!blobEnabled()) {
    throw new Error(
      "Tallennus Vercelissä vaatii Blob-storen (yhdistä projektiin) tai BLOB_READ_WRITE_TOKEN-muuttujan.",
    );
  }

  const { put } = await import("@vercel/blob");
  await put(
    BLOB_PATHNAME,
    JSON.stringify(catalog, null, 2),
    blobOptions({
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    }),
  );
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

  if (blobEnabled()) {
    await writeBlobCatalog(normalized);
  } else if (process.env.VERCEL) {
    throw new Error(
      "Tallennus Vercelissä vaatii Blob-storen. Yhdistä lumia-autofix-blob projektiin Vercelissä.",
    );
  } else {
    writeLocalCatalog(normalized);
  }

  return normalized;
}

export function activeOffers(catalog) {
  return (catalog.offers || []).filter((offer) => offer.active !== false);
}
