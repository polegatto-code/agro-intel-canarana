/**
 * Centralized logging system for all operations
 * Provides structured logging with timestamps, levels, and context
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  action: string;
  userId?: number;
  duration?: number; // milliseconds
  status: 'pending' | 'success' | 'failed' | 'retry';
  message: string;
  error?: string;
  metadata?: Record<string, any>;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000; // Keep last 1000 logs in memory

  log(entry: Omit<LogEntry, 'timestamp'>): LogEntry {
    const fullEntry: LogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };

    this.logs.push(fullEntry);

    // Keep only recent logs in memory
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console output for development
    this.consoleOutput(fullEntry);

    return fullEntry;
  }

  private consoleOutput(entry: LogEntry): void {
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.service}/${entry.action}]`;
    const message = `${prefix} ${entry.message}${entry.duration ? ` (${entry.duration}ms)` : ''}`;

    switch (entry.level) {
      case 'debug':
        console.debug(message, entry.metadata);
        break;
      case 'info':
        console.log(message, entry.metadata);
        break;
      case 'warn':
        console.warn(message, entry.metadata);
        break;
      case 'error':
        console.error(message, entry.error, entry.metadata);
        break;
      case 'critical':
        console.error(`🚨 CRITICAL: ${message}`, entry.error, entry.metadata);
        break;
    }
  }

  getLogs(filter?: {
    service?: string;
    level?: LogLevel;
    status?: string;
    limit?: number;
  }): LogEntry[] {
    let filtered = [...this.logs];

    if (filter?.service) {
      filtered = filtered.filter((l) => l.service === filter.service);
    }
    if (filter?.level) {
      filtered = filtered.filter((l) => l.level === filter.level);
    }
    if (filter?.status) {
      filtered = filtered.filter((l) => l.status === filter.status);
    }

    const limit = filter?.limit || 100;
    return filtered.slice(-limit);
  }

  getRecentErrors(limit: number = 20): LogEntry[] {
    return this.logs
      .filter((l) => l.level === 'error' || l.level === 'critical')
      .slice(-limit);
  }

  clear(): void {
    this.logs = [];
  }
}

export const logger = new Logger();

/**
 * Helper to time async operations
 */
export async function timeOperation<T>(
  fn: () => Promise<T>,
  context: Omit<LogEntry, 'timestamp' | 'duration' | 'status'>
): Promise<{ result: T; entry: LogEntry }> {
  const startTime = Date.now();

  try {
    const result = await fn();
    const duration = Date.now() - startTime;

    const entry = logger.log({
      ...context,
      duration,
      status: 'success',
    });

    return { result, entry };
  } catch (error) {
    const duration = Date.now() - startTime;

    const entry = logger.log({
      ...context,
      duration,
      status: 'failed',
      level: 'error',
      error: error instanceof Error ? error.message : String(error),
    });

    throw { error, entry };
  }
}
