import { pool } from "../db/db.js";
import {
    createAssistantSession,
    getSessionByIdOrToken,
    addMessageToSession,
    getSessionMessages,
    getChannelContext
} from "../services/assistantService.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { decryptSecret } from "../utils/cryptoKey.js";

const ASSISTANT_SYSTEM_PROMPT = `
You are an AI assistant for a specific channel. Your goal is to help users navigate the site, answer questions about the product, and summarize common problems based on the context provided.
Do not invent information. If you do not know the answer based on the context, politely say so.
Limit responses to be concise and helpful.
`;

async function getChannelAiKey(channelId) {
    const res = await pool.query(
        `SELECT u.gemini_api_key_enc FROM clair_users u JOIN clair_channels c ON c.uid = u.id WHERE c.id = $1`,
        [channelId]
    );
    if (res.rowCount === 0 || !res.rows[0].gemini_api_key_enc) return process.env.GEMINI_API_KEY;
    return decryptSecret(res.rows[0].gemini_api_key_enc);
}

export async function startSession(req, res) {
    try {
        const channelId = req.channel.id;
        const session = await createAssistantSession(channelId);
        res.json({ ok: true, session_token: session.session_token });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

export async function chatWithAssistant(req, res) {
    try {
        const channelId = req.channel.id;
        const { session_token, message } = req.body;

        if (!session_token || !message) {
            return res.status(400).json({ error: "session_token and message are required" });
        }

        const session = await getSessionByIdOrToken(session_token, true);
        if (!session || session.channel_id !== channelId) {
            return res.status(404).json({ error: "Session not found or invalid" });
        }

        await addMessageToSession(session.id, 'user', message);

        const context = await getChannelContext(channelId);
        const history = await getSessionMessages(session.id, 10);

        let promptText = `${ASSISTANT_SYSTEM_PROMPT}\n\n${context}\n\nChat History:\n`;
        history.forEach(msg => {
            promptText += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
        });
        promptText += `Assistant: `;

        const aiKey = await getChannelAiKey(channelId);
        const genAI = new GoogleGenerativeAI(aiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const result = await model.generateContent(promptText);
        const aiResponse = result.response.text().trim();

        await addMessageToSession(session.id, 'assistant', aiResponse);

        res.json({ ok: true, response: aiResponse });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
