// import { pool } from "../db.js";

// function normalizeOrigin(origin = "") {
//   return String(origin).trim().toLowerCase();
// }

// export async function channelKeyRequired(req, res, next) {
//   try {
//     const apiKey = req.headers["x-channel-key"];
//     const { cid } = req.body;
//     const origin = normalizeOrigin(req.headers.origin || req.headers.referer || "");

//     if (!apiKey || !cid) {
//       return res.status(401).json({ error: "Missing channel key or cid" });
//     }

//     const r = await pool.query(
//       `
//       SELECT id, uid, allowed_domain, is_active
//       FROM clair_channels
//       WHERE id = $1 AND api_key = $2
//       `,
//       [Number(cid), apiKey]
//     );

//     if (r.rowCount === 0) {
//       return res.status(403).json({ error: "Invalid channel key" });
//     }

//     const channel = r.rows[0];

//     if (!channel.is_active) {
//       return res.status(403).json({ error: "Channel is inactive" });
//     }

//     if (channel.allowed_domain) {
//       const allowed = String(channel.allowed_domain).toLowerCase();
//       if (!origin.includes(allowed)) {
//         return res.status(403).json({ error: "Origin is not allowed for this channel" });
//       }
//     }

//     req.channel = {
//       cid: Number(cid),
//       uid: Number(channel.uid)
//     };

//     next();
//   } catch (e) {
//     console.error("channelKeyRequired error:", e);
//     return res.status(500).json({ error: "Internal error" });
//   }
// }

import { pool } from "../db.js";

export async function channelKeyRequired(req, res, next) {
  try {
    const apiKey = req.headers["x-channel-key"];
    const { cid } = req.body;

    if (!apiKey || !cid) {
      return res.status(401).json({ error: "Missing channel key or cid" });
    }

    const r = await pool.query(
      `
      SELECT id, uid, allowed_domain, is_active
      FROM clair_channels
      WHERE id = $1 AND api_key = $2
      `,
      [Number(cid), apiKey]
    );

    if (r.rowCount === 0) {
      return res.status(403).json({ error: "Invalid channel key" });
    }

    const channel = r.rows[0];

    if (!channel.is_active) {
      return res.status(403).json({ error: "Channel is inactive" });
    }

    req.channel = {
      cid: Number(cid),
      uid: Number(channel.uid)
    };

    next();
  } catch (e) {
    console.error("channelKeyRequired error:", e);
    return res.status(500).json({ error: "Internal error" });
  }
} 