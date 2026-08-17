import { createSessionToken, getAdminPassword, readJsonBody } from "../_lib/auth.js";

const attempts = new Map();

function allowLogin(ip) {
  const now = Date.now();
  const entry = attempts.get(ip) || { count: 0, resetAt: now + 15 * 60 * 1000 };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + 15 * 60 * 1000;
  }
  entry.count += 1;
  attempts.set(ip, entry);
  return entry.count <= 20;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Vain POST sallittu." });
  }

  try {
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
    if (!allowLogin(ip)) {
      return res.status(429).json({ error: "Liian monta yritystä. Yritä myöhemmin." });
    }

    const body = await readJsonBody(req);
    const password = String(body.password ?? "");
    if (!password || password !== getAdminPassword()) {
      return res.status(401).json({ error: "Virheellinen salasana." });
    }

    const token = createSessionToken();
    return res.status(200).json({ ok: true, token });
  } catch (err) {
    return res.status(400).json({ error: err.message || "Kirjautuminen epäonnistui." });
  }
}
