import bcrypt from "bcryptjs";
import { pool } from "../db.js";

// PATCH /api/profile
// body: { full_name?, email? }
export async function updateProfile(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { full_name, email } = req.body || {};

    const name = typeof full_name === "string" ? full_name.trim() : null;
    const mail = typeof email === "string" ? email.trim().toLowerCase() : null;

    if (name === null && mail === null) {
      return res.status(400).json({ error: "Provide full_name or email" });
    }

    if (name !== null && name.length < 2) {
      return res.status(400).json({ error: "full_name too short" });
    }
    if (mail !== null && !mail.includes("@")) {
      return res.status(400).json({ error: "Invalid email" });
    }

    if (mail) {
      const exists = await pool.query(
        `SELECT 1 FROM clair_users WHERE email=$1 AND id<>$2`,
        [mail, userId]
      );
      if (exists.rowCount > 0) {
        return res.status(409).json({ error: "Email already in use" });
      }
    }

    const r = await pool.query(
      `UPDATE clair_users
       SET full_name = COALESCE($1, full_name),
           email     = COALESCE($2, email)
       WHERE id=$3
       RETURNING id, login, full_name, email, tg_push`,
      [name, mail, userId]
    );

    return res.json({ ok: true, user: r.rows[0] });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

// PATCH /api/profile/password
// body: { current_password, new_password }
export async function changePassword(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { current_password, new_password } = req.body || {};

    if (!current_password || !new_password) {
      return res.status(400).json({ error: "current_password and new_password required" });
    }
    if (typeof new_password !== "string" || new_password.length < 6) {
      return res.status(400).json({ error: "new_password must be at least 6 chars" });
    }

    const r = await pool.query(
      `SELECT password FROM clair_users WHERE id=$1`,
      [userId]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "User not found" });

    const ok = await bcrypt.compare(current_password, r.rows[0].password);
    if (!ok) return res.status(401).json({ error: "Wrong current_password" });

    const hash = await bcrypt.hash(new_password, 10);

    await pool.query(
      `UPDATE clair_users SET password=$1 WHERE id=$2`,
      [hash, userId]
    );

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
