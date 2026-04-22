import crypto from "crypto";
import { pool } from "../db/db.js";

export function normalizeAppealText(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();
}

export function buildTextHash(normalizedText = "") {
  return crypto
    .createHash("sha256")
    .update(normalizedText)
    .digest("hex");
}

export async function detectSpamByHash({ cid, normalizedText, textHash, ipAddress = null }) {
  const channelId = Number(cid);
  if (!channelId || !normalizedText || !textHash) {
    return {
      existingAppealId: null,
      spamScore: 0
    };
  }

  // Check if an exact match exists for this channel
  const existing = await pool.query(
    `
    SELECT id, spam_score
    FROM clair_appeal
    WHERE cid = $1 AND text_hash = $2
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [channelId, textHash]
  );

  if (existing.rowCount > 0) {
    const appeal = existing.rows[0];
    const newScore = appeal.spam_score + 10;

    // Increment score and return existing id
    await pool.query(
        `UPDATE clair_appeal SET spam_score = $1 WHERE id = $2`,
        [newScore, appeal.id]
    );

    return {
        existingAppealId: appeal.id,
        spamScore: newScore
    };
  }

  return {
    existingAppealId: null,
    spamScore: 0
  };
}
