import { getDb } from "./db.js";
import { SEED_OFFERS, SEED_SERVICES } from "./seed-data.js";

const db = getDb();

const insertService = db.prepare(`
  INSERT INTO services (name, price_text, sort_order, updated_at)
  VALUES (@name, @price_text, @sort_order, datetime('now'))
  ON CONFLICT(name) DO UPDATE SET
    sort_order = excluded.sort_order
`);

const offerCount = db.prepare("SELECT COUNT(*) AS n FROM offers").get().n;

const insertOffer = db.prepare(`
  INSERT INTO offers (title, description, price_text, is_active, sort_order, updated_at)
  VALUES (@title, @description, @price_text, 1, @sort_order, datetime('now'))
`);

const tx = db.transaction(() => {
  SEED_SERVICES.forEach((row, index) => {
    insertService.run({
      name: row.name,
      price_text: row.price_text,
      sort_order: index + 1,
    });
  });

  if (offerCount === 0) {
    SEED_OFFERS.forEach((row, index) => {
      insertOffer.run({
        title: row.title,
        description: row.description,
        price_text: row.price_text,
        sort_order: index + 1,
      });
    });
  }
});

tx();

const services = db.prepare("SELECT COUNT(*) AS n FROM services").get().n;
const offers = db.prepare("SELECT COUNT(*) AS n FROM offers").get().n;
console.log(`Seed OK — ${services} palvelua, ${offers} tarjousta.`);
db.close();
