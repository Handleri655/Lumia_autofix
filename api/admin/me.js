import { requireAdmin } from "../_lib/auth.js";

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Vain GET sallittu." });
  }
  if (!requireAdmin(req, res)) return;
  return res.status(200).json({ ok: true });
}
