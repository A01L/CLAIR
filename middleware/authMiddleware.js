import jwt from "jsonwebtoken";
import { pool } from "../db.js";

export async function authRequired(req, res, next) {
  try {
    // 1) Bearer
    const h = req.headers.authorization || "";
    let token = h.startsWith("Bearer ") ? h.slice(7) : null;

    // 2) Cookie (если захочешь)
    if (!token) token = req.cookies?.access_token;

    if (!token) return res.status(401).json({ error: "Missing token" });

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Поддержка и sub, и id (чтобы не было конфликтов после обновления)
    const userId = Number(payload.sub ?? payload.id);
    if (!userId) return res.status(401).json({ error: "Invalid token payload" });

    const r = await pool.query(
      "SELECT id, login FROM clair_users WHERE id=$1",
      [userId]
    );
    if (r.rowCount === 0) return res.status(401).json({ error: "User not found" });

    req.user = r.rows[0];
    next();
  } catch (e) {
    return res.status(401).json({ error: "Unauthorized", details: e.message });
  }
}