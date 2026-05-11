import { logger } from './logger';

export interface RetryConfig {
  maxAttempts?: number;
  initialDelay?: number; // ms
  maxDelay?: number; // ms
  backoffMultiplier?: number;
  jitter?: boolean;
  name?: string;
}

/**
 * Retry service with exponential backoff
 */
export class RetryService {
  private readonly maxAttempts: number;
  private readonly initialDelay: number;
  private readonly maxDelay: number;
  private readonly backoffMultiplier: number;
  private readonly jitter: boolean;
  private readonly name: string;

  constructor(config: RetryConfig = {}) {
    this.maxAttempts = config.maxAttempts || 3;
    this.initialDelay = config.initialDelay || 1000;
    this.maxDelay = config.maxDelay || 30000;
    this.backoffMultiplier = config.backoffMultiplier || 2;
    this.jitter = config.jitter !== false;
    this.name = config.name || 'RetryService';
  }

  /**
   * Execute function with retry logic
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        const result = await fn();

        if (attempt > 1) {
          logger.log({
            service: 'retry',
            action: 'execute',
            level: 'info',
            status: 'success',
            message: `${this.name} succeeded after ${attempt} attempts`,
            metadata: { name: this.name, attempt, maxAttempts: this.maxAttempts },
          });
        }

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.maxAttempts) {
          const delay = this.calculateDelay(attempt);

          logger.log({
            service: 'retry',
            action: 'execute',
            level: 'warn',
            status: 'retry',
            message: `${this.name} failed, retrying in ${delay}ms (attempt ${attempt}/${this.maxAttempts})`,
            error: lastError.message,
            metadata: {
              name: this.name,
              attempt,
              maxAttempts: this.maxAttempts,
              delay,
            },
          });

          await this.delay(delay);
        } else {
          logger.log({
            service: 'retry',
            action: 'execute',
            level: 'error',
            status: 'failed',
            message: `${this.name} failed after ${this.maxAttempts} attempts`,
            error: lastError.message,
            metadata: {
              name: this.name,
              maxAttempts: this.maxAttempts,
            },
          });
        }
      }
    }

    throw lastError || new Error(`${this.name} failed after ${this.maxAttempts} attempts`);
  }

  /**
   * Execute with fallback
   */
  async executeWithFallback<T>(
    primary: () => Promise<T>,
    fallback: () => Promise<T>
  ): Promise<T> {
    try {
      return await this.execute(primary);
    } catch (error) {
      logger.log({
        service: 'retry',
        action: 'execute_with_fallback',
        level: 'warn',
        status: 'retry',
        message: `${this.name} primary failed, attempting fallback`,
        error: error instanceof Error ? error.message : String(error),
        metadata: { name: this.name },
      });

      try {
        const result = await this.execute(fallback);

        logger.log({
          service: 'retry',
          action: 'execute_with_fallback',
          level: 'info',
          status: 'success',
          message: `${this.name} fallback succeeded`,
          metadata: { name: this.name },
        });

        return result;
      } catch (fallbackError) {
        logger.log({
          service: 'retry',
          action: 'execute_with_fallback',
          level: 'error',
          status: 'failed',
          message: `${this.name} both primary and fallback failed`,
          error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
          metadata: { name: this.name },
        });

        throw fallbackError;
      }
    }
  }

  /**
   * Calculate delay with exponential backoff
   */
  private calculateDelay(attempt: number): number {
    let delay = this.initialDelay * Math.pow(this.backoffMultiplier, attempt - 1);

    // Cap at maxDelay
    delay = Math.min(delay, this.maxDelay);

    // Add jitter
    if (this.jitter) {
      const jitterAmount = delay * 0.1; // 10% jitter
      delay += Math.random() * jitterAmount;
    }

    return Math.floor(delay);
  }

  /**
   * Sleep for specified duration
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get configuration
   */
  getConfig() {
    return {
      name: this.name,
      maxAttempts: this.maxAttempts,
      initialDelay: this.initialDelay,
      maxDelay: this.maxDelay,
      backoffMultiplier: this.backoffMultiplier,
      jitter: this.jitter,
    };
  }
}

/**
 * Create retry service with custom config
 */
export function createRetryService(config: RetryConfig): RetryService {
  return new RetryService(config);
}

// Export default instances for common use cases
export const weatherRetry = new RetryService({
  name: 'Weather API',
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
});

export const newsRetry = new RetryService({
  name: 'News Collector',
  maxAttempts: 2,
  initialDelay: 2000,
  maxDelay: 15000,
});

export const telegramRetry = new RetryService({
  name: 'Telegram',
  maxAttempts: 5,
  initialDelay: 500,
  maxDelay: 5000,
});
