import { logger } from './logger';
import * as db from '../db';
import { executeWeatherCheckForUser, executeMarketAnalysisForUser } from './scheduler';

/**
 * Cron job configuration
 */
export interface CronConfig {
  weatherCheckHour: number; // 0-23, default 5
  marketAlertHour: number; // 0-23, default 6
  enabled: boolean;
}

/**
 * Cron job execution service
 */
class CronJobService {
  private weatherCheckInterval: NodeJS.Timeout | null = null;
  private marketAlertInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  /**
   * Start cron jobs
   */
  start(config: CronConfig = { weatherCheckHour: 5, marketAlertHour: 6, enabled: true }): void {
    if (!config.enabled) {
      logger.log({
        service: 'cron',
        action: 'start',
        level: 'info',
        status: 'pending',
        message: 'Cron jobs disabled',
      });
      return;
    }

    if (this.isRunning) {
      logger.log({
        service: 'cron',
        action: 'start',
        level: 'warn',
        status: 'pending',
        message: 'Cron jobs already running',
      });
      return;
    }

    this.isRunning = true;

    logger.log({
      service: 'cron',
      action: 'start',
      level: 'info',
      status: 'success',
      message: `Cron jobs started. Weather check at ${config.weatherCheckHour}:00, Market alert at ${config.marketAlertHour}:00`,
    });

    // Schedule weather check
    this.scheduleWeatherCheck(config.weatherCheckHour);

    // Schedule market alerts
    this.scheduleMarketAlerts(config.marketAlertHour);
  }

  /**
   * Stop cron jobs
   */
  stop(): void {
    if (this.weatherCheckInterval) clearInterval(this.weatherCheckInterval);
    if (this.marketAlertInterval) clearInterval(this.marketAlertInterval);

    this.isRunning = false;

    logger.log({
      service: 'cron',
      action: 'stop',
      level: 'info',
      status: 'success',
      message: 'Cron jobs stopped',
    });
  }

  /**
   * Schedule weather check at specific hour
   */
  private scheduleWeatherCheck(hour: number): void {
    // Check every minute if it's time to run
    this.weatherCheckInterval = setInterval(() => {
      const now = new Date();
      if (now.getHours() === hour && now.getMinutes() === 0) {
        this.executeWeatherCheckJob();
      }
    }, 60000); // Check every minute

    logger.log({
      service: 'cron',
      action: 'schedule_weather',
      level: 'debug',
      status: 'success',
      message: `Weather check scheduled for ${hour}:00`,
    });
  }

  /**
   * Schedule market alerts at specific hour
   */
  private scheduleMarketAlerts(hour: number): void {
    // Check every minute if it's time to run
    this.marketAlertInterval = setInterval(() => {
      const now = new Date();
      if (now.getHours() === hour && now.getMinutes() === 0) {
        this.executeMarketAlertJob();
      }
    }, 60000); // Check every minute

    logger.log({
      service: 'cron',
      action: 'schedule_market',
      level: 'debug',
      status: 'success',
      message: `Market alert scheduled for ${hour}:00`,
    });
  }

  /**
   * Execute weather check job for all users
   */
  private async executeWeatherCheckJob(): Promise<void> {
    logger.log({
      service: 'cron',
      action: 'weather_check_job',
      level: 'info',
      status: 'pending',
      message: 'Starting weather check cron job',
    });

    try {
      // Get all users from database
      // TODO: Implement getAllUsersWithSettings in db.ts
      const users: any[] = [];

      let successCount = 0;
      let failureCount = 0;

      for (const user of users) {
        try {
          if (!user.telegramToken || !user.telegramChatId) {
            logger.log({
              service: 'cron',
              action: 'weather_check_job',
              level: 'warn',
              status: 'pending',
              userId: user.userId,
              message: 'Skipping user: Telegram not configured',
            });
            continue;
          }

          await executeWeatherCheckForUser(
            user.userId,
            user.telegramToken,
            user.telegramChatId,
            user.minHumidity,
            user.maxHumidity,
            user.maxTemperature,
            user.maxWindSpeed
          );

          successCount++;
        } catch (error) {
          failureCount++;
          logger.log({
            service: 'cron',
            action: 'weather_check_job',
            level: 'error',
            status: 'failed',
            userId: user.userId,
            message: 'Weather check failed for user',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      logger.log({
        service: 'cron',
        action: 'weather_check_job',
        level: 'info',
        status: 'success',
        message: 'Weather check cron job completed',
        metadata: { successCount, failureCount, totalUsers: users.length },
      });
    } catch (error) {
      logger.log({
        service: 'cron',
        action: 'weather_check_job',
        level: 'error',
        status: 'failed',
        message: 'Weather check cron job failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Execute market alert job for all users
   */
  private async executeMarketAlertJob(): Promise<void> {
    logger.log({
      service: 'cron',
      action: 'market_alert_job',
      level: 'info',
      status: 'pending',
      message: 'Starting market alert cron job',
    });

    try {
      // Get all users from database
      // TODO: Implement getAllUsersWithSettings in db.ts
      const users: any[] = [];

      let successCount = 0;
      let failureCount = 0;

      for (const user of users) {
        try {
          if (!user.telegramToken || !user.telegramChatId) {
            logger.log({
              service: 'cron',
              action: 'market_alert_job',
              level: 'warn',
              status: 'pending',
              userId: user.userId,
              message: 'Skipping user: Telegram not configured',
            });
            continue;
          }

          // Only run if market notifications are enabled
          if (!user.enableMarketNotifications) {
            continue;
          }

          // Check frequency
          const lastRun = await db.getLatestMarketAnalysis(user.userId);
          const shouldRun = this.shouldRunMarketAnalysis(lastRun?.createdAt || null, user.marketAlertFrequency);

          if (!shouldRun) {
            continue;
          }

          await executeMarketAnalysisForUser(
            user.userId,
            user.telegramToken,
            user.telegramChatId
          );

          successCount++;
        } catch (error) {
          failureCount++;
          logger.log({
            service: 'cron',
            action: 'market_alert_job',
            level: 'error',
            status: 'failed',
            userId: user.userId,
            message: 'Market analysis failed for user',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      logger.log({
        service: 'cron',
        action: 'market_alert_job',
        level: 'info',
        status: 'success',
        message: 'Market alert cron job completed',
        metadata: { successCount, failureCount, totalUsers: users.length },
      });
    } catch (error) {
      logger.log({
        service: 'cron',
        action: 'market_alert_job',
        level: 'error',
        status: 'failed',
        message: 'Market alert cron job failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Check if market analysis should run based on frequency
   */
  private shouldRunMarketAnalysis(lastRun: Date | null, frequency: string): boolean {
    if (!lastRun) return true;

    const now = new Date();
    const timeSinceLastRun = now.getTime() - lastRun.getTime();

    if (frequency === 'daily') {
      return timeSinceLastRun >= 24 * 60 * 60 * 1000; // 24 hours
    } else if (frequency === 'weekly') {
      return timeSinceLastRun >= 7 * 24 * 60 * 60 * 1000; // 7 days
    }

    return false;
  }

  /**
   * Get cron status
   */
  getStatus(): {
    isRunning: boolean;
    weatherCheckInterval: boolean;
    marketAlertInterval: boolean;
  } {
    return {
      isRunning: this.isRunning,
      weatherCheckInterval: this.weatherCheckInterval !== null,
      marketAlertInterval: this.marketAlertInterval !== null,
    };
  }
}

export const cronJobService = new CronJobService();
