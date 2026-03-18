const redis = require("redis");
require("dotenv").config();

const url = process.env.REDIS_URL;
const logger = console;

const client = redis.createClient({
  url: url,
});

client.on("connect", () => {
  console.log("Connected to Redis server");
});

client.on("error", (err) => {
  console.error("Error connecting to Redis server", { error: err.message });
});

(async () => {
  try {
    await client.connect();
  } catch (err) {
    console.error("Error connecting to Redis server", { error: err.message });
  }
})();

// Export the raw client for BullMQ and other direct usage
module.exports = () => {
  const SetRedis = async (key, val, expireTime) => {
    console.log("Redis=> SetRedis");
    if (!client.isOpen) {
      return Promise.reject("Redis client is not connected");
    }

    const newVal = JSON.stringify(val);
    await client.set(key, newVal);

    if (expireTime) {
      await client.expire(key, expireTime);
    }

    return Promise.resolve("Value set in Redis");
  };

  const GetKeys = async (key, isScan = false) => {
    logger.debug("Redis=> GetKeys");
    if (!client.isOpen) {
      throw new Error("Redis client is not connected");
    }

    const exists = await client.exists(key);
    return exists ? Promise.resolve([key]) : Promise.resolve([]);
  };

  const GetKeyRedis = async (key) => {
    logger.debug("Redis=> GetKeyRedis");
    if (!client.isOpen) {
      return Promise.resolve(false);
    }

    const reply = await client.get(key);
    return reply ? Promise.resolve(reply) : Promise.resolve(false);
  };

  const GetRedis = async (key) => {
    logger.debug("Redis=> GetRedis");

    if (!client.isOpen) {
      throw new Error("Redis client is not connected");
    }

    const reply = await client.mGet(key);
    return reply ? Promise.resolve(reply) : Promise.resolve([]);
  };

  // ==========================================
  // CACHING HELPERS
  // ==========================================

  /**
   * Get a cached value by key. Returns parsed JSON or null.
   */
  const getCache = async (key) => {
    try {
      if (!client.isOpen) return null;
      const val = await client.get(`cache:${key}`);
      return val ? JSON.parse(val) : null;
    } catch (err) {
      logger.error("Redis getCache error", { key, error: err.message });
      return null;
    }
  };

  /**
   * Set a cache value with TTL (default 5 minutes)
   */
  const setCache = async (key, value, ttlSeconds = 300) => {
    try {
      if (!client.isOpen) return false;
      await client.set(`cache:${key}`, JSON.stringify(value), {
        EX: ttlSeconds,
      });
      return true;
    } catch (err) {
      logger.error("Redis setCache error", { key, error: err.message });
      return false;
    }
  };

  /**
   * Invalidate (delete) a cache key or pattern
   */
  const invalidateCache = async (key) => {
    try {
      if (!client.isOpen) return false;
      await client.del(`cache:${key}`);
      return true;
    } catch (err) {
      logger.error("Redis invalidateCache error", { key, error: err.message });
      return false;
    }
  };

  /**
   * Invalidate all cache keys matching a prefix
   */
  const invalidateCacheByPrefix = async (prefix) => {
    try {
      if (!client.isOpen) return false;
      const keys = [];
      for await (const key of client.scanIterator({
        MATCH: `cache:${prefix}*`,
        COUNT: 100,
      })) {
        keys.push(key);
      }
      if (keys.length > 0) {
        await client.del(keys);
        logger.info(
          `Invalidated ${keys.length} cache keys with prefix: ${prefix}`,
        );
      }
      return true;
    } catch (err) {
      logger.error("Redis invalidateCacheByPrefix error", {
        prefix,
        error: err.message,
      });
      return false;
    }
  };

  return {
    SetRedis,
    GetKeys,
    GetKeyRedis,
    GetRedis,
    getCache,
    setCache,
    invalidateCache,
    invalidateCacheByPrefix,
  };
};

// Also export the raw client for external use (BullMQ, etc.)
module.exports.redisClient = client;
