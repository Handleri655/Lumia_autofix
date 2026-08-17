import crypto from "node:crypto";

const SESSION_TTL_SEC = 60 * 60 * 12;

function secret() {
  return process.env.JWT_SECRET || process.env.ADMIN_PASSWORD || "vaihda-tama";
}

function b64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function b64urlJson(value) {
  return b64url(JSON.stringify(value));
}

export function createSessionToken() {
  const header = b64urlJson({ alg: "HS256", typ: "JWT" });
  const payload = b64urlJson({
    role: "admin",
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SEC,
  });
  const data = `${header}.${payload}`;
  const sig = crypto.createHmac("sha256", secret()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [header, payload, sig] = parts;
  const data = `${header}.${payload}`;
  const expected = crypto.createHmac("sha256", secret()).update(data).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

  try {
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!json?.exp || json.exp < Math.floor(Date.now() / 1000)) return false;
    return json.role === "admin";
  } catch {
    return false;
  }
}

export function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== "string") return null;
  if (!header.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

export function requireAdmin(req, res) {
  const token = getBearerToken(req);
  if (!verifySessionToken(token)) {
    res.status(401).json({ error: "Kirjautuminen vaaditaan." });
    return false;
  }
  return true;
}

export function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || "vaihda-tama";
}

export function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === "object") {
      resolve(req.body);
      return;
    }
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error("Liian suuri pyyntö."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Virheellinen JSON."));
      }
    });
    req.on("error", reject);
  });
}
