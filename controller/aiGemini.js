import { pool } from "../db.js";
import { geminiGenerateJson } from "../services/geminiClient.js";

export async function translateText(req, res) {
  try {
    const userId = req.user?.id;
    const { text } = req.body || {};

    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!text) return res.status(400).json({ error: "text required" });

    // берём ключ пользователя
    const u = await pool.query(
      `SELECT gemini_api_key FROM clair_users WHERE id=$1`,
      [userId]
    );

    const aiKey = u.rows[0]?.gemini_api_key;
    if (!aiKey) {
      return res.status(400).json({ error: "Gemini API key not set" });
    }

    const prompt = `Переведи на русский язык. Если текст уже на русском — верни его без изменений.\n\nТекст:\n${text}`;

    const response = await geminiGenerateJson({ prompt, aiKey });

    return res.json({ response });
  } catch (e) {
    console.error("❌ TRANSLATE ERROR:", e);
    res.status(500).json({ error: e.message });
  }
}
