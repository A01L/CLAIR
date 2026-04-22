import { pool } from "../db/db.js";
import { moderateCustomPrompt } from "../services/promptModerationService.js";
import { decryptSecret } from "../utils/cryptoKey.js";

async function getUserGeminiKeyOrThrow(userId) {
  const r = await pool.query(
    `SELECT gemini_api_key_enc FROM clair_users WHERE id = $1`,
    [Number(userId)]
  );

  if (r.rowCount === 0) throw new Error("User not found");
  const encKey = r.rows[0].gemini_api_key_enc;
  if (!encKey) throw new Error("Gemini key not configured");

  return decryptSecret(encKey);
}

export async function getCustomPrompt(req, res) {
  try {
    const channelId = Number(req.params.id);
    const uid = Number(req.user?.id);

    const r = await pool.query(
      `SELECT custom_prompt FROM clair_channels WHERE id = $1 AND uid = $2`,
      [channelId, uid]
    );

    if (r.rowCount === 0) {
      return res.status(404).json({ error: "Channel not found or access denied" });
    }

    res.json({ ok: true, custom_prompt: r.rows[0].custom_prompt });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateCustomPrompt(req, res) {
  try {
    const channelId = Number(req.params.id);
    const uid = Number(req.user?.id);
    const { prompt: newPrompt, forceSaveImproved } = req.body;

    if (typeof newPrompt !== 'string' || newPrompt.length > 2000) {
      return res.status(400).json({ error: "Invalid prompt format or length (max 2000 chars)" });
    }

    const channelCheck = await pool.query(
      `SELECT id FROM clair_channels WHERE id = $1 AND uid = $2`,
      [channelId, uid]
    );
    if (channelCheck.rowCount === 0) {
      return res.status(404).json({ error: "Channel not found or access denied" });
    }

    let aiKey;
    try {
        aiKey = await getUserGeminiKeyOrThrow(uid);
    } catch (e) {
        aiKey = process.env.GEMINI_API_KEY;
    }

    const validation = await moderateCustomPrompt(newPrompt, aiKey);

    if (!validation.isValid && !validation.needsImprovement) {
      return res.status(400).json({ ok: false, error: "Prompt rejected", validation });
    }

    if (validation.needsImprovement && !forceSaveImproved) {
      return res.status(400).json({ ok: false, error: "Prompt needs improvement", validation });
    }

    const finalPromptToSave = (validation.needsImprovement && forceSaveImproved) ? validation.improvedPrompt : newPrompt;

    await pool.query(
      `UPDATE clair_channels SET custom_prompt = $1 WHERE id = $2 AND uid = $3`,
      [finalPromptToSave, channelId, uid]
    );

    res.json({ ok: true, message: "Custom prompt updated", savedPrompt: finalPromptToSave });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
