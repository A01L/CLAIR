import { pool } from "../db.js";
import { SYSTEM_PROMPT } from "../prompts/appealPrompt.js";
import { geminiGenerateJson } from "../services/geminiClient.js";
import { safeJsonParse } from "../utils/safeJsonParse.js";
import { publishToQueue } from "../rabbit.js";
import { decryptSecret } from "../utils/cryptoKey.js";
import { getClientIp, getUserAgent } from "../utils/requestMeta.js";
import { lookupIpMeta } from "../services/ipLookupService.js";
import { saveAppealIpMeta } from "../services/appealIpMetaService.js";
import {
  normalizeAppealText,
  buildTextHash,
  detectSpamByHash
} from "../services/spamService.js";

/* =========================
   HELPERS
========================= */

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

async function increaseSpamScoreForExistingAppeal({
  channelId,
  textHash,
  increment = 1
}) {
  const updated = await pool.query(
    `
    UPDATE clair_appeal
    SET spam_score = COALESCE(spam_score, 0) + $1
    WHERE id = (
      SELECT id
      FROM clair_appeal
      WHERE cid = $2
        AND text_hash = $3
      ORDER BY id DESC
      LIMIT 1
    )
    RETURNING id, cid, text, text_hash, spam_score, created_at
    `,
    [Number(increment), Number(channelId), textHash]
  );

  return updated.rows[0] || null;
}

/* =========================
   JOB — вызывается воркером
========================= */

export async function analyzeAndCreateAppealJob({
  userId,
  cid,
  text,
  clientIp = null,
  userAgent = null
}) {
  const uid = Number(userId);
  const channelId = Number(cid);
  const cleanText = typeof text === "string" ? text.trim() : "";
  const cleanIp = typeof clientIp === "string" ? clientIp.trim() : null;
  const cleanUserAgent =
    typeof userAgent === "string" ? userAgent.trim() : null;

  if (!uid || !channelId || cleanText.length < 2) {
    throw new Error("Invalid job payload (userId/cid/text)");
  }

  const ch = await pool.query(
    `
    SELECT id
    FROM clair_channels
    WHERE id = $1 AND uid = $2
    `,
    [channelId, uid]
  );

  if (ch.rowCount === 0) {
    throw new Error("Channel not found or not yours");
  }

  /* =========================
     DUPLICATE / SPAM CHECK FIRST
  ========================= */

  const normalizedText = normalizeAppealText(cleanText);
  const textHash = buildTextHash(normalizedText);

  const spamInfo = await detectSpamByHash({
    cid: channelId,
    normalizedText,
    textHash,
    ipAddress: cleanIp
  });

  // Если уже есть такой же текст — не вызываем Gemini,
  // не создаём новую запись,
  // а увеличиваем spam_score у последней такой записи.
  if ((spamInfo.duplicateCount || 0) >= 1) {
    const updatedAppeal = await increaseSpamScoreForExistingAppeal({
      channelId,
      textHash,
      increment: 1
    });

    console.log("⛔ Duplicate detected. Skip Gemini and DB insert.", {
      channelId,
      duplicateCount: spamInfo.duplicateCount,
      spamScore: spamInfo.spamScore,
      textHash,
      updatedAppealId: updatedAppeal?.id,
      updatedSpamScore: updatedAppeal?.spam_score
    });

    return {
      ok: true,
      skipped: true,
      reason: "duplicate",
      spam: spamInfo,
      updated_existing_appeal: updatedAppeal
    };
  }

  /* =========================
     GEMINI ONLY FOR UNIQUE TEXT
  ========================= */

  const cleanKey = await getUserGeminiKeyOrThrow(uid);
  const prompt = `${SYSTEM_PROMPT}\n\nВходной текст:\n${cleanText}`;

  let raw = "";
  let data = null;

  try {
    raw = await geminiGenerateJson({
      prompt,
      aiKey: cleanKey
    });

    console.log("\n===== RAW FROM GEMINI =====");
    console.log(raw);
    console.log("===== END RAW =====\n");

    data = safeJsonParse(raw);

    console.log("===== PARSED DATA =====");
    console.log(data);
    console.log("===== END PARSED =====\n");
  } catch (e) {
    console.error("❌ Gemini/parse error:", e?.message || e);
    data = null;
  }

  const appealType = data?.appeal_type ?? data?.type ?? null;
  const status = data?.status ?? "new";

  const emotionRatingNum = Number(data?.emotion_rating);
  const emotion = Number.isFinite(emotionRatingNum) ? emotionRatingNum : null;

  const anomalyType = data?.anomaly_type ?? null;
  const anomalyComment = data?.anomaly_comment ?? data?.anomaly_com ?? null;

  const aiComment =
    data?.ai_comment ??
    data?.ai_com ??
    data?.comment ??
    (raw ? raw.slice(0, 500) : null);

  const aiSolution = data?.ai_solution ?? data?.solution ?? null;

  const isAnomaly =
    typeof data?.is_anomaly === "boolean"
      ? data.is_anomaly
      : Boolean(data?.is_anomaly);

  const ins = await pool.query(
    `
    INSERT INTO clair_appeal
      (
        cid,
        rating,
        emotion,
        type,
        status,
        anomaly_type,
        anomaly_com,
        ai_com,
        text,
        is_anomaly,
        ai_solution,
        text_hash,
        spam_score
      )
    VALUES
      ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *
    `,
    [
      channelId,
      emotion,
      appealType,
      status,
      anomalyType,
      anomalyComment,
      aiComment,
      cleanText,
      Boolean(isAnomaly),
      aiSolution,
      textHash,
      0
    ]
  );

  const appeal = ins.rows[0];

  try {
    if (cleanIp) {
      const ipMeta = await lookupIpMeta(cleanIp);

      const savedMeta = await saveAppealIpMeta({
        appealId: appeal.id,
        ip_address: ipMeta?.ip_address ?? cleanIp,
        country: ipMeta?.country ?? null,
        region: ipMeta?.region ?? null,
        city: ipMeta?.city ?? null,
        provider: ipMeta?.provider ?? null,
        org: ipMeta?.org ?? null,
        user_agent: cleanUserAgent,
        lookup_source: ipMeta?.lookup_source ?? null,
        raw_response: ipMeta?.raw_response ?? null
      });

      console.log("✅ IP meta saved:", savedMeta?.id, savedMeta?.appeal_id);
    } else {
      console.log("ℹ️ No client IP provided, skipping IP meta save");
    }
  } catch (e) {
    console.error("❌ save appeal IP meta error:", e?.message || e);
  }

  return {
    ok: true,
    skipped: false,
    appeal,
    ai: data,
    raw
  };
}

/* =========================
   INTERNAL — JWT
========================= */

export async function analyzeAndCreateAppeal(req, res) {
  try {
    const userId = req.user?.id;
    const { cid, text } = req.body || {};

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!cid || !Number.isInteger(Number(cid))) {
      return res.status(400).json({ error: "cid is required (number)" });
    }

    if (!text || typeof text !== "string" || text.trim().length < 2) {
      return res.status(400).json({ error: "text is required" });
    }

    await publishToQueue({
      type: "APPEAL_ANALYZE",
      data: {
        userId: Number(userId),
        cid: Number(cid),
        text: text.trim()
      },
      createdAt: Date.now()
    });

    return res.status(202).json({
      ok: true,
      queued: true
    });
  } catch (e) {
    console.error("❌ INTERNAL QUEUE ERROR:", e);
    return res.status(500).json({ error: e.message });
  }
}

/* =========================
   EXTERNAL — NO JWT
========================= */

export async function ingestExternalAppeal(req, res) {
  try {
    const { text } = req.body || {};
    const { cid, uid } = req.channel || {};

    if (!cid || !uid) {
      return res.status(401).json({ error: "Channel auth missing" });
    }

    if (!text || typeof text !== "string" || text.trim().length < 2) {
      return res.status(400).json({ error: "text required" });
    }

    const clientIp = getClientIp(req);
    const userAgent = getUserAgent(req);

    console.log("🌍 ingestExternalAppeal clientIp:", clientIp);
    console.log("🧭 ingestExternalAppeal userAgent:", userAgent);

    await publishToQueue({
      type: "APPEAL_ANALYZE",
      data: {
        userId: Number(uid),
        cid: Number(cid),
        text: text.trim(),
        clientIp,
        userAgent
      },
      createdAt: Date.now()
    });

    return res.status(202).json({
      ok: true,
      queued: true
    });
  } catch (e) {
    console.error("❌ EXTERNAL QUEUE ERROR:", e);
    return res.status(500).json({ error: e.message });
  }
}

/* =========================
   DELETE ONE APPEAL
========================= */

export async function deleteAppealById(req, res) {
  try {
    const userId = Number(req.user?.id);
    const appealId = Number(req.params.appealId);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!appealId || !Number.isInteger(appealId)) {
      return res.status(400).json({ error: "appealId must be a number" });
    }

    const found = await pool.query(
      `
      SELECT a.id, a.cid
      FROM clair_appeal a
      INNER JOIN clair_channels c ON c.id = a.cid
      WHERE a.id = $1
        AND c.uid = $2
      `,
      [appealId, userId]
    );

    if (found.rowCount === 0) {
      return res.status(404).json({
        error: "Appeal not found or access denied"
      });
    }

    const del = await pool.query(
      `
      DELETE FROM clair_appeal
      WHERE id = $1
      RETURNING id, cid
      `,
      [appealId]
    );

    return res.json({
      ok: true,
      deleted: del.rows[0]
    });
  } catch (e) {
    console.error("❌ DELETE APPEAL ERROR:", e);
    return res.status(500).json({ error: e.message });
  }
}

/* =========================
   DELETE ALL APPEALS OF CHANNEL
========================= */

export async function deleteAllAppealsByChannel(req, res) {
  try {
    const userId = Number(req.user?.id);
    const channelId = Number(req.params.channelId);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!channelId || !Number.isInteger(channelId)) {
      return res.status(400).json({ error: "channelId must be a number" });
    }

    const ch = await pool.query(
      `
      SELECT id
      FROM clair_channels
      WHERE id = $1 AND uid = $2
      `,
      [channelId, userId]
    );

    if (ch.rowCount === 0) {
      return res.status(404).json({
        error: "Channel not found or access denied"
      });
    }

    const del = await pool.query(
      `
      DELETE FROM clair_appeal
      WHERE cid = $1
      RETURNING id
      `,
      [channelId]
    );

    return res.json({
      ok: true,
      channel_id: channelId,
      deleted_count: del.rowCount,
      deleted_ids: del.rows.map((row) => row.id)
    });
  } catch (e) {
    console.error("❌ DELETE CHANNEL APPEALS ERROR:", e);
    return res.status(500).json({ error: e.message });
  }
}

/* =========================
   HISTORY
========================= */

export async function getAppealsHistory(req, res) {
  try {
    const userId = Number(req.user?.id);
    const channelId = req.query.channel_id ? Number(req.query.channel_id) : null;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const params = [userId];
    let whereChannel = "";

    if (channelId) {
      params.push(channelId);
      whereChannel = ` AND c.id = $2 `;
    }

    const r = await pool.query(
      `
      SELECT
        a.id AS appeal_id,
        a.cid AS channel_id,
        a.text,
        a.text_hash,
        a.spam_score,
        a.status,
        a.type,
        m.ip_address,
        m.country,
        m.region,
        m.city,
        m.provider,
        m.org,
        m.user_agent,
        m.lookup_source
      FROM clair_appeal a
      INNER JOIN clair_channels c ON c.id = a.cid
      LEFT JOIN clair_appeal_ip_meta m ON m.appeal_id = a.id
      WHERE c.uid = $1
      ${whereChannel}
      ORDER BY a.id DESC
      `,
      params
    );

    return res.json({
      ok: true,
      items: r.rows
    });
  } catch (e) {
    console.error("❌ GET APPEALS HISTORY ERROR:", e);
    return res.status(500).json({ error: e.message });
  }
}