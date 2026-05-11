import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { jobsRouter } from "./routers/jobs";
import { z } from "zod";
import * as db from "./db";
import { TRPCError } from "@trpc/server";

export const appRouter = router({
  system: systemRouter,
  jobs: jobsRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // ============================================================================
  // SETTINGS PROCEDURES
  // ============================================================================
  settings: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const settings = await db.getUserSettings(ctx.user.id);
      if (!settings) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User settings not found',
        });
      }
      return settings;
    }),

    update: protectedProcedure
      .input(z.object({
        telegramToken: z.string().optional(),
        telegramChatId: z.string().optional(),
        minHumidity: z.number().min(0).max(100).optional(),
        maxHumidity: z.number().min(0).max(100).optional(),
        maxTemperature: z.number().optional(),
        maxWindSpeed: z.number().optional(),
        monitoredCrops: z.array(z.string()).optional(),
        marketAlertFrequency: z.enum(['daily', 'weekly']).optional(),
        monitoredInputs: z.array(z.string()).optional(),
        enableWeatherNotifications: z.boolean().optional(),
        enableMarketNotifications: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.upsertUserSettings(ctx.user.id, input);
        return { success: true };
      }),
  }),

  // ============================================================================
  // WEATHER PROCEDURES
  // ============================================================================
  weather: router({
    getCurrent: protectedProcedure.query(async ({ ctx }) => {
      const latest = await db.getLatestWeatherLog(ctx.user.id);
      if (!latest) {
        return null;
      }
      return latest;
    }),

    getHistory: protectedProcedure
      .input(z.object({
        days: z.number().min(1).max(30).default(7),
      }))
      .query(async ({ ctx, input }) => {
        return db.getWeatherHistory(ctx.user.id, input.days);
      }),

    // This is called by the scheduled job (internal)
    recordWeather: protectedProcedure
      .input(z.object({
        temperature: z.number(),
        humidity: z.number(),
        windSpeed: z.number(),
        hourlyForecast: z.array(z.object({
          hour: z.number(),
          temperature: z.number(),
          humidity: z.number(),
          windSpeed: z.number(),
          isRecommended: z.boolean(),
          classification: z.enum(['excelente', 'boa', 'moderada', 'ruim', 'nao-recomendada']),
        })),
        applicationWindowStart: z.number().nullable().optional(),
        applicationWindowEnd: z.number().nullable().optional(),
        isApplicationRecommended: z.boolean(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createWeatherLog({
          userId: ctx.user.id,
          temperature: input.temperature.toString() as any,
          humidity: input.humidity,
          windSpeed: input.windSpeed.toString() as any,
          hourlyForecast: input.hourlyForecast,
          applicationWindowStart: input.applicationWindowStart ?? null,
          applicationWindowEnd: input.applicationWindowEnd ?? null,
          isApplicationRecommended: input.isApplicationRecommended,
          source: 'openweathermap',
          recordedAt: new Date(),
        });
        return { success: true };
      }),
  }),

  // ============================================================================
  // MARKET ALERTS PROCEDURES
  // ============================================================================
  marketAlerts: router({
    list: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(50).default(10),
      }))
      .query(async ({ ctx, input }) => {
        return db.getMarketAlerts(ctx.user.id, input.limit);
      }),

    create: protectedProcedure
      .input(z.object({
        title: z.string(),
        summary: z.string(),
        aiAnalysis: z.string().optional(),
        affectedInputs: z.array(z.string()),
        affectedCrops: z.array(z.string()),
        impactLevel: z.enum(['low', 'medium', 'high']),
        source: z.string().optional(),
        sourceUrl: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createMarketAlert({
          userId: ctx.user.id,
          title: input.title,
          summary: input.summary,
          aiAnalysis: input.aiAnalysis || null,
          affectedInputs: input.affectedInputs,
          affectedCrops: input.affectedCrops,
          impactLevel: input.impactLevel,
          source: input.source || null,
          sourceUrl: input.sourceUrl || null,
          notificationSent: false,
          notificationSentAt: null,
        });
        return { success: true };
      }),

    markNotificationSent: protectedProcedure
      .input(z.object({
        alertId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateMarketAlert(input.alertId, {
          notificationSent: true,
          notificationSentAt: new Date(),
        });
        return { success: true };
      }),
  }),

  // ============================================================================
  // NOTIFICATION HISTORY PROCEDURES
  // ============================================================================
  notifications: router({
    getHistory: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(50).default(20),
      }))
      .query(async ({ ctx, input }) => {
        return db.getNotificationHistory(ctx.user.id, input.limit);
      }),
  }),
});

export type AppRouter = typeof appRouter;
