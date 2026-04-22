import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));

let isConnected = false;

export async function connectRedis() {
  if (!isConnected) {
    try {
      await redisClient.connect();
      isConnected = true;
      console.log('✅ Connected to Redis');
    } catch (e) {
      console.error('❌ Failed to connect to Redis', e);
    }
  }
}

export async function getCache(key) {
  if (!isConnected) return null;
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('Redis GET Error:', e);
    return null;
  }
}

export async function setCache(key, value, ttlSeconds = 300) {
  if (!isConnected) return;
  try {
    await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
  } catch (e) {
    console.error('Redis SET Error:', e);
  }
}

export async function deleteCache(key) {
  if (!isConnected) return;
  try {
    await redisClient.del(key);
  } catch (e) {
    console.error('Redis DEL Error:', e);
  }
}

export async function invalidateCachePattern(pattern) {
  if (!isConnected) return;
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  } catch (e) {
     console.error('Redis invalidate pattern error:', e);
  }
}

export default redisClient;
