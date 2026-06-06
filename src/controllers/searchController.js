import { pool } from "../db/db.js";
import { searchAppeals } from "../search/elastic.js";

export async function searchAppealsController(req, res) {
  try {
    const channelId = Number(req.query.channel_id);
    const query = String(req.query.q || "").trim();

    const type = req.query.type || null;
    const status = req.query.status || null;
    const anomaly_type = req.query.anomaly_type || null;
    const is_anomaly = req.query.is_anomaly;
    const size = req.query.size || 50;

    const userId = Number(req.user?.id);

    if (!userId) {
      return res.status(401).json({
        ok: false,
        error: "Unauthorized",
      });
    }

    if (!channelId) {
      return res.status(400).json({
        ok: false,
        error: "channel_id is required",
      });
    }

    const accessCheck = await pool.query(
      `
      SELECT id
      FROM clair_channels
      WHERE id = $1 AND uid = $2
      `,
      [channelId, userId]
    );

    if (accessCheck.rowCount === 0) {
      return res.status(403).json({
        ok: false,
        error: "Forbidden: You do not have access to this channel.",
      });
    }

    const results = await searchAppeals(channelId, query, {
      type,
      status,
      anomaly_type,
      is_anomaly,
      size,
    });

    return res.json({
      ok: true,
      count: results.length,
      data: results,
    });
  } catch (error) {
    console.error("Search appeals controller error:", error);

    return res.status(500).json({
      ok: false,
      error: "Internal server error",
      details: error.message,
    });
  }
}