import {
  updateUserGeminiKey,
  deleteUserGeminiKey
} from "../services/geminiKeyService.js";

export async function setGeminiKey(req, res) {
  try {
    const userId = req.user?.id;
    const { gemini_api_key } = req.body || {};

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await updateUserGeminiKey(userId, gemini_api_key);

    return res.json({
      ok: true,
      action: "saved",
      last4: result.gemini_api_key_last4
    });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}

export async function deleteGeminiKey(req, res) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await deleteUserGeminiKey(userId);

    return res.json({
      ok: true,
      action: "deleted"
    });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}