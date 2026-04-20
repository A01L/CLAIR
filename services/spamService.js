import crypto from "crypto";
import { pool } from "../db.js";

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
      isDuplicateSpam: false,
      duplicateCount: 0,
      spamScore: 0,
      spamReasonRule: null
    };
  }

  const dup10m = await pool.query(
    `
    SELECT COUNT(*)::int AS cnt
    FROM clair_appeal
    WHERE cid = $1
      AND text_hash = $2
      AND created_at >= NOW() - INTERVAL '10 minutes'
    `,
    [channelId, textHash]
  );

  const dup24h = await pool.query(
    `
    SELECT COUNT(*)::int AS cnt
    FROM clair_appeal
    WHERE cid = $1
      AND text_hash = $2
      AND created_at >= NOW() - INTERVAL '24 hours'
    `,
    [channelId, textHash]
  );

  let sameIp10m = 0;

  if (ipAddress) {
    const ipQ = await pool.query(
      `
      SELECT COUNT(*)::int AS cnt
      FROM clair_appeal a
      INNER JOIN clair_appeal_ip_meta m ON m.appeal_id = a.id
      WHERE a.cid = $1
        AND a.text_hash = $2
        AND m.ip_address = $3
        AND a.created_at >= NOW() - INTERVAL '10 minutes'
      `,
      [channelId, textHash, ipAddress]
    );
    sameIp10m = Number(ipQ.rows[0]?.cnt || 0);
  }

  const duplicateCount = Number(dup10m.rows[0]?.cnt || 0);
  const duplicateDayCount = Number(dup24h.rows[0]?.cnt || 0);

  let spamScore = 0;
  let spamReasonRule = null;

  if (duplicateCount >= 2) {
    spamScore += 40;
    spamReasonRule = "duplicate_hash_10m";
  }

  if (duplicateCount >= 5) {
    spamScore += 30;
    spamReasonRule = "duplicate_hash_burst_10m";
  }

  if (duplicateDayCount >= 10) {
    spamScore += 20;
    spamReasonRule = "duplicate_hash_24h";
  }

  if (sameIp10m >= 3) {
    spamScore += 30;
    spamReasonRule = "duplicate_hash_same_ip_10m";
  }

  return {
    isDuplicateSpam: spamScore >= 60,
    duplicateCount,
    spamScore,
    spamReasonRule
  };
}