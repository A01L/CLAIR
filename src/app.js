import express from "express";
import "dotenv/config";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./docs/swagger.js";

import geminiTranslate from "./routes/aiGeminiTranslateRoutes.js";
import context from "./routes/aiContextGeminiRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import appealRoutes from "./routes/appealRoutes.js";
import channelRoutes from "./routes/channelsRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import userKeysRoutes from "./routes/userKeysRoute.js";
import reportsRouter from "./routes/reportRoute.js";
import assistantRoutes from "./routes/assistantRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";

import { initRabbit, publishToQueue } from "./queue/rabbit.js";
import { pool, checkDb } from "./db/db.js";
import { connectRedis } from "./cache/redis.js";
import { initElastic } from "./search/elastic.js";
import { authRequired } from "./middlewares/authMiddleware.js";

const app = express();
const port = Number(process.env.PORT || 3000);



const redisOk = await connectRedis();

if (redisOk) {
  console.log("✅ Redis connected and ready");
} else {
  console.warn("⚠️ Redis is not connected. Cache will be disabled.");
}

try {
  await initElastic();
  console.log("Elasticsearch initialized");
} catch (e) {
  console.warn("Elasticsearch init warning:", e?.message || e);
}

try {
  await checkDb();
  console.log("Database checked");
} catch (e) {
  console.warn("Database check warning:", e?.message || e);
}

try {
  await initRabbit();
  console.log("RabbitMQ initialized");
} catch (e) {
  console.warn("RabbitMQ init warning:", e?.message || e);
}



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



app.get("/api-docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customSiteTitle: "Clair API Docs"
  })
);


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
  res.json({
    ok: true,
    user: req.user
  });
});

app.get("/ping", (req, res) => {
  res.json({
    ok: true,
    service: "clair_app"
  });
});

app.post("/api/rabbit/test", async (req, res) => {
  try {
    await publishToQueue({
      type: "TEST",
      body: req.body,
      data: {
        cid: Number(req.body?.cid || 0)
      },
      time: Date.now()
    });

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.get("/users", async (req, res) => {
  try {
    const r = await pool.query(
      `
      SELECT
        id,
        login,
        full_name,
        email,
        tg_push
      FROM clair_users
      ORDER BY id
      `
    );

    return res.json(r.rows);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});



app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    method: req.method,
    path: req.originalUrl
  });
});



app.use((err, req, res, next) => {
  console.error("GLOBAL ERROR:", err);

  res.status(err.status || 500).json({
    error: err.message || "Internal server error"
  });
});



app.listen(port, "0.0.0.0", () => {
  console.log(`Server running: http://0.0.0.0:${port}`);
  console.log(`Swagger docs: http://localhost:${port}/api-docs`);
});