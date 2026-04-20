import crypto from "crypto";
import { pool } from "../db.js";

function generateApiKey() {
  return "clk_" + crypto.randomBytes(24).toString("hex");
}

function normalizeDomain(domain = "") {
  return String(domain).trim().toLowerCase();
}

export async function createChannel(req, res) {
  try {
    const uid = Number(req.user?.id);
    const name = String(req.body?.name || "").trim();
    const domain = req.body?.allowed_domain ? normalizeDomain(req.body.allowed_domain) : null;

    if (!uid) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!name) {
      return res.status(400).json({ error: "Channel name required" });
    }

    const apiKey = generateApiKey();

    const r = await pool.query(
      `
      INSERT INTO clair_channels (uid, name, api_key, allowed_domain, is_active)
      VALUES ($1, $2, $3, $4, TRUE)
      RETURNING id, uid, name, allowed_domain, is_active, created_at
      `,
      [uid, name, apiKey, domain]
    );

    return res.status(201).json({
      ok: true,
      channel: r.rows[0],
      api_key: apiKey
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export async function getMyChannels(req, res) {
  try {
    const uid = Number(req.user?.id);

    if (!uid) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const r = await pool.query(
      `
      SELECT
        c.id,
        c.uid,
        c.name,
        c.allowed_domain,
        c.is_active,
        c.api_key_last4,
        c.created_at,
        c.updated_at,
        COALESCE(COUNT(a.id), 0)::int AS appeals_count
      FROM clair_channels c
      LEFT JOIN clair_appeal a ON a.cid = c.id
      WHERE c.uid = $1
      GROUP BY c.id
      ORDER BY c.id DESC
      `,
      [uid]
    );

    return res.json({
      ok: true,
      items: r.rows
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export async function getChannelById(req, res) {
  try {
    const uid = Number(req.user?.id);
    const cid = Number(req.params.cid);

    if (!uid) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!cid) {
      return res.status(400).json({ error: "Invalid cid" });
    }

    const r = await pool.query(
      `
      SELECT
        id,
        uid,
        name,
        allowed_domain,
        is_active,
        api_key_last4,
        created_at,
        updated_at
      FROM clair_channels
      WHERE id = $1 AND uid = $2
      `,
      [cid, uid]
    );

    if (r.rowCount === 0) {
      return res.status(404).json({ error: "Channel not found" });
    }

    return res.json({
      ok: true,
      channel: r.rows[0]
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export async function patchChannel(req, res) {
  try {
    const uid = Number(req.user?.id);
    const cid = Number(req.params.cid);

    if (!uid) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!cid) {
      return res.status(400).json({ error: "Invalid cid" });
    }

    const name = typeof req.body?.name === "string" ? req.body.name.trim() : null;
    const allowedDomain = typeof req.body?.allowed_domain === "string"
      ? normalizeDomain(req.body.allowed_domain)
      : null;
    const isActive = typeof req.body?.is_active === "boolean"
      ? req.body.is_active
      : null;

    if (name === null && allowedDomain === null && isActive === null) {
      return res.status(400).json({ error: "Nothing to update" });
    }

    const r = await pool.query(
      `
      UPDATE clair_channels
      SET
        name = COALESCE($1, name),
        allowed_domain = COALESCE($2, allowed_domain),
        is_active = COALESCE($3, is_active),
        updated_at = NOW()
      WHERE id = $4 AND uid = $5
      RETURNING id, uid, name, allowed_domain, is_active, api_key_last4, created_at, updated_at
      `,
      [name, allowedDomain, isActive, cid, uid]
    );

    if (r.rowCount === 0) {
      return res.status(404).json({ error: "Channel not found or access denied" });
    }

    return res.json({
      ok: true,
      channel: r.rows[0]
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export async function rotateChannelApiKey(req, res) {
  try {
    const uid = Number(req.user?.id);
    const cid = Number(req.params.cid);

    if (!uid) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!cid) {
      return res.status(400).json({ error: "Invalid cid" });
    }

    const apiKey = generateApiKey();
    const last4 = apiKey.slice(-4);

    const r = await pool.query(
      `
      UPDATE clair_channels
      SET
        api_key = $1,
        api_key_last4 = $2,
        updated_at = NOW()
      WHERE id = $3 AND uid = $4
      RETURNING id, name, api_key_last4, updated_at
      `,
      [apiKey, last4, cid, uid]
    );

    if (r.rowCount === 0) {
      return res.status(404).json({ error: "Channel not found or access denied" });
    }

    return res.json({
      ok: true,
      channel: r.rows[0],
      api_key: apiKey
    });
  } catch (e) {
    if (e.code === "23505") {
      return res.status(409).json({ error: "api_key already used" });
    }
    return res.status(500).json({ error: e.message });
  }
}

export async function setChannelApiKey(req, res) {
  try {
    const uid = Number(req.user?.id);
    const cid = Number(req.params.cid);
    const key = String(req.body?.api_key || "").trim();

    if (!uid) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!cid) {
      return res.status(400).json({ error: "Invalid cid" });
    }

    if (key.length < 10) {
      return res.status(400).json({ error: "Invalid api_key" });
    }

    const r = await pool.query(
      `
      UPDATE clair_channels
      SET
        api_key = $1,
        api_key_last4 = $2,
        updated_at = NOW()
      WHERE id = $3 AND uid = $4
      RETURNING id, name, api_key_last4, updated_at
      `,
      [key, key.slice(-4), cid, uid]
    );

    if (r.rowCount === 0) {
      return res.status(404).json({ error: "Channel not found or access denied" });
    }

    return res.json({
      ok: true,
      channel: r.rows[0]
    });
  } catch (e) {
    if (e.code === "23505") {
      return res.status(409).json({ error: "api_key already used" });
    }
    return res.status(500).json({ error: e.message });
  }
}

export async function deleteChannel(req, res) {
  try {
    const uid = Number(req.user?.id);
    const cid = Number(req.params.cid);

    if (!uid) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!cid) {
      return res.status(400).json({ error: "Invalid cid" });
    }

    const r = await pool.query(
      `
      DELETE FROM clair_channels
      WHERE id = $1 AND uid = $2
      RETURNING id, name
      `,
      [cid, uid]
    );

    if (r.rowCount === 0) {
      return res.status(404).json({ error: "Channel not found or access denied" });
    }

    return res.json({
      ok: true,
      deleted: r.rows[0]
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}