import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import { executeWeatherCheckForUser, executeMarketAnalysisForUser } from '../services/scheduler';
import { logger } from '../services/logger';
import { telegramService } from '../services/telegram';
import { cacheService, deduplicationService, rateLimiter } from '../services/cache';
import * as db from '../db';

/**
 * Jobs router - Manual execution and testing endpoints
 */
export const jobsRouter = router({
  /**
   * Manually trigger weather check for current user
   */
  triggerWeatherCheck: protectedProcedure.mutation(async ({ ctx }) => {
    logger.log({
      service: 'jobs',
      action: 'trigger_weather_check',
      level: 'info',
      status: 'pending',
      userId: ctx.user.id,
      message: 'Manual weather check triggered',
    });

    try {
      // Get user settings
      const settings = await db.getUserSettings(ctx.user.id);
      if (!settings) {
        throw new Error('User settings not found');
      }

      // Execute weather check
      await executeWeatherCheckForUser(
        ctx.user.id,
        settings.telegramToken,
        settings.telegramChatId,
        settings.minHumidity,
        settings.maxHumidity,
        settings.maxTemperature,
        settings.maxWindSpeed
      );

      return {
        success: true,
        message: 'Weather check executed successfully',
      };
    } catch (error) {
      logger.log({
        service: 'jobs',
        action: 'trigger_weather_check',
        level: 'error',
        status: 'failed',
        userId: ctx.user.id,
        message: 'Weather check failed',
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }),

  /**
   * Manually trigger market analysis for current user
   */
  triggerMarketAnalysis: protectedProcedure.mutation(async ({ ctx }) => {
    logger.log({
      service: 'jobs',
      action: 'trigger_market_analysis',
      level: 'info',
      status: 'pending',
      userId: ctx.user.id,
      message: 'Manual market analysis triggered',
    });

    try {
      // Get user settings
      const settings = await db.getUserSettings(ctx.user.id);
      if (!settings) {
        throw new Error('User settings not found');
      }

      // Execute market analysis
      await executeMarketAnalysisForUser(
        ctx.user.id,
        settings.telegramToken,
        settings.telegramChatId
      );

      return {
        success: true,
        message: 'Market analysis executed successfully',
      };
    } catch (error) {
      logger.log({
        service: 'jobs',
        action: 'trigger_market_analysis',
        level: 'error',
        status: 'failed',
        userId: ctx.user.id,
        message: 'Market analysis failed',
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }),

  /**
   * Send test message to Telegram
   */
  sendTestTelegramMessage: protectedProcedure
    .input(
      z.object({
        priority: z.enum(['low', 'normal', 'high', 'critical']).default('normal'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      logger.log({
        service: 'jobs',
        action: 'send_test_telegram',
        level: 'info',
        status: 'pending',
        userId: ctx.user.id,
        message: 'Test Telegram message triggered',
      });

      try {
        // Get user settings
        const settings = await db.getUserSettings(ctx.user.id);
        if (!settings) {
          throw new Error('User settings not found');
        }

        // Send test message
        const testMessage = `✅ <b>Teste de Conexão - AgroIntel Canarana</b>\n\nSeu sistema está funcionando corretamente!\n\nPrioridade: ${input.priority}\nHorário: ${new Date().toLocaleString('pt-BR')}`;

        const success = await telegramService.sendMessage(
          settings.telegramToken,
          settings.telegramChatId,
          testMessage,
          input.priority
        );

        if (!success) {
          throw new Error('Failed to send Telegram message');
        }

        return {
          success: true,
          message: 'Test message sent successfully',
        };
      } catch (error) {
        logger.log({
          service: 'jobs',
          action: 'send_test_telegram',
          level: 'error',
          status: 'failed',
          userId: ctx.user.id,
          message: 'Test Telegram message failed',
          error: error instanceof Error ? error.message : String(error),
        });

        throw error;
      }
    }),

  /**
   * Get system logs
   */
  getLogs: protectedProcedure
    .input(
      z.object({
        service: z.string().optional(),
        level: z.enum(['debug', 'info', 'warn', 'error', 'critical']).optional(),
        limit: z.number().default(100),
      })
    )
    .query(({ input }) => {
      return logger.getLogs({
        service: input.service,
        level: input.level,
        limit: input.limit,
      });
    }),

  /**
   * Get recent errors
   */
  getRecentErrors: protectedProcedure
    .input(z.object({ limit: z.number().default(20) }))
    .query(({ input }) => {
      return logger.getRecentErrors(input.limit);
    }),

  /**
   * Get Telegram queue status
   */
  getTelegramQueueStatus: protectedProcedure.query(() => {
    return telegramService.getQueueStatus();
  }),

  /**
   * Get cache statistics
   */
  getCacheStats: protectedProcedure.query(() => {
    return cacheService.getStats();
  }),

  /**
   * Get deduplication statistics
   */
  getDeduplicationStats: protectedProcedure.query(() => {
    return deduplicationService.getStats();
  }),

  /**
   * Get rate limiter statistics
   */
  getRateLimiterStats: protectedProcedure.query(() => {
    return rateLimiter.getStats();
  }),

  /**
   * System health check
   */
  healthCheck: protectedProcedure.query(async ({ ctx }) => {
    const checks = {
      database: 'unknown',
      telegram: 'unknown',
      cache: 'ok',
      deduplication: 'ok',
      rateLimiter: 'ok',
      logger: 'ok',
    };

    try {
      // Check database
      const settings = await db.getUserSettings(ctx.user.id);
      checks.database = settings ? 'ok' : 'error';
    } catch {
      checks.database = 'error';
    }

    try {
      // Check Telegram (just verify settings exist)
      const settings = await db.getUserSettings(ctx.user.id);
      checks.telegram = settings?.telegramToken ? 'ok' : 'warning';
    } catch {
      checks.telegram = 'error';
    }

    const timestamp = new Date().toISOString();
    const allOk = Object.values(checks).every((v) => v === 'ok');

    return {
      timestamp,
      status: allOk ? 'healthy' : 'degraded',
      checks,
      stats: {
        cache: cacheService.getStats(),
        deduplication: deduplicationService.getStats(),
        rateLimiter: rateLimiter.getStats(),
      },
    };
  }),

  /**
   * Clear cache (admin only - for testing)
   */
  clearCache: protectedProcedure.mutation(({ ctx }) => {
    if (ctx.user.role !== 'admin') {
      throw new Error('Only admins can clear cache');
    }

    cacheService.clear();
    deduplicationService.cleanup();
    rateLimiter.reset('all');

    logger.log({
      service: 'jobs',
      action: 'clear_cache',
      level: 'warn',
      status: 'success',
      userId: ctx.user.id,
      message: 'Cache cleared by admin',
    });

    return { success: true, message: 'Cache cleared' };
  }),

  /**
   * Get job execution history
   */
  getExecutionHistory: protectedProcedure
    .input(
      z.object({
        jobType: z.enum(['weather_check', 'market_analysis']).optional(),
        limit: z.number().default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      // This would query the scheduledJobs table
      // For now, return mock data
      return {
        jobs: [],
        total: 0,
      };
    }),
});
