import { randomBytes } from 'crypto';

export interface RequestContext {
  requestId: string;
  executionId: string;
  correlationId: string;
  userId?: number;
  startTime: Date;
  metadata: Record<string, unknown>;
}

/**
 * Context service for request tracking and correlation
 */
class ContextService {
  private contexts: Map<string, RequestContext> = new Map();
  private readonly contextTimeout = 5 * 60 * 1000; // 5 minutes

  /**
   * Create new request context
   */
  createContext(userId?: number, metadata: Record<string, unknown> = {}): RequestContext {
    const requestId = this.generateId();
    const executionId = this.generateId();
    const correlationId = this.generateId();

    const context: RequestContext = {
      requestId,
      executionId,
      correlationId,
      userId,
      startTime: new Date(),
      metadata,
    };

    this.contexts.set(requestId, context);

    // Auto-cleanup after timeout
    setTimeout(() => {
      this.contexts.delete(requestId);
    }, this.contextTimeout);

    return context;
  }

  /**
   * Get existing context
   */
  getContext(requestId: string): RequestContext | undefined {
    return this.contexts.get(requestId);
  }

  /**
   * Update context metadata
   */
  updateContext(requestId: string, metadata: Record<string, unknown>): void {
    const context = this.contexts.get(requestId);
    if (context) {
      context.metadata = { ...context.metadata, ...metadata };
    }
  }

  /**
   * Get execution duration
   */
  getExecutionDuration(requestId: string): number | undefined {
    const context = this.contexts.get(requestId);
    if (context) {
      return Date.now() - context.startTime.getTime();
    }
    return undefined;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return randomBytes(8).toString('hex');
  }

  /**
   * Get all active contexts
   */
  getAllContexts(): RequestContext[] {
    return Array.from(this.contexts.values());
  }

  /**
   * Clear all contexts
   */
  clearAll(): void {
    this.contexts.clear();
  }

  /**
   * Get context count
   */
  getContextCount(): number {
    return this.contexts.size;
  }
}

export const contextService = new ContextService();
