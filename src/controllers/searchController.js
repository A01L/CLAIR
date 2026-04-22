import { pool } from "../db/db.js";
import { searchAppeals } from "../search/elastic.js";

export async function searchAppealsController(req, res) {
  try {
    const channelId = Number(req.query.channel_id);
    const query = req.query.q;
    const type = req.query.type;
    const status = req.query.status;
    const userId = Number(req.user?.id);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!channelId) {
      return res.status(400).json({ error: "channel_id is required" });
    }

    // Verify ownership of the channel to prevent IDOR
    const accessCheck = await pool.query(
        `SELECT id FROM clair_channels WHERE id = $1 AND uid = $2`,
        [channelId, userId]
    );

    if (accessCheck.rowCount === 0) {
        return res.status(403).json({ error: "Forbidden: You do not have access to this channel." });
    }

    const results = await searchAppeals(channelId, query, { type, status });
    res.json({ ok: true, data: results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
