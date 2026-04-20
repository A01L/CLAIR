import { pool } from "./db.js";
import { initRabbit, ensureChannelQueues } from "./rabbit.js";

async function getActiveChannels() {
  const r = await pool.query(
    `
    SELECT id, processing_status
    FROM clair_channels
    WHERE is_active = TRUE
      AND processing_status = 'active'
    ORDER BY id ASC
    `
  );

  return r.rows;
}

async function moveOneMessageFromPausedToMain(ch, channelId) {
  const { mainQueue, pausedQueue } = await ensureChannelQueues(channelId);

  const msg = await ch.get(pausedQueue, { noAck: false });
  if (!msg) return false;

  ch.sendToQueue(mainQueue, msg.content, {
    persistent: true,
    headers: msg.properties.headers || {}
  });

  ch.ack(msg);

  console.log(`🔄 Moved paused -> main for channel ${channelId}`);
  return true;
}

async function tick() {
  const ch = await initRabbit();
  const channels = await getActiveChannels();

  for (const item of channels) {
    const channelId = Number(item.id);

    let moved = 0;
    const batchSize = Number(process.env.RESUME_BATCH_SIZE || 20);

    for (let i = 0; i < batchSize; i++) {
      const ok = await moveOneMessageFromPausedToMain(ch, channelId);
      if (!ok) break;
      moved += 1;
    }

    if (moved > 0) {
      console.log(`✅ Channel ${channelId}: restored ${moved} messages from paused queue`);
    }
  }
}

async function start() {
  const intervalMs = Number(process.env.RESUME_INTERVAL_MS || 5000);

  console.log(`🚀 resumePausedBacklog started, interval=${intervalMs}ms`);

  await tick();

  setInterval(async () => {
    try {
      await tick();
    } catch (e) {
      console.error("❌ resumePausedBacklog tick error:", e);
    }
  }, intervalMs);
}

start().catch((e) => {
  console.error("❌ resumePausedBacklog startup failed:", e);
  process.exit(1);
});