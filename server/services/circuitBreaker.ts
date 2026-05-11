import { logger } from './logger';

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  failureThreshold?: number; // Number of failures before opening (default: 5)
  successThreshold?: number; // Number of successes before closing (default: 2)
  timeout?: number; // Time in ms before attempting half-open (default: 60000)
  name?: string;
}

/**
 * Circuit Breaker pattern implementation
 * Prevents cascading failures by stopping requests to failing services
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: Date;
  private nextAttemptTime?: Date;

  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly timeout: number;
  private readonly name: string;

  constructor(config: CircuitBreakerConfig = {}) {
    this.failureThreshold = config.failureThreshold || 5;
    this.successThreshold = config.successThreshold || 2;
    this.timeout = config.timeout || 60000;
    this.name = config.name || 'CircuitBreaker';
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (!this.nextAttemptTime || Date.now() < this.nextAttemptTime.getTime()) {
        const error = new Error(`Circuit breaker is OPEN for ${this.name}`);
        logger.log({
          service: 'circuit_breaker',
          action: 'execute',
          level: 'warn',
          status: 'failed',
          message: `Circuit breaker rejected request for ${this.name}`,
          metadata: { name: this.name, state: this.state },
        });
        throw error;
      }

      // Transition to half-open
      this.state = 'half-open';
      this.successCount = 0;

      logger.log({
        service: 'circuit_breaker',
        action: 'execute',
        level: 'info',
        status: 'pending',
        message: `Circuit breaker transitioning to HALF-OPEN for ${this.name}`,
        metadata: { name: this.name },
      });
    }

    try {
      const result = await fn();

      if (this.state === 'half-open') {
        this.successCount++;

        if (this.successCount >= this.successThreshold) {
          this.close();
        }
      } else if (this.state === 'closed') {
        this.failureCount = 0;
      }

      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Record a failure
   */
  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    logger.log({
      service: 'circuit_breaker',
      action: 'record_failure',
      level: 'warn',
      status: 'failed',
      message: `Failure recorded for ${this.name}`,
      metadata: {
        name: this.name,
        failureCount: this.failureCount,
        threshold: this.failureThreshold,
      },
    });

    if (this.failureCount >= this.failureThreshold) {
      this.open();
    }
  }

  /**
   * Open the circuit
   */
  private open(): void {
    this.state = 'open';
    this.nextAttemptTime = new Date(Date.now() + this.timeout);

    logger.log({
      service: 'circuit_breaker',
      action: 'open',
      level: 'error',
      status: 'failed',
      message: `Circuit breaker OPENED for ${this.name}`,
      metadata: {
        name: this.name,
        failureCount: this.failureCount,
        nextAttempt: this.nextAttemptTime,
      },
    });
  }

  /**
   * Close the circuit
   */
  private close(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttemptTime = undefined;

    logger.log({
      service: 'circuit_breaker',
      action: 'close',
      level: 'info',
      status: 'success',
      message: `Circuit breaker CLOSED for ${this.name}`,
      metadata: { name: this.name },
    });
  }

  /**
   * Get circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit status
   */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      failureThreshold: this.failureThreshold,
      successThreshold: this.successThreshold,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
    };
  }

  /**
   * Reset circuit
   */
  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
    this.nextAttemptTime = undefined;

    logger.log({
      service: 'circuit_breaker',
      action: 'reset',
      level: 'info',
      status: 'success',
      message: `Circuit breaker RESET for ${this.name}`,
      metadata: { name: this.name },
    });
  }
}

/**
 * Circuit breaker registry
 */
class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker> = new Map();

  /**
   * Get or create circuit breaker
   */
  getOrCreate(name: string, config?: CircuitBreakerConfig): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker({ ...config, name }));
    }
    return this.breakers.get(name)!;
  }

  /**
   * Get all breakers
   */
  getAll(): CircuitBreaker[] {
    return Array.from(this.breakers.values());
  }

  /**
   * Get breaker status
   */
  getStatus(name: string) {
    const breaker = this.breakers.get(name);
    return breaker ? breaker.getStatus() : null;
  }

  /**
   * Get all statuses
   */
  getAllStatuses() {
    return Array.from(this.breakers.values()).map((b) => b.getStatus());
  }

  /**
   * Reset all breakers
   */
  resetAll(): void {
    this.breakers.forEach((b) => b.reset());
  }
}

export const circuitBreakerRegistry = new CircuitBreakerRegistry();
