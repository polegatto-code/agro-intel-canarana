import { logger } from './logger';
import { 
  executeWeatherCheckForUser, 
  executeMarketAnalysisForUser 
} from './scheduler';
import * as db from '../db';

/**
 * Cron Job Service
 * Handles periodic tasks execution
 */
class CronJobService {
  private weatherCheckJob: NodeJS.Timeout | null = null;
  private marketAlertJob: NodeJS.Timeout | null = null;
  private isRunning = false;

  /**
   * Start cron jobs
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    logger.log({
      service: 'cron_service',
      action: 'start',
      level: 'info',
      status: 'success',
      message: 'Cron job service started',
    });

    // Run weather check every 6 hours
    this.weatherCheckJob = setInterval(() => {
      this.executeWeatherCheckJob();
    }, 6 * 60 * 60 * 1000);

    // Run market alert every 12 hours
    this.marketAlertJob = setInterval(() => {
      this.executeMarketAlertJob();
    }, 12 * 60 * 60 * 1000);

    // Initial execution after 1 minute
    setTimeout(() => {
      this.executeWeatherCheckJob();
      this.executeMarketAlertJob();
    }, 60 * 1000);
  }

  /**
   * Stop cron jobs
   */
  stop(): void {
    if (this.weatherCheckJob) clearInterval(this.weatherCheckJob);
    if (this.marketAlertJob) clearInterval(this.marketAlertJob);
    this.isRunning = false;

    logger.log({
      service: 'cron_service',
      action: 'stop',
      level: 'info',
      status: 'success',
      message: 'Cron job service stopped',
    });
  }

  /**
   * Execute daily weather check for all users
   */
  async executeWeatherCheckJob(): Promise<void> {
    logger.log({
      service: 'cron_jobs',
      action: 'weather_check',
      level: 'info',
      status: 'pending',
      message: 'Starting weather check cron job',
    });

    try {
      // Get all users from database
      const users = await db.getAllUsersWithSettings();

      let successCount = 0;
      let failureCount = 0;

      for (const user of users) {
        try {
          // Check if user has telegram configured
          if (user.telegramToken && user.telegramChatId && user.enableWeatherNotifications) {
            await executeWeatherCheckForUser(
              user.userId,
              user.telegramToken,
              user.telegramChatId,
              user.minHumidity || 50,
              user.maxHumidity || 90,
              user.maxTemperature || 30,
              user.maxWindSpeed || 15
            );
            successCount++;
          }
        } catch (error) {
          failureCount++;
          logger.log({
            service: 'cron_jobs',
            action: 'weather_check_user',
            level: 'error',
            status: 'failed',
            userId: user.userId,
            message: `Failed to execute weather check for user ${user.userId}`,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      logger.log({
        service: 'cron_jobs',
        action: 'weather_check',
        level: 'info',
        status: 'success',
        message: 'Weather check cron job completed',
        metadata: { total: users.length, success: successCount, failed: failureCount },
      });
    } catch (error) {
      logger.log({
        service: 'cron_jobs',
        action: 'weather_check',
        level: 'error',
        status: 'failed',
        message: 'Weather check cron job failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Execute daily market alert for all users
   */
  async executeMarketAlertJob(): Promise<void> {
    logger.log({
      service: 'cron_jobs',
      action: 'market_alert',
      level: 'info',
      status: 'pending',
      message: 'Starting market alert cron job',
    });

    try {
      // Get all users from database
      const users = await db.getAllUsersWithSettings();

      let successCount = 0;
      let failureCount = 0;

      for (const user of users) {
        try {
          // Check if user has telegram configured
          if (user.telegramToken && user.telegramChatId && user.enableMarketNotifications) {
            await executeMarketAnalysisForUser(
              user.userId,
              user.telegramToken,
              user.telegramChatId
            );
            successCount++;
          }
        } catch (error) {
          failureCount++;
          logger.log({
            service: 'cron_jobs',
            action: 'market_alert_user',
            level: 'error',
            status: 'failed',
            userId: user.userId,
            message: `Failed to execute market alert for user ${user.userId}`,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      logger.log({
        service: 'cron_jobs',
        action: 'market_alert',
        level: 'info',
        status: 'success',
        message: 'Market alert cron job completed',
        metadata: { total: users.length, success: successCount, failed: failureCount },
      });
    } catch (error) {
      logger.log({
        service: 'cron_jobs',
        action: 'market_alert',
        level: 'error',
        status: 'failed',
        message: 'Market alert cron job failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get service status
   */
  getStatus(): {
    isRunning: boolean;
  } {
    return {
      isRunning: this.isRunning,
    };
  }
}

export const cronJobService = new CronJobService();
