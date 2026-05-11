import { logger } from './logger';

export type MessagePriority = 'low' | 'normal' | 'high' | 'critical';

export interface TelegramMessage {
  chatId: string;
  message: string;
  priority: MessagePriority;
  retryCount?: number;
  maxRetries?: number;
}

interface PendingMessage extends TelegramMessage {
  createdAt: Date;
  lastRetryAt?: Date;
  retryCount: number;
}

class TelegramService {
  private queue: PendingMessage[] = [];
  private maxRetries = 3;
  private retryDelays: Record<MessagePriority, number> = {
    low: 5 * 60 * 1000, // 5 minutes
    normal: 2 * 60 * 1000, // 2 minutes
    high: 30 * 1000, // 30 seconds
    critical: 5 * 1000, // 5 seconds
  };

  /**
   * Send a message to Telegram
   * Critical messages are sent immediately, others are queued
   */
  async sendMessage(
    token: string,
    chatId: string,
    message: string,
    priority: MessagePriority = 'normal'
  ): Promise<boolean> {
    logger.log({
      service: 'telegram',
      action: 'send_message',
      level: 'info',
      status: 'pending',
      message: `Sending ${priority} priority message to ${chatId}`,
      metadata: { messageLength: message.length, priority },
    });

    try {
      const response = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Telegram API error: ${errorData.description}`);
      }

      logger.log({
        service: 'telegram',
        action: 'send_message',
        level: 'info',
        status: 'success',
        message: `Message sent successfully to ${chatId}`,
        metadata: { priority },
      });

      return true;
    } catch (error) {
      logger.log({
        service: 'telegram',
        action: 'send_message',
        level: 'error',
        status: 'failed',
        message: `Failed to send message to ${chatId}`,
        error: error instanceof Error ? error.message : String(error),
        metadata: { priority },
      });

      // Queue for retry if not critical
      if (priority !== 'critical') {
        this.queueMessage({
          chatId,
          message,
          priority,
          retryCount: 0,
          maxRetries: this.maxRetries,
        });
      }

      return false;
    }
  }

  /**
   * Queue a message for retry
   */
  private queueMessage(msg: TelegramMessage): void {
    const pending: PendingMessage = {
      ...msg,
      createdAt: new Date(),
      retryCount: msg.retryCount || 0,
    };

    this.queue.push(pending);

    logger.log({
      service: 'telegram',
      action: 'queue_message',
      level: 'info',
      status: 'pending',
      message: `Message queued for retry (attempt ${pending.retryCount + 1}/${msg.maxRetries || this.maxRetries})`,
      metadata: { priority: msg.priority },
    });
  }

  /**
   * Process retry queue
   * Should be called periodically (e.g., every minute)
   */
  async processRetryQueue(token: string): Promise<void> {
    if (this.queue.length === 0) return;

    logger.log({
      service: 'telegram',
      action: 'process_queue',
      level: 'debug',
      status: 'pending',
      message: `Processing ${this.queue.length} queued messages`,
    });

    const now = new Date();
    const toRetry: PendingMessage[] = [];
    const toRemove: number[] = [];

    for (let i = 0; i < this.queue.length; i++) {
      const msg = this.queue[i];
      const maxRetries = msg.maxRetries || this.maxRetries;
      const retryDelay = this.retryDelays[msg.priority];

      // Check if enough time has passed for retry
      const lastRetry = msg.lastRetryAt || msg.createdAt;
      const timeSinceLastRetry = now.getTime() - lastRetry.getTime();

      if (timeSinceLastRetry >= retryDelay) {
        if (msg.retryCount < maxRetries) {
          toRetry.push(msg);
        } else {
          logger.log({
            service: 'telegram',
            action: 'process_queue',
            level: 'error',
            status: 'failed',
            message: `Message exceeded max retries (${maxRetries})`,
            metadata: { priority: msg.priority, chatId: msg.chatId },
          });
          toRemove.push(i);
        }
      }
    }

    // Remove failed messages
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.queue.splice(toRemove[i], 1);
    }

    // Retry messages
    for (const msg of toRetry) {
      msg.retryCount++;
      msg.lastRetryAt = now;

      const success = await this.sendMessage(
        token,
        msg.chatId,
        msg.message,
        msg.priority
      );

      if (success) {
        // Remove from queue
        const index = this.queue.indexOf(msg);
        if (index > -1) {
          this.queue.splice(index, 1);
        }
      }
    }
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    totalQueued: number;
    byPriority: Record<MessagePriority, number>;
  } {
    const byPriority: Record<MessagePriority, number> = {
      low: 0,
      normal: 0,
      high: 0,
      critical: 0,
    };

    for (const msg of this.queue) {
      byPriority[msg.priority]++;
    }

    return {
      totalQueued: this.queue.length,
      byPriority,
    };
  }

  /**
   * Clear queue (for testing)
   */
  clearQueue(): void {
    this.queue = [];
  }
}

export const telegramService = new TelegramService();
