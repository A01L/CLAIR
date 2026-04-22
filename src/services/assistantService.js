import { pool } from "../db/db.js";
import crypto from "crypto";

export async function createAssistantSession(channelId) {
  const token = crypto.randomBytes(32).toString('hex');
  const res = await pool.query(
    `INSERT INTO clair_assistant_sessions (channel_id, session_token) VALUES ($1, $2) RETURNING id, session_token`,
    [channelId, token]
  );
  return res.rows[0];
}

export async function getSessionByIdOrToken(identifier, byToken = false) {
  const field = byToken ? 'session_token' : 'id';
  const res = await pool.query(
    `SELECT * FROM clair_assistant_sessions WHERE ${field} = $1`,
    [identifier]
  );
  return res.rows[0] || null;
}

export async function addMessageToSession(sessionId, role, content) {
  await pool.query(
    `INSERT INTO clair_assistant_messages (session_id, role, content) VALUES ($1, $2, $3)`,
    [sessionId, role, content]
  );
  await pool.query(
    `UPDATE clair_assistant_sessions SET last_active_at = NOW() WHERE id = $1`,
    [sessionId]
  );
}

export async function getSessionMessages(sessionId, limit = 50) {
  const res = await pool.query(
    `SELECT role, content, created_at FROM clair_assistant_messages WHERE session_id = $1 ORDER BY id ASC LIMIT $2`,
    [sessionId, limit]
  );
  return res.rows;
}

export async function getChannelContext(channelId) {
    const recent = await pool.query(
        `SELECT type, status, text, ai_solution FROM clair_appeal WHERE cid = $1 ORDER BY id DESC LIMIT 5`,
        [channelId]
    );

    let context = "Recent appeals context:\n";
    recent.rows.forEach((row, i) => {
        context += `${i+1}. Type: ${row.type}, Status: ${row.status}\nText: ${row.text}\nSolution: ${row.ai_solution}\n\n`;
    });
    return context;
}
