import {
  initRabbit,
  ensureChannelQueues,
  moveToPausedQueue,
  requeueToTail
} from "./rabbit.js";
import { pool } from "./db.js";
import { analyzeAndCreateAppealJob } from "./controller/appeals.js";

function isChannelPaused(status) {
  return String(status || "").toLowerCase() === "paused";
}

async function getAllActiveChannels() {
  const r = await pool.query(
    `
    SELECT id, processing_status, is_active
    FROM clair_channels
    WHERE is_active = TRUE
    ORDER BY id ASC
    `
  );

  return r.rows;
}

async function getChannelState(channelId) {
  const r = await pool.query(
    `
    SELECT id, uid, processing_status, processing_pause_reason, is_active
    FROM clair_channels
    WHERE id = $1
    `,
    [Number(channelId)]
  );

  return r.rows[0] || null;
}

async function pauseChannel(channelId, reason) {
  await pool.query(
    `
    UPDATE clair_channels
    SET processing_status = 'paused',
        processing_pause_reason = $2,
        processing_paused_at = NOW(),
        updated_at = NOW()
    WHERE id = $1
    `,
    [Number(channelId), reason]
  );
}

function isPermanentAiKeyError(message = "") {
  const m = String(message || "").toLowerCase();

  return (
    m.includes("api key") ||
    m.includes("token") ||
    m.includes("permission") ||
    m.includes("unauthorized") ||
    m.includes("forbidden") ||
    m.includes("invalid")
  );
}

async function handleMessage(ch, msg, queueName) {
  if (!msg) return;

  let payload = null;
  let channelId = 0;

  try {
    const raw = msg.content.toString("utf-8");
    payload = JSON.parse(raw);
    channelId = Number(payload?.data?.cid || 0);

    if (!channelId) {
      console.warn("⚠ Message without cid, ack");
      ch.ack(msg);
      return;
    }

    const channelState = await getChannelState(channelId);

    if (!channelState || !channelState.is_active) {
      console.warn("⚠ Inactive or missing channel, ack:", channelId);
      ch.ack(msg);
      return;
    }

    if (isChannelPaused(channelState.processing_status)) {
      await moveToPausedQueue(
        channelId,
        msg.content,
        msg.properties?.headers || {}
      );
      ch.ack(msg);
      console.warn(`⏸ Channel ${channelId} paused, moved to paused queue`);
      return;
    }

    console.log(
      "📥 Worker got message from",
      queueName,
      "type:",
      payload?.type,
      "cid:",
      channelId
    );

    if (payload?.type === "APPEAL_ANALYZE") {
      await analyzeAndCreateAppealJob(payload.data);
    } else {
      console.warn("⚠ Unknown job type:", payload?.type);
    }

    ch.ack(msg);
    console.log(`✅ Message processed and acked. cid=${channelId}`);
  } catch (e) {
    console.error("❌ Worker job error:", e);

    const retries = Number(msg.properties?.headers?.["x-retries"] || 0);
    const maxRetries = Number(process.env.RABBIT_MAX_RETRIES || 3);
    const errorMessage = e?.message || "unknown_error";

    if (channelId && isPermanentAiKeyError(errorMessage)) {
      await pauseChannel(channelId, errorMessage);

      await moveToPausedQueue(channelId, msg.content, {
        ...(msg.properties?.headers || {}),
        "x-paused-reason": errorMessage
      });

      ch.ack(msg);
      console.warn(
        `⏸ Channel ${channelId} paused because of AI key/token error`
      );
      return;
    }

    if (channelId && retries < maxRetries) {
      await requeueToTail(channelId, msg.content, {
        ...(msg.properties?.headers || {}),
        "x-retries": retries + 1
      });

      ch.ack(msg);
      console.warn(`🔁 Retried message ${retries + 1}/${maxRetries}`);
      return;
    }

    console.error("💀 Max retries reached. Message discarded.");
    ch.nack(msg, false, false);
  }
}

const subscribedQueues = new Set();

async function subscribeChannel(ch, channelId) {
  const { mainQueue } = await ensureChannelQueues(channelId);

  if (subscribedQueues.has(mainQueue)) {
    return;
  }

  await ch.consume(mainQueue, async (msg) => {
    await handleMessage(ch, msg, mainQueue);
  });

  subscribedQueues.add(mainQueue);
  console.log("👂 Worker listening:", mainQueue);
}

async function syncChannelSubscriptions(ch) {
  const channels = await getAllActiveChannels();
  console.log("📋 Active channels found:", channels.length);

  for (const item of channels) {
    const channelId = Number(item.id);
    await subscribeChannel(ch, channelId);
  }
}

async function startWorker() {
  console.log("🚀 Worker starting...");

  const dbInfo = await pool.query(
    `SELECT current_database() AS db, current_user AS usr, now() AS now`
  );
  console.log("🗄 DB:", dbInfo.rows[0]);

  const ch = await initRabbit();
  console.log("🐇 Rabbit connected");

  // Ключевой момент: по одному сообщению за раз на consumer
  ch.prefetch(1);
  console.log("⚙ Rabbit prefetch = 1");

  await syncChannelSubscriptions(ch);

  if (subscribedQueues.size === 0) {
    console.warn("⚠ No active channels found.");
  }

  // Периодически подхватываем новые каналы без перезапуска воркера
  setInterval(async () => {
    try {
      await syncChannelSubscriptions(ch);
    } catch (e) {
      console.error("❌ Channel sync error:", e);
    }
  }, 100000);

  console.log("✅ Worker is running");
}

startWorker().catch((e) => {
  console.error("❌ Worker startup failed:", e);
  process.exit(1);
});