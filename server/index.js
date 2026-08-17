import "dotenv/config";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import express from "express";
import { getDb } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT) || 3001;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "vaihda-tama";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 h
const COOKIE_NAME = "lumia_admin";

const sessions = new Map();
const loginAttempts = new Map();

const app = express();
const db = getDb();

app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

function pruneSessions() {
  const now = Date.now();
  for (const [token, exp] of sessions) {
    if (exp <= now) sessions.delete(token);
  }
}

function getSessionToken(req) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7).trim() || null;
  return null;
}

function requireAuth(req, res, next) {
  pruneSessions();
  const token = getSessionToken(req);
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: "Kirjautuminen vaaditaan." });
  }
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  next();
}

function checkLoginRate(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip) || { count: 0, resetAt: now + 15 * 60 * 1000 };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + 15 * 60 * 1000;
  }
  entry.count += 1;
  loginAttempts.set(ip, entry);
  return entry.count <= 20;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/services", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, name, price_text AS priceText, sort_order AS sortOrder
       FROM services
       ORDER BY sort_order ASC, name ASC`,
    )
    .all();
  res.json({ services: rows });
});

function mapOffer(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    priceText: row.price_text,
    active: Boolean(row.is_active),
    sortOrder: row.sort_order,
  };
}

function listOffers(activeOnly = false) {
  const sql = activeOnly
    ? `SELECT id, title, description, price_text, is_active, sort_order
       FROM offers WHERE is_active = 1
       ORDER BY sort_order ASC, id ASC`
    : `SELECT id, title, description, price_text, is_active, sort_order
       FROM offers
       ORDER BY sort_order ASC, id ASC`;
  return db.prepare(sql).all().map(mapOffer);
}

app.get("/api/offers", (_req, res) => {
  res.json({ offers: listOffers(true) });
});

app.get("/api/admin/offers", requireAuth, (_req, res) => {
  res.json({ offers: listOffers(false) });
});

app.put("/api/admin/offers", requireAuth, (req, res) => {
  const items = req.body?.offers;
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: "Tarjouslista puuttuu." });
  }

  const insert = db.prepare(`
    INSERT INTO offers (title, description, price_text, is_active, sort_order, updated_at)
    VALUES (@title, @description, @price_text, @is_active, @sort_order, datetime('now'))
  `);
  const update = db.prepare(`
    UPDATE offers
    SET title = @title,
        description = @description,
        price_text = @price_text,
        is_active = @is_active,
        sort_order = @sort_order,
        updated_at = datetime('now')
    WHERE id = @id
  `);
  const remove = db.prepare(`DELETE FROM offers WHERE id = ?`);
  const existingIds = new Set(
    db.prepare("SELECT id FROM offers").all().map((row) => row.id),
  );

  const tx = db.transaction((rows) => {
    const kept = new Set();

    rows.forEach((row, index) => {
      const title = String(row.title ?? "").trim();
      if (!title) throw new Error("Tarjouksella pitää olla otsikko.");
      if (title.length > 120) throw new Error("Otsikko on liian pitkä (max 120).");

      const description = String(row.description ?? "").trim();
      if (description.length > 500) throw new Error("Kuvaus on liian pitkä (max 500).");

      const priceText = String(row.priceText ?? row.price_text ?? "").trim();
      if (priceText.length > 120) throw new Error("Hinta on liian pitkä (max 120).");

      const isActive = row.active === false || row.is_active === 0 || row.is_active === false ? 0 : 1;
      const payload = {
        title,
        description,
        price_text: priceText,
        is_active: isActive,
        sort_order: index + 1,
      };

      const id = Number(row.id);
      if (Number.isInteger(id) && id > 0 && existingIds.has(id)) {
        update.run({ id, ...payload });
        kept.add(id);
      } else {
        const result = insert.run(payload);
        kept.add(Number(result.lastInsertRowid));
      }
    });

    for (const id of existingIds) {
      if (!kept.has(id)) remove.run(id);
    }
  });

  try {
    tx(items);
  } catch (err) {
    return res.status(400).json({ error: err.message || "Tallennus epäonnistui." });
  }

  res.json({ ok: true, offers: listOffers(false) });
});

app.post("/api/admin/login", (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  if (!checkLoginRate(ip)) {
    return res.status(429).json({ error: "Liian monta yritystä. Yritä myöhemmin." });
  }

  const password = String(req.body?.password ?? "");
  if (!password || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Virheellinen salasana." });
  }

  pruneSessions();
  const token = createToken();
  sessions.set(token, Date.now() + SESSION_TTL_MS);

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS,
    path: "/",
  });

  res.json({ ok: true, token });
});

app.post("/api/admin/logout", (req, res) => {
  const token = getSessionToken(req);
  if (token) sessions.delete(token);
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.json({ ok: true });
});

app.get("/api/admin/me", requireAuth, (_req, res) => {
  res.json({ ok: true });
});

app.put("/api/admin/services", requireAuth, (req, res) => {
  const items = req.body?.services;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Palvelulista puuttuu." });
  }

  const update = db.prepare(`
    UPDATE services
    SET price_text = @price_text, updated_at = datetime('now')
    WHERE id = @id
  `);

  const tx = db.transaction((rows) => {
    for (const row of rows) {
      const id = Number(row.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new Error("Virheellinen id.");
      }
      const priceText = String(row.priceText ?? row.price_text ?? "").trim();
      if (priceText.length > 120) {
        throw new Error("Hinta on liian pitkä (max 120 merkkiä).");
      }
      const result = update.run({ id, price_text: priceText });
      if (result.changes === 0) {
        throw new Error(`Palvelua ei löydy: ${id}`);
      }
    }
  });

  try {
    tx(items);
  } catch (err) {
    return res.status(400).json({ error: err.message || "Tallennus epäonnistui." });
  }

  const rows = db
    .prepare(
      `SELECT id, name, price_text AS priceText, sort_order AS sortOrder
       FROM services
       ORDER BY sort_order ASC, name ASC`,
    )
    .all();

  res.json({ ok: true, services: rows });
});

const isProd = process.env.NODE_ENV === "production";

if (isProd) {
  const distDir = path.join(root, "dist");

  app.use(express.static(distDir));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    if (req.path.startsWith("/admin")) {
      return res.sendFile(path.join(distDir, "admin", "index.html"));
    }
    res.sendFile(path.join(distDir, "index.html"));
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Palvelinvirhe." });
});

app.listen(PORT, () => {
  console.log(`API http://127.0.0.1:${PORT}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.warn("Varoitus: ADMIN_PASSWORD ei ole asetettu — käytetään oletusta.");
  }
});
