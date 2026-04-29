import crypto from "crypto";
import { pool } from "../db/db.js";

function generateSessionToken() {
  return "ast_" + crypto.randomBytes(32).toString("hex");
}

export async function createAssistantSession({ userId, channelId = null }) {
  const token = generateSessionToken();

  const r = await pool.query(
    `
    INSERT INTO clair_assistant_sessions
      (user_id, channel_id, session_token, created_at, updated_at)
    VALUES
      ($1, $2, $3, NOW(), NOW())
    RETURNING id, user_id, channel_id, session_token, created_at, updated_at
    `,
    [
      Number(userId),
      channelId ? Number(channelId) : null,
      token
    ]
  );

  return r.rows[0];
}

export async function getSessionByToken({ sessionToken, userId }) {
  const r = await pool.query(
    `
    SELECT id, user_id, channel_id, session_token, created_at, updated_at
    FROM clair_assistant_sessions
    WHERE session_token = $1
      AND user_id = $2
    `,
    [String(sessionToken), Number(userId)]
  );

  return r.rows[0] || null;
}

export async function updateSessionChannel({ sessionId, channelId }) {
  const r = await pool.query(
    `
    UPDATE clair_assistant_sessions
    SET channel_id = $1,
        updated_at = NOW()
    WHERE id = $2
    RETURNING id, user_id, channel_id, session_token, created_at, updated_at
    `,
    [
      channelId ? Number(channelId) : null,
      Number(sessionId)
    ]
  );

  return r.rows[0] || null;
}

export async function addMessageToSession(sessionId, role, content) {
  const cleanRole = role === "assistant" ? "assistant" : "user";
  const cleanContent = String(content || "").trim();

  if (!cleanContent) return null;

  const r = await pool.query(
    `
    INSERT INTO clair_assistant_messages
      (session_id, role, content, created_at)
    VALUES
      ($1, $2, $3, NOW())
    RETURNING id, session_id, role, content, created_at
    `,
    [
      Number(sessionId),
      cleanRole,
      cleanContent
    ]
  );

  await pool.query(
    `
    UPDATE clair_assistant_sessions
    SET updated_at = NOW()
    WHERE id = $1
    `,
    [Number(sessionId)]
  );

  return r.rows[0];
}

export async function getSessionMessages(sessionId, limit = 10) {
  const r = await pool.query(
    `
    SELECT role, content, created_at
    FROM clair_assistant_messages
    WHERE session_id = $1
    ORDER BY created_at DESC
    LIMIT $2
    `,
    [
      Number(sessionId),
      Math.min(Number(limit) || 10, 30)
    ]
  );

  return r.rows.reverse();
}

export async function verifyUserChannel({ userId, channelId }) {
  if (!channelId) return null;

  const r = await pool.query(
    `
    SELECT id, uid, name, is_active, processing_status
    FROM clair_channels
    WHERE id = $1
      AND uid = $2
    `,
    [
      Number(channelId),
      Number(userId)
    ]
  );

  return r.rows[0] || null;
}

export async function getChannelContext({ userId, channelId }) {
  if (!channelId) return "";

  const channel = await verifyUserChannel({
    userId,
    channelId
  });

  if (!channel) {
    return "Selected channel was not found or does not belong to this user.";
  }

  const summaryQ = await pool.query(
    `
    SELECT
      COUNT(a.id)::int AS total_appeals,
      COUNT(*) FILTER (WHERE a.is_anomaly = TRUE)::int AS anomaly_count,
      COUNT(*) FILTER (WHERE COALESCE(a.spam_score, 0) > 0)::int AS repeated_or_spam_count,
      ROUND(AVG(a.emotion)::numeric, 2) AS avg_emotion
    FROM clair_appeal a
    WHERE a.cid = $1
    `,
    [Number(channelId)]
  );

  const byTypeQ = await pool.query(
    `
    SELECT
      COALESCE(type, 'unknown') AS type,
      COUNT(*)::int AS count
    FROM clair_appeal
    WHERE cid = $1
    GROUP BY COALESCE(type, 'unknown')
    ORDER BY count DESC
    LIMIT 10
    `,
    [Number(channelId)]
  );

  const byStatusQ = await pool.query(
    `
    SELECT
      COALESCE(status, 'unknown') AS status,
      COUNT(*)::int AS count
    FROM clair_appeal
    WHERE cid = $1
    GROUP BY COALESCE(status, 'unknown')
    ORDER BY count DESC
    LIMIT 10
    `,
    [Number(channelId)]
  );

  const topRepeatedQ = await pool.query(
    `
    SELECT text, spam_score, created_at
    FROM clair_appeal
    WHERE cid = $1
      AND COALESCE(spam_score, 0) > 0
    ORDER BY spam_score DESC, created_at DESC
    LIMIT 10
    `,
    [Number(channelId)]
  );

  const recentQ = await pool.query(
    `
    SELECT
      text,
      type,
      status,
      is_anomaly,
      anomaly_type,
      ai_com,
      ai_solution,
      spam_score,
      created_at
    FROM clair_appeal
    WHERE cid = $1
    ORDER BY created_at DESC
    LIMIT 30
    `,
    [Number(channelId)]
  );

  return `
Selected channel:
- id: ${channel.id}
- name: ${channel.name}
- active: ${channel.is_active}
- processing_status: ${channel.processing_status || "unknown"}

Summary:
${JSON.stringify(summaryQ.rows[0] || {}, null, 2)}

Appeals by type:
${JSON.stringify(byTypeQ.rows, null, 2)}

Appeals by status:
${JSON.stringify(byStatusQ.rows, null, 2)}

Top repeated/spam-like appeals:
${JSON.stringify(topRepeatedQ.rows, null, 2)}

Recent appeals:
${JSON.stringify(recentQ.rows, null, 2)}
`.trim();
}

export async function getAllChannelsContext({ userId }) {
  const channelsQ = await pool.query(
    `
    SELECT
      c.id,
      c.name,
      c.is_active,
      c.processing_status,
      COUNT(a.id)::int AS total_appeals,
      COUNT(*) FILTER (WHERE a.is_anomaly = TRUE)::int AS anomaly_count,
      COUNT(*) FILTER (WHERE COALESCE(a.spam_score, 0) > 0)::int AS repeated_or_spam_count,
      ROUND(AVG(a.emotion)::numeric, 2) AS avg_emotion
    FROM clair_channels c
    LEFT JOIN clair_appeal a ON a.cid = c.id
    WHERE c.uid = $1
    GROUP BY c.id
    ORDER BY total_appeals DESC, c.id DESC
    LIMIT 50
    `,
    [Number(userId)]
  );

  const typeQ = await pool.query(
    `
    SELECT
      COALESCE(a.type, 'unknown') AS type,
      COUNT(*)::int AS count
    FROM clair_appeal a
    INNER JOIN clair_channels c ON c.id = a.cid
    WHERE c.uid = $1
    GROUP BY COALESCE(a.type, 'unknown')
    ORDER BY count DESC
    LIMIT 10
    `,
    [Number(userId)]
  );

  const anomalyQ = await pool.query(
    `
    SELECT
      COALESCE(a.anomaly_type, 'normal') AS anomaly_type,
      COUNT(*)::int AS count
    FROM clair_appeal a
    INNER JOIN clair_channels c ON c.id = a.cid
    WHERE c.uid = $1
    GROUP BY COALESCE(a.anomaly_type, 'normal')
    ORDER BY count DESC
    LIMIT 10
    `,
    [Number(userId)]
  );

  const topRepeatedQ = await pool.query(
    `
    SELECT
      c.name AS channel_name,
      a.text,
      a.spam_score,
      a.created_at
    FROM clair_appeal a
    INNER JOIN clair_channels c ON c.id = a.cid
    WHERE c.uid = $1
      AND COALESCE(a.spam_score, 0) > 0
    ORDER BY a.spam_score DESC, a.created_at DESC
    LIMIT 20
    `,
    [Number(userId)]
  );

  const recentQ = await pool.query(
    `
    SELECT
      c.name AS channel_name,
      a.text,
      a.type,
      a.status,
      a.is_anomaly,
      a.anomaly_type,
      a.ai_com,
      a.ai_solution,
      a.spam_score,
      a.created_at
    FROM clair_appeal a
    INNER JOIN clair_channels c ON c.id = a.cid
    WHERE c.uid = $1
    ORDER BY a.created_at DESC
    LIMIT 50
    `,
    [Number(userId)]
  );

  return `
All channels summary:
${JSON.stringify(channelsQ.rows, null, 2)}

Appeals by type across all channels:
${JSON.stringify(typeQ.rows, null, 2)}

Anomalies across all channels:
${JSON.stringify(anomalyQ.rows, null, 2)}

Top repeated/spam-like appeals across all channels:
${JSON.stringify(topRepeatedQ.rows, null, 2)}

Recent appeals across all channels:
${JSON.stringify(recentQ.rows, null, 2)}
`.trim();
}