import { pool } from "../db/db.js";
import { decryptSecret } from "../utils/cryptoKey.js";
import { geminiGenerateJson } from "../services/geminiClient.js";
import {
  createAssistantSession,
  getSessionByToken,
  updateSessionChannel,
  addMessageToSession,
  getSessionMessages,
  verifyUserChannel,
  getChannelContext,
  getAllChannelsContext
} from "../services/assistantService.js";
import {
  detectAssistantMode,
  buildClairAssistantPrompt
} from "../prompts/clairAssistantPrompt.js";

async function getUserAiKey(userId) {
  const r = await pool.query(
    `
    SELECT gemini_api_key_enc
    FROM clair_users
    WHERE id = $1
    `,
    [Number(userId)]
  );

  if (r.rowCount === 0) {
    return process.env.GEMINI_API_KEY || null;
  }

  const enc = r.rows[0]?.gemini_api_key_enc;

  if (!enc) {
    return process.env.GEMINI_API_KEY || null;
  }

  return decryptSecret(enc);
}

export async function startSession(req, res) {
  try {
    const userId = Number(req.user?.id);
    const channelId = req.body?.cid ? Number(req.body.cid) : null;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (channelId) {
      const channel = await verifyUserChannel({
        userId,
        channelId
      });

      if (!channel) {
        return res.status(404).json({
          error: "Channel not found or access denied"
        });
      }
    }

    const session = await createAssistantSession({
      userId,
      channelId
    });

    return res.json({
      ok: true,
      session_token: session.session_token,
      channel_id: session.channel_id || null
    });
  } catch (error) {
    console.error("START ASSISTANT SESSION ERROR:", error);
    return res.status(500).json({ error: error.message });
  }
}

export async function chatWithAssistant(req, res) {
  try {
    const userId = Number(req.user?.id);
    const {
      session_token,
      message,
      cid = null,
      mode = "auto"
    } = req.body || {};

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!session_token || !message) {
      return res.status(400).json({
        error: "session_token and message are required"
      });
    }

    const cleanMessage = String(message).trim();

    if (!cleanMessage) {
      return res.status(400).json({ error: "message is empty" });
    }

    if (cleanMessage.length > 3000) {
      return res.status(400).json({
        error: "message is too long"
      });
    }

    const session = await getSessionByToken({
      sessionToken: session_token,
      userId
    });

    if (!session) {
      return res.status(404).json({
        error: "Session not found or invalid"
      });
    }

    const requestedChannelId = cid ? Number(cid) : null;
    let activeChannelId = requestedChannelId || session.channel_id || null;

    if (requestedChannelId) {
      const channel = await verifyUserChannel({
        userId,
        channelId: requestedChannelId
      });

      if (!channel) {
        return res.status(404).json({
          error: "Channel not found or access denied"
        });
      }

      await updateSessionChannel({
        sessionId: session.id,
        channelId: requestedChannelId
      });

      activeChannelId = requestedChannelId;
    }

    const detectedMode = detectAssistantMode(
      cleanMessage,
      mode,
      activeChannelId
    );

    await addMessageToSession(session.id, "user", cleanMessage);

    const history = await getSessionMessages(session.id, 10);

    let channelContext = "";
    let allChannelsContext = "";

    if (detectedMode === "channel_analytics") {
      if (!activeChannelId) {
        const answer =
          "Для анализа конкретного канала нужно выбрать канал или передать cid. Также я могу сделать общую сводку по всем каналам.";

        await addMessageToSession(session.id, "assistant", answer);

        return res.json({
          ok: true,
          mode: detectedMode,
          channel_id: null,
          response: answer
        });
      }

      channelContext = await getChannelContext({
        userId,
        channelId: activeChannelId
      });
    }

    if (detectedMode === "all_analytics") {
      allChannelsContext = await getAllChannelsContext({
        userId
      });
    }

    const prompt = buildClairAssistantPrompt({
      mode: detectedMode,
      message: cleanMessage,
      history,
      channelContext,
      allChannelsContext
    });

    const aiKey = await getUserAiKey(userId);

    if (!aiKey) {
      return res.status(400).json({
        error: "Gemini API key is not configured"
      });
    }

    const aiResponse = await geminiGenerateJson({
      prompt,
      aiKey
    });

    const cleanResponse = String(aiResponse || "").trim();

    await addMessageToSession(
      session.id,
      "assistant",
      cleanResponse
    );

    return res.json({
      ok: true,
      mode: detectedMode,
      channel_id: activeChannelId || null,
      response: cleanResponse
    });
  } catch (error) {
    console.error("ASSISTANT CHAT ERROR:", error);
    return res.status(500).json({ error: error.message });
  }
}