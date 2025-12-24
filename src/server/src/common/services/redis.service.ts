import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Redis Service
 *
 * Provides Redis operations for the application including:
 * - Key-value storage with TTL
 * - Distributed locking (mutex pattern)
 * - M-Pesa token caching per P0-003 in mpesa_remediation.md
 *
 * Uses ioredis for robust Redis connectivity.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private readonly keyPrefix: string;

  constructor(private readonly configService: ConfigService) {
    this.keyPrefix = this.configService.get<string>('redis.keyPrefix', 'bodainsure:');
  }

  async onModuleInit(): Promise<void> {
    try {
      const host = this.configService.get<string>('redis.host', 'localhost');
      const port = this.configService.get<number>('redis.port', 6379);
      const password = this.configService.get<string>('redis.password');
      const db = this.configService.get<number>('redis.db', 0);

      this.client = new Redis({
        host,
        port,
        password: password || undefined,
        db,
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => {
          if (times > 3) {
            this.logger.error('Redis connection failed after 3 retries');
            return null;
          }
          return Math.min(times * 200, 2000);
        },
        lazyConnect: true,
      });

      this.client.on('error', (err: Error) => {
        this.logger.error('Redis connection error', err);
      });

      this.client.on('connect', () => {
        this.logger.log('Redis connected');
      });

      await this.client.connect();
    } catch (error) {
      this.logger.error('Failed to initialize Redis connection', error);
      // Don't throw - allow app to start without Redis (will use in-memory fallback)
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.logger.log('Redis connection closed');
    }
  }

  /**
   * Check if Redis is available
   */
  isAvailable(): boolean {
    return this.client !== null && this.client.status === 'ready';
  }

  /**
   * Get a value from Redis
   */
  async get(key: string): Promise<string | null> {
    if (!this.isAvailable()) {
      return null;
    }
    try {
      return await this.client!.get(this.keyPrefix + key);
    } catch (error) {
      this.logger.error(`Redis GET error for key ${key}`, error);
      return null;
    }
  }

  /**
   * Set a value in Redis with optional TTL (in seconds)
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }
    try {
      if (ttlSeconds) {
        await this.client!.setex(this.keyPrefix + key, ttlSeconds, value);
      } else {
        await this.client!.set(this.keyPrefix + key, value);
      }
      return true;
    } catch (error) {
      this.logger.error(`Redis SET error for key ${key}`, error);
      return false;
    }
  }

  /**
   * Delete a key from Redis
   */
  async del(key: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }
    try {
      await this.client!.del(this.keyPrefix + key);
      return true;
    } catch (error) {
      this.logger.error(`Redis DEL error for key ${key}`, error);
      return false;
    }
  }

  /**
   * Acquire a distributed lock
   *
   * Uses Redis SET NX (set if not exists) with expiry for atomic lock acquisition.
   * This is a simpler alternative to Redlock for single-Redis deployments.
   *
   * @param lockKey - The lock key name
   * @param ttlSeconds - Lock expiry in seconds (prevents deadlocks)
   * @param retries - Number of retries to acquire lock
   * @param retryDelayMs - Delay between retries in milliseconds
   * @returns Lock value (used for release) or null if lock not acquired
   */
  async acquireLock(
    lockKey: string,
    ttlSeconds: number = 10,
    retries: number = 10,
    retryDelayMs: number = 100,
  ): Promise<string | null> {
    if (!this.isAvailable()) {
      // Return a fake lock value for in-memory fallback
      return 'in-memory-fallback';
    }

    const fullKey = this.keyPrefix + 'lock:' + lockKey;
    const lockValue = `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2)}`;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        // SET NX EX - atomic set if not exists with expiry
        const result = await this.client!.set(fullKey, lockValue, 'EX', ttlSeconds, 'NX');

        if (result === 'OK') {
          this.logger.debug(`Lock acquired: ${lockKey} (value: ${lockValue})`);
          return lockValue;
        }

        // Lock exists, wait and retry
        if (attempt < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        }
      } catch (error) {
        this.logger.error(`Redis lock acquire error for ${lockKey}`, error);
        return null;
      }
    }

    this.logger.warn(`Failed to acquire lock after ${retries} attempts: ${lockKey}`);
    return null;
  }

  /**
   * Release a distributed lock
   *
   * Uses Lua script to ensure we only delete the lock if we own it.
   *
   * @param lockKey - The lock key name
   * @param lockValue - The value returned from acquireLock
   */
  async releaseLock(lockKey: string, lockValue: string): Promise<boolean> {
    if (!this.isAvailable() || lockValue === 'in-memory-fallback') {
      return true;
    }

    const fullKey = this.keyPrefix + 'lock:' + lockKey;

    // Lua script: only delete if value matches (we own the lock)
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    try {
      const result = await this.client!.eval(script, 1, fullKey, lockValue);
      if (result === 1) {
        this.logger.debug(`Lock released: ${lockKey}`);
        return true;
      } else {
        this.logger.warn(`Lock release failed (not owned or expired): ${lockKey}`);
        return false;
      }
    } catch (error) {
      this.logger.error(`Redis lock release error for ${lockKey}`, error);
      return false;
    }
  }

  /**
   * Execute with distributed lock
   *
   * Acquires lock, executes callback, releases lock.
   * Ensures lock is always released even if callback throws.
   *
   * @param lockKey - The lock key name
   * @param callback - Function to execute while holding lock
   * @param ttlSeconds - Lock expiry in seconds
   */
  async withLock<T>(
    lockKey: string,
    callback: () => Promise<T>,
    ttlSeconds: number = 10,
  ): Promise<T> {
    const lockValue = await this.acquireLock(lockKey, ttlSeconds);

    if (!lockValue) {
      throw new Error(`Failed to acquire lock: ${lockKey}`);
    }

    try {
      return await callback();
    } finally {
      await this.releaseLock(lockKey, lockValue);
    }
  }
}
