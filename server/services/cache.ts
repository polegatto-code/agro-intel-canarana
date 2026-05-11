import { logger } from './logger';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  hits: number;
}

/**
 * Simple in-memory cache with TTL support
 */
class CacheService {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly defaultTTL = 60 * 60 * 1000; // 1 hour

  /**
   * Set cache entry
   */
  set<T>(key: string, data: T, ttlMs: number = this.defaultTTL): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttlMs,
      hits: 0,
    });

    logger.log({
      service: 'cache',
      action: 'set',
      level: 'debug',
      status: 'success',
      message: `Cache set: ${key}`,
      metadata: { ttlMs, size: this.cache.size },
    });
  }

  /**
   * Get cache entry
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      logger.log({
        service: 'cache',
        action: 'get',
        level: 'debug',
        status: 'failed',
        message: `Cache miss: ${key}`,
      });
      return null;
    }

    // Check if expired
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      logger.log({
        service: 'cache',
        action: 'get',
        level: 'debug',
        status: 'failed',
        message: `Cache expired: ${key}`,
      });
      return null;
    }

    entry.hits++;

    logger.log({
      service: 'cache',
      action: 'get',
      level: 'debug',
      status: 'success',
      message: `Cache hit: ${key}`,
      metadata: { hits: entry.hits },
    });

    return entry.data;
  }

  /**
   * Delete cache entry
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);

    if (deleted) {
      logger.log({
        service: 'cache',
        action: 'delete',
        level: 'debug',
        status: 'success',
        message: `Cache deleted: ${key}`,
      });
    }

    return deleted;
  }

  /**
   * Clear all cache
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();

    logger.log({
      service: 'cache',
      action: 'clear',
      level: 'info',
      status: 'success',
      message: `Cache cleared`,
      metadata: { entriesCleared: size },
    });
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    entries: Array<{ key: string; hits: number; expiresIn: number }>;
  } {
    const now = Date.now();
    const entries: Array<{ key: string; hits: number; expiresIn: number }> = [];
    this.cache.forEach((entry, key) => {
      entries.push({
        key,
        hits: entry.hits,
        expiresIn: Math.max(0, entry.expiresAt - now),
      });
    });

    return {
      size: this.cache.size,
      entries,
    };
  }

  /**
   * Clean expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (entry.expiresAt < now) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => {
      this.cache.delete(key);
      removed++;
    });

    if (removed > 0) {
      logger.log({
        service: 'cache',
        action: 'cleanup',
        level: 'debug',
        status: 'success',
        message: `Cache cleanup completed`,
        metadata: { entriesRemoved: removed },
      });
    }

    return removed;
  }
}

/**
 * Alert deduplication service
 */
class DeduplicationService {
  private sentAlerts: Map<string, number> = new Map();
  private readonly deduplicationWindow = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Check if alert was already sent
   */
  isDuplicate(userId: number, alertHash: string): boolean {
    const key = `${userId}:${alertHash}`;
    const lastSent = this.sentAlerts.get(key);

    if (!lastSent) {
      return false;
    }

    const timeSinceLastSent = Date.now() - lastSent;
    const isDupe = timeSinceLastSent < this.deduplicationWindow;

    if (isDupe) {
      logger.log({
        service: 'deduplication',
        action: 'check',
        level: 'debug',
        status: 'success',
        message: `Alert deduplicated: ${alertHash}`,
        userId,
        metadata: { timeSinceLastSent },
      });
    }

    return isDupe;
  }

  /**
   * Mark alert as sent
   */
  markSent(userId: number, alertHash: string): void {
    const key = `${userId}:${alertHash}`;
    this.sentAlerts.set(key, Date.now());

    logger.log({
      service: 'deduplication',
      action: 'mark_sent',
      level: 'debug',
      status: 'success',
      message: `Alert marked as sent: ${alertHash}`,
      userId,
    });
  }

  /**
   * Generate hash for alert content
   */
  static generateHash(content: string): string {
    // Simple hash function for deduplication
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Clear old entries
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    const keysToDelete: string[] = [];

    this.sentAlerts.forEach((timestamp, key) => {
      if (now - timestamp > this.deduplicationWindow) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => {
      this.sentAlerts.delete(key);
      removed++;
    });

    if (removed > 0) {
      logger.log({
        service: 'deduplication',
        action: 'cleanup',
        level: 'debug',
        status: 'success',
        message: `Deduplication cleanup completed`,
        metadata: { entriesRemoved: removed },
      });
    }

    return removed;
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalTracked: number;
  } {
    return {
      totalTracked: this.sentAlerts.size,
    };
  }
}

/**
 * Rate limiter service
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly windowMs = 60 * 1000; // 1 minute window
  private readonly maxRequests = 100; // Max requests per window

  /**
   * Check if request is allowed
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];

    // Remove old requests outside the window
    const recentRequests = requests.filter((time) => now - time < this.windowMs);

    if (recentRequests.length >= this.maxRequests) {
      logger.log({
        service: 'rate_limiter',
        action: 'check',
        level: 'warn',
        status: 'failed',
        message: `Rate limit exceeded for ${key}`,
        metadata: { requests: recentRequests.length, limit: this.maxRequests },
      });
      return false;
    }

    // Add current request
    recentRequests.push(now);
    this.requests.set(key, recentRequests);

    return true;
  }

  /**
   * Get remaining requests
   */
  getRemaining(key: string): number {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    const recentRequests = requests.filter((time) => now - time < this.windowMs);
    return Math.max(0, this.maxRequests - recentRequests.length);
  }

  /**
   * Reset limit for key
   */
  reset(key: string): void {
    this.requests.delete(key);

    logger.log({
      service: 'rate_limiter',
      action: 'reset',
      level: 'debug',
      status: 'success',
      message: `Rate limit reset for ${key}`,
    });
  }

  /**
   * Get statistics
   */
  getStats(): {
    trackedKeys: number;
  } {
    return {
      trackedKeys: this.requests.size,
    };
  }
}

export const cacheService = new CacheService();
export const deduplicationService = new DeduplicationService();
export const rateLimiter = new RateLimiter();
