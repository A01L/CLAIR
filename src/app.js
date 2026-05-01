import express from "express";
import "dotenv/config";
import cors from "cors";

import geminiTranslate from "./routes/aiGeminiTranslateRoutes.js";
import context from "./routes/aiContextGeminiRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import appealRoutes from "./routes/appealRoutes.js";
import channelRoutes from "./routes/channelsRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import userKeysRoutes from "./routes/userKeysRoute.js";
import reportsRouter from "./routes/reportRoute.js";
import assistantRoutes from "./routes/assistantRoutes.js";
import { initRabbit, publishToQueue } from "./queue/rabbit.js";
import { pool, checkDb } from "./db/db.js";
import { connectRedis } from "./cache/redis.js";
import { initElastic } from "./search/elastic.js";
import { authRequired } from "./middlewares/authMiddleware.js";
import searchRoutes from "./routes/searchRoutes.js";
const app = express();
const port = 3000;

try{ await connectRedis(); }catch(e){}
try{ await initElastic(); }catch(e){}
try{ await checkDb(); }catch(e){}
await initRabbit();

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Channel-Key",
      "x-channel-key"
    ]
  })
);

app.options(
  "/*splat",
  cors({
    origin: true,
    credentials: true
  })
);

app.use(express.json({ limit: "1mb" }));
app.use("/api/search", searchRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/context", geminiTranslate);
app.use("/api", context);
app.use("/api/appeals", appealRoutes);
app.use("/api/channels", channelRoutes);
app.use("/api", profileRoutes);
app.use("/api", userKeysRoutes);
app.use("/api", reportsRouter);
app.use("/api/assistant", assistantRoutes);

app.get("/api/me", authRequired, (req, res) => {
  res.json({ ok: true, user: req.user });
});

app.get("/ping", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/rabbit/test", async (req, res) => {
  await publishToQueue({
    type: "TEST",
    body: req.body,
    data: {
      cid: Number(req.body?.cid || 0)
    },
    time: Date.now()
  });
  res.json({ ok: true });
});

app.get("/users", async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT id, login, full_name, email, tg_push FROM clair_users ORDER BY id"
    );
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Server running: http://0.0.0.0:${port}`);
});