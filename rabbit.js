import amqp from "amqplib";

let conn;
let channel;
let initialized = false;

function toSafeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function getRabbitUrl() {
  if (process.env.RABBIT_URL) {
    return process.env.RABBIT_URL;
  }

  const user = process.env.RABBIT_USER || "guest";
  const pass = process.env.RABBIT_PASS || "guest";
  const host = process.env.RABBIT_HOST || "localhost";
  const port = process.env.RABBIT_PORT || "5672";

  return `amqp://${user}:${pass}@${host}:${port}`;
}

export function resolveQueueByChannelId(channelId) {
  const cid = toSafeNumber(channelId, 0);
  return `appeals_channel_${cid}`;
}

export function buildPausedQueueName(channelId) {
  const cid = toSafeNumber(channelId, 0);
  return `appeals_channel_${cid}_paused`;
}

export async function initRabbit() {
  if (initialized && channel) return channel;

  const url = getRabbitUrl();

  conn = await amqp.connect(url);

  conn.on("error", (err) => {
    console.error("Rabbit error:", err);
  });

  conn.on("close", () => {
    console.error("Rabbit connection closed");
    initialized = false;
    channel = null;
  });

  channel = await conn.createChannel();
  await channel.prefetch(Number(process.env.RABBIT_PREFETCH || 5));

  initialized = true;
  return channel;
}

export async function ensureChannelQueues(channelId) {
  const ch = await initRabbit();

  const mainQueue = resolveQueueByChannelId(channelId);
  const pausedQueue = buildPausedQueueName(channelId);

  await ch.assertQueue(mainQueue, { durable: true });
  await ch.assertQueue(pausedQueue, { durable: true });

  return { ch, mainQueue, pausedQueue };
}

export async function publishToQueue(messageObj) {
  const channelId = Number(messageObj?.data?.cid || 0);

  if (!channelId) {
    throw new Error("publishToQueue requires data.cid");
  }

  const { ch, mainQueue } = await ensureChannelQueues(channelId);
  const payload = Buffer.from(JSON.stringify(messageObj));
  const ok = ch.sendToQueue(mainQueue, payload, { persistent: true });

  if (!ok) {
    console.warn("RabbitMQ backpressure on queue:", mainQueue);
  }

  console.log("📨 Published to queue:", mainQueue, "cid:", channelId);
  return { ok, queue: mainQueue };
}

export async function requeueToTail(channelId, msgContent, headers = {}) {
  const { ch, mainQueue } = await ensureChannelQueues(channelId);

  ch.sendToQueue(mainQueue, msgContent, {
    persistent: true,
    headers
  });

  return { queue: mainQueue };
}

export async function moveToPausedQueue(channelId, msgContent, headers = {}) {
  const { ch, pausedQueue } = await ensureChannelQueues(channelId);

  ch.sendToQueue(pausedQueue, msgContent, {
    persistent: true,
    headers
  });

  return { queue: pausedQueue };
}