import Redis from "ioredis";
import { CACHE_KEYS, CacheKeyHelpers } from './utils/cache-keys';

// Redis client configuration for external instance
// Prioritize REDIS_URL if available, otherwise use host, port, and password.
const redis = new Redis(process.env.REDIS_URL as string, {
  enableReadyCheck: false,
  maxRetriesPerRequest: 3,
  connectTimeout: 10000,
  lazyConnect: true,
  family: 4,
  keepAlive: 10000, // keepAlive expects a number (milliseconds) or 0.
  db: 0,
});
// Event listener for Redis connection errors.
redis.on("error", (err) => {
  console.error("Redis connection error:", err);
});

// Event listener for successful Redis connection.
redis.on("connect", () => {
  console.log("✅ Connected to external Redis instance");
});

// Event listener for when Redis is ready for operations.
redis.on("ready", () => {
  console.log("✅ Redis is ready for operations");
});

// Event listener for when Redis connection is closed.
redis.on("close", () => {
  console.log("❌ Redis connection closed");
});

export { redis, CACHE_KEYS, CacheKeyHelpers };

/**
 * CacheManager class provides static utility methods for interacting with Redis.
 * Includes methods for setting, getting, deleting, checking existence, and managing lists.
 * All operations include robust error handling and logging.
 */
export class CacheManager {
  /**
   * Sets a key-value pair in Redis with an optional time-to-live (TTL).
   * Value is stringified before storing.
   * @param {string} key The cache key.
   * @param {any} value The value to store.
   * @param {number} ttl Time-to-live in seconds (default: 3600 seconds = 1 hour).
   * @returns {Promise<void>} A promise that resolves when the operation is complete.
   * @throws {Error} Throws an error if the cache set operation fails.
   */
  static async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    try {
      await redis.setex(key, ttl, JSON.stringify(value));
      console.log(`✅ Cache set: ${key}`);
    } catch (error) {
      console.error("❌ Cache set error:", error);
      throw error; // Re-throw to allow calling context to handle.
    }
  }

  /**
   * Retrieves a value from Redis by key.
   * Value is parsed from JSON string back to its original type.
   * @param {string} key The cache key.
   * @returns {Promise<T | null>} A promise that resolves with the retrieved value or null if not found/error.
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const value = await redis.get(key);
      if (value) {
        console.log(`✅ Cache hit: ${key}`);
        return JSON.parse(value);
      }
      console.log(`❌ Cache miss: ${key}`);
      return null;
    } catch (error) {
      console.error("❌ Cache get error:", error);
      return null; // Return null on error to indicate failure to retrieve.
    }
  }

  /**
   * Deletes a key from Redis.
   * @param {string} key The cache key to delete.
   * @returns {Promise<void>} A promise that resolves when the operation is complete.
   */
  static async del(key: string): Promise<void> {
    try {
      await redis.del(key);
      console.log(`✅ Cache deleted: ${key}`);
    } catch (error) {
      console.error("❌ Cache delete error:", error);
      // Do not re-throw, as deletion errors might not be critical.
    }
  }

  /**
   * Checks if a key exists in Redis.
   * @param {string} key The cache key to check.
   * @returns {Promise<boolean>} A promise that resolves to true if the key exists, false otherwise.
   */
  static async exists(key: string): Promise<boolean> {
    try {
      const result = await redis.exists(key);
      return result === 1; // Redis returns 1 for existence, 0 for non-existence.
    } catch (error) {
      console.error("❌ Cache exists error:", error);
      return false; // Return false on error.
    }
  }

  /**
   * Adds a value to the left side (head) of a Redis list.
   * Keeps the list trimmed to the latest 50 items.
   * @param {string} key The list key.
   * @param {any} value The value to add to the list.
   * @returns {Promise<void>} A promise that resolves when the operation is complete.
   */
  static async addToList(key: string, value: any): Promise<void> {
    try {
      await redis.lpush(key, JSON.stringify(value));
      // Trim the list to keep only the latest 50 items (indices 0 to 49).
      await redis.ltrim(key, 0, 49);
      console.log(`✅ Added to list: ${key}`);
    } catch (error) {
      console.error("❌ Cache list add error:", error);
      // Do not re-throw, as list operations might be less critical.
    }
  }

  /**
   * Retrieves a range of values from a Redis list.
   * Values are parsed from JSON strings.
   * @param {string} key The list key.
   * @param {number} start The starting index (default: 0).
   * @param {number} end The ending index (default: -1 for all elements).
   * @returns {Promise<T[]>} A promise that resolves with an array of retrieved values.
   */
  static async getList<T>(
    key: string,
    start: number = 0,
    end: number = -1
  ): Promise<T[]> {
    try {
      const values = await redis.lrange(key, start, end);
      console.log(`✅ Retrieved list: ${key} (${values.length} items)`);
      return values.map((v) => JSON.parse(v));
    } catch (error) {
      console.error("❌ Cache list get error:", error);
      return []; // Return an empty array on error.
    }
  }

  /**
   * Removes a plan from a user's travel history list.
   * @param {string} userId The user ID.
   * @param {string} planId The plan ID to delete.
   * @returns {Promise<void>}
   */
  static async removeFromHistory(userId: string, planId: string): Promise<void> {
    try {
      const key = CACHE_KEYS.USER_HISTORY(userId);
      const items = await this.getList<any>(key);
      const filtered = items.filter(item => item.id !== planId);
      
      // Delete the old key
      await redis.del(key);
      
      // Push the filtered items back to the list using rpush to preserve original order
      for (const item of filtered) {
        await redis.rpush(key, JSON.stringify(item));
      }
      console.log(`✅ Removed plan ${planId} from history list for user ${userId}`);
    } catch (error) {
      console.error("❌ Cache list remove from history error:", error);
    }
  }

  /**
   * Tests the Redis connection by sending a PING command.
   * @returns {Promise<boolean>} A promise that resolves to true if the connection is successful, false otherwise.
   */
  static async testConnection(): Promise<boolean> {
    try {
      await redis.ping();
      console.log("✅ Redis connection test successful");
      return true;
    } catch (error) {
      console.error("❌ Redis connection test failed:", error);
      return false;
    }
  }
}
