import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SEED_OFFERS, SEED_SERVICES } from "../server/seed-data.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function fromSeed() {
  return {
    services: SEED_SERVICES.map((row, index) => ({
      id: index + 1,
      name: row.name,
      priceText: row.price_text,
      sortOrder: index + 1,
    })),
    offers: SEED_OFFERS.map((row, index) => ({
      id: index + 1,
      title: row.title,
      description: row.description,
      priceText: row.price_text,
      active: true,
      sortOrder: index + 1,
    })),
  };
}

function fromSqlite() {
  try {
    const dbPath = path.join(root, "data", "lumia.db");
    if (!fs.existsSync(dbPath)) return null;

    // Dynamic import so Vercel build can run export from seed without native module
    return import("better-sqlite3").then(({ default: Database }) => {
      const db = new Database(dbPath, { readonly: true });
      const services = db
        .prepare(
          `SELECT id, name, price_text AS priceText, sort_order AS sortOrder
           FROM services ORDER BY sort_order ASC, name ASC`,
        )
        .all();
      const offers = db
        .prepare(
          `SELECT id, title, description, price_text AS priceText, is_active AS active, sort_order AS sortOrder
           FROM offers WHERE is_active = 1
           ORDER BY sort_order ASC, id ASC`,
        )
        .all()
        .map((row) => ({ ...row, active: Boolean(row.active) }));
      db.close();
      return { services, offers };
    });
  } catch {
    return null;
  }
}

async function main() {
  let catalog = fromSeed();
  const sqliteCatalog = await fromSqlite();
  if (sqliteCatalog?.services?.length) {
    catalog = {
      services: sqliteCatalog.services,
      offers: sqliteCatalog.offers || [],
    };
    console.log("Catalog exported from SQLite.");
  } else {
    console.log("Catalog exported from seed data.");
  }

  const publicDir = path.join(root, "public", "data");
  const dataDir = path.join(root, "data");
  fs.mkdirSync(publicDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });

  fs.writeFileSync(
    path.join(publicDir, "services.json"),
    JSON.stringify({ services: catalog.services }, null, 2),
    "utf8",
  );
  fs.writeFileSync(
    path.join(publicDir, "offers.json"),
    JSON.stringify({ offers: catalog.offers }, null, 2),
    "utf8",
  );
  fs.writeFileSync(
    path.join(dataDir, "catalog.json"),
    JSON.stringify(catalog, null, 2),
    "utf8",
  );

  console.log(
    `Wrote ${catalog.services.length} services, ${catalog.offers.length} offers.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
