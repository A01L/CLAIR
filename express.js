import express from "express";
import "dotenv/config";
import cors from "cors";

import geminiTranslate from "./route/aiGeminiTranslateRoutes.js";
import context from "./route/aiContextGeminiRoutes.js";
import authRoutes from "./route/authRoutes.js";
import appealRoutes from "./route/appealRoutes.js";
import channelRoutes from "./route/channelsRoutes.js";
import profileRoutes from "./route/profileRoutes.js";
import userKeysRoutes from "./route/userKeysRoute.js";
import reportsRouter from "./route/reportRoute.js";
import { initRabbit, publishToQueue } from "./rabbit.js";
import { pool, checkDb } from "./db.js";
import { authRequired } from "./middleware/authMiddleware.js";

const app = express();
const port = 3000;

await checkDb();
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
  "*",
  cors({
    origin: true,
    credentials: true
  })
);

app.use(express.json({ limit: "1mb" }));

app.use("/api/auth", authRoutes);
app.use("/api/context", geminiTranslate);
app.use("/api", context);
app.use("/api/appeals", appealRoutes);
app.use("/api/channels", channelRoutes);
app.use("/api", profileRoutes);
app.use("/api", userKeysRoutes);
app.use("/api", reportsRouter);

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