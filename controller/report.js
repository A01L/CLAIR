import { pool } from "../db.js";
import { geminiGenerateJson } from "../services/geminiClient.js";
import { decryptSecret } from "../utils/cryptoKey.js";

async function getUserGeminiKeyOrThrow(userId) {
  const r = await pool.query(
    `
    SELECT gemini_api_key_enc
    FROM clair_users
    WHERE id = $1
    `,
    [Number(userId)]
  );

  if (r.rowCount === 0) throw new Error("User not found");
  const enc = r.rows[0]?.gemini_api_key_enc;
  if (!enc) throw new Error("Gemini API key not set");

  const key = decryptSecret(enc);
  const cleanKey = typeof key === "string" ? key.trim() : "";
  if (!cleanKey) throw new Error("Gemini key is empty after decrypt");

  return cleanKey;
}

export async function getUserChannelsReports(req, res) {
  try {
    const userId = Number(req.user?.id);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const q = `
      SELECT
        c.id,
        c.name,
        c.allowed_domain,
        c.is_active,
        c.processing_status,
        c.processing_pause_reason,
        c.api_key_last4,
        COALESCE(
          json_agg(
            json_build_object(
              'id', a.id,
              'rating', a.rating,
              'emotion', a.emotion,
              'type', a.type,
              'status', a.status,
              'anomaly_type', a.anomaly_type,
              'is_anomaly', a.is_anomaly,
              'spam_score', a.spam_score,
              'ai_comment', a.ai_com,
              'ai_solution', a.ai_solution,
              'text', a.text,
              'created_at', a.created_at
            )
          ) FILTER (WHERE a.id IS NOT NULL),
          '[]'
        ) AS appeals
      FROM clair_channels c
      LEFT JOIN clair_appeal a ON a.cid = c.id
      WHERE c.uid = $1
      GROUP BY c.id
      ORDER BY c.id DESC
    `;

    const r = await pool.query(q, [userId]);

    return res.json({
      ok: true,
      channels: r.rows
    });
  } catch (e) {
    console.error("REPORT ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
}

export async function getAppealsStats(req, res) {
  try {
    const userId = Number(req.user?.id);
    const channelId = req.query.channel_id ? Number(req.query.channel_id) : null;
    const days = req.query.days ? Number(req.query.days) : 30;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const params = [userId, days];
    let channelFilter = "";

    if (channelId) {
      params.push(channelId);
      channelFilter = ` AND c.id = $3 `;
    }

    const totalsQuery = `
      SELECT
        COUNT(a.id)::int AS total_appeals,
        COUNT(*) FILTER (WHERE a.is_anomaly = TRUE)::int AS total_anomaly,
        COUNT(*) FILTER (WHERE a.anomaly_type = 'spam')::int AS total_spam,
        COUNT(*) FILTER (WHERE a.is_anomaly = FALSE OR a.is_anomaly IS NULL)::int AS total_normal,
        ROUND(AVG(a.rating)::numeric, 2) AS avg_rating,
        ROUND(AVG(a.emotion)::numeric, 2) AS avg_emotion,
        ROUND(AVG(a.spam_score)::numeric, 2) AS avg_spam_score
      FROM clair_channels c
      LEFT JOIN clair_appeal a ON a.cid = c.id
      WHERE c.uid = $1
        AND (a.id IS NULL OR a.created_at >= NOW() - ($2::text || ' days')::interval)
        ${channelFilter}
    `;

    const byTypeQuery = `
      SELECT
        COALESCE(a.type, 'unknown') AS label,
        COUNT(*)::int AS value
      FROM clair_appeal a
      INNER JOIN clair_channels c ON c.id = a.cid
      WHERE c.uid = $1
        AND a.created_at >= NOW() - ($2::text || ' days')::interval
        ${channelFilter}
      GROUP BY COALESCE(a.type, 'unknown')
      ORDER BY value DESC, label ASC
    `;

    const byStatusQuery = `
      SELECT
        COALESCE(a.status, 'unknown') AS label,
        COUNT(*)::int AS value
      FROM clair_appeal a
      INNER JOIN clair_channels c ON c.id = a.cid
      WHERE c.uid = $1
        AND a.created_at >= NOW() - ($2::text || ' days')::interval
        ${channelFilter}
      GROUP BY COALESCE(a.status, 'unknown')
      ORDER BY value DESC, label ASC
    `;

    const byAnomalyQuery = `
      SELECT
        COALESCE(a.anomaly_type, 'normal') AS label,
        COUNT(*)::int AS value
      FROM clair_appeal a
      INNER JOIN clair_channels c ON c.id = a.cid
      WHERE c.uid = $1
        AND a.created_at >= NOW() - ($2::text || ' days')::interval
        ${channelFilter}
      GROUP BY COALESCE(a.anomaly_type, 'normal')
      ORDER BY value DESC, label ASC
    `;

    const byDayQuery = `
      SELECT
        TO_CHAR(DATE_TRUNC('day', a.created_at), 'YYYY-MM-DD') AS day,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE a.is_anomaly = TRUE)::int AS anomaly,
        COUNT(*) FILTER (WHERE a.anomaly_type = 'spam')::int AS spam,
        ROUND(AVG(a.rating)::numeric, 2) AS avg_rating,
        ROUND(AVG(a.emotion)::numeric, 2) AS avg_emotion
      FROM clair_appeal a
      INNER JOIN clair_channels c ON c.id = a.cid
      WHERE c.uid = $1
        AND a.created_at >= NOW() - ($2::text || ' days')::interval
        ${channelFilter}
      GROUP BY DATE_TRUNC('day', a.created_at)
      ORDER BY DATE_TRUNC('day', a.created_at) ASC
    `;

    const byChannelQuery = `
      SELECT
        c.id AS channel_id,
        c.name AS channel_name,
        c.processing_status,
        COUNT(a.id)::int AS total,
        COUNT(*) FILTER (WHERE a.is_anomaly = TRUE)::int AS anomaly,
        COUNT(*) FILTER (WHERE a.anomaly_type = 'spam')::int AS spam,
        ROUND(AVG(a.rating)::numeric, 2) AS avg_rating,
        ROUND(AVG(a.emotion)::numeric, 2) AS avg_emotion,
        ROUND(AVG(a.spam_score)::numeric, 2) AS avg_spam_score
      FROM clair_channels c
      LEFT JOIN clair_appeal a
        ON a.cid = c.id
       AND a.created_at >= NOW() - ($2::text || ' days')::interval
      WHERE c.uid = $1
        ${channelId ? "AND c.id = $3" : ""}
      GROUP BY c.id
      ORDER BY total DESC, c.id ASC
    `;

    const recentComplaintsQuery = `
      SELECT
        a.id,
        a.cid AS channel_id,
        c.name AS channel_name,
        a.type,
        a.status,
        a.anomaly_type,
        a.is_anomaly,
        a.spam_score,
        a.ai_com,
        a.ai_solution,
        a.text,
        a.created_at
      FROM clair_appeal a
      INNER JOIN clair_channels c ON c.id = a.cid
      WHERE c.uid = $1
        AND a.created_at >= NOW() - ($2::text || ' days')::interval
        ${channelFilter}
      ORDER BY a.created_at DESC
      LIMIT 100
    `;

    const [totals, byType, byStatus, byAnomaly, byDay, byChannel, recentComplaints] =
      await Promise.all([
        pool.query(totalsQuery, params),
        pool.query(byTypeQuery, params),
        pool.query(byStatusQuery, params),
        pool.query(byAnomalyQuery, params),
        pool.query(byDayQuery, params),
        pool.query(byChannelQuery, params),
        pool.query(recentComplaintsQuery, params)
      ]);

    return res.json({
      ok: true,
      filters: {
        days,
        channel_id: channelId || null
      },
      summary: totals.rows[0] || {
        total_appeals: 0,
        total_anomaly: 0,
        total_spam: 0,
        total_normal: 0,
        avg_rating: null,
        avg_emotion: null,
        avg_spam_score: null
      },
      charts: {
        by_type: byType.rows,
        by_status: byStatus.rows,
        by_anomaly: byAnomaly.rows,
        by_day: byDay.rows,
        by_channel: byChannel.rows
      },
      recent_items: recentComplaints.rows
    });
  } catch (e) {
    console.error("APPEALS STATS ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
}

export async function getAppealsAiSummary(req, res) {
  try {
    const userId = Number(req.user?.id);
    const channelId = req.query.channel_id ? Number(req.query.channel_id) : null;
    const days = req.query.days ? Number(req.query.days) : 30;
    const limit = req.query.limit ? Math.min(Number(req.query.limit), 200) : 50;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const params = [userId, days, limit];
    let channelFilter = "";

    if (channelId) {
      params.push(channelId);
      channelFilter = ` AND c.id = $4 `;
    }

    const q = `
      SELECT
        a.id,
        a.cid AS channel_id,
        c.name AS channel_name,
        a.type,
        a.status,
        a.anomaly_type,
        a.is_anomaly,
        a.ai_com,
        a.ai_solution,
        a.text,
        a.created_at
      FROM clair_appeal a
      INNER JOIN clair_channels c ON c.id = a.cid
      WHERE c.uid = $1
        AND a.created_at >= NOW() - ($2::text || ' days')::interval
        ${channelFilter}
      ORDER BY a.created_at DESC
      LIMIT $3
    `;

    const rows = await pool.query(q, params);

    if (!rows.rowCount) {
      return res.json({
        ok: true,
        summary: "За выбранный период обращений нет.",
        items_count: 0
      });
    }

    const aiKey = await getUserGeminiKeyOrThrow(userId);

    const packed = rows.rows.map((item) => ({
      id: item.id,
      channel_id: item.channel_id,
      channel_name: item.channel_name,
      type: item.type,
      status: item.status,
      anomaly_type: item.anomaly_type,
      is_anomaly: item.is_anomaly,
      ai_comment: item.ai_com,
      ai_solution: item.ai_solution,
      text: item.text,
      created_at: item.created_at
    }));

    const prompt = `
Ты аналитик обращений пользователей.
Сделай короткую, деловую, понятную сводку по обращениям.

Нужно вернуть обычный текст на русском языке.

Что нужно в ответе:
1. Главные темы жалоб.
2. Повторяющиеся проблемы.
3. Есть ли токсичность / спам / аномалии.
4. Что больше всего нужно исправить на сайте или в сервисе.
5. Короткий итог для менеджера в 3-6 пунктах.

Данные:\n${JSON.stringify(packed, null, 2)}
    `.trim();

    const summary = await geminiGenerateJson({ prompt, aiKey });

    return res.json({
      ok: true,
      filters: {
        days,
        channel_id: channelId || null,
        limit
      },
      items_count: packed.length,
      summary
    });
  } catch (e) {
    console.error("AI SUMMARY ERROR:", e);
    return res.status(500).json({ error: e.message });
  }
}

export async function resumeChannelProcessing(req, res) {
  try {
    const userId = Number(req.user?.id);
    const channelId = Number(req.params.channelId);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const r = await pool.query(
      `
      UPDATE clair_channels
      SET processing_status = 'active',
          processing_pause_reason = NULL,
          processing_resumed_at = NOW(),
          updated_at = NOW()
      WHERE id = $1 AND uid = $2
      RETURNING id, name, processing_status, processing_resumed_at
      `,
      [channelId, userId]
    );

    if (r.rowCount === 0) {
      return res.status(404).json({ error: "Channel not found or access denied" });
    }

    return res.json({ ok: true, channel: r.rows[0] });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}