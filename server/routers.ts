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
    get: protectedProcedure
      .input(z.object({
        farmId: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const settings = await db.getUserSettings(ctx.user.id, input.farmId);
        if (!settings) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User settings not found for this farm',
          });
        }
        return settings;
      }),

    update: protectedProcedure
      .input(z.object({
        farmId: z.number(),
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
        const { farmId, ...settings } = input;
        await db.upsertUserSettings(ctx.user.id, farmId, settings);
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
        farmId: z.number(),
        days: z.number().min(1).max(30).default(7),
      }))
      .query(async ({ ctx, input }) => {
        return db.getWeatherHistory(ctx.user.id, input.farmId, input.days);
      }),

    // This is called by the scheduled job (internal)
    recordWeather: protectedProcedure
      .input(z.object({
        farmId: z.number(),
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
          farmId: input.farmId,
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
        farmId: z.number(),
        limit: z.number().min(1).max(50).default(10),
      }))
      .query(async ({ ctx, input }) => {
        return db.getMarketAlerts(ctx.user.id, input.farmId, input.limit);
      }),

    create: protectedProcedure
      .input(z.object({
        farmId: z.number(),
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
          farmId: input.farmId,
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
  // FARMS PROCEDURES
  // ============================================================================
  farms: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserFarms(ctx.user.id);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const farm = await db.getFarmById(input.id);
        if (!farm || farm.userId !== ctx.user.id) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Farm not found',
          });
        }
        return farm;
      }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(255),
        municipio: z.string().min(1).max(255),
        latitude: z.string().or(z.number()).transform(String),
        longitude: z.string().or(z.number()).transform(String),
        altitude: z.string().or(z.number()).optional().transform(v => v ? String(v) : undefined),
        mainCrop: z.string().min(1).max(64),
        agriculturalWindowStart: z.number().min(1).max(12).optional(),
        agriculturalWindowEnd: z.number().min(1).max(12).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const farm = await db.createFarm({
          userId: ctx.user.id,
          ...input,
        });
        if (!farm) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create farm',
          });
        }
        return farm;
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        municipio: z.string().min(1).max(255).optional(),
        latitude: z.string().or(z.number()).optional().transform(v => v ? String(v) : undefined),
        longitude: z.string().or(z.number()).optional().transform(v => v ? String(v) : undefined),
        altitude: z.string().or(z.number()).optional().transform(v => v ? String(v) : undefined),
        mainCrop: z.string().min(1).max(64).optional(),
        agriculturalWindowStart: z.number().min(1).max(12).optional(),
        agriculturalWindowEnd: z.number().min(1).max(12).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const farm = await db.getFarmById(input.id);
        if (!farm || farm.userId !== ctx.user.id) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Farm not found',
          });
        }
        const { id, ...updates } = input;
        const updated = await db.updateFarm(id, updates);
        return updated;
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const farm = await db.getFarmById(input.id);
        if (!farm || farm.userId !== ctx.user.id) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Farm not found',
          });
        }
        await db.deleteFarm(input.id);
        return { success: true };
      }),

    selectActive: protectedProcedure
      .input(z.object({ farmId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const farm = await db.getFarmById(input.farmId);
        if (!farm) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Farm not found',
          });
        }
        const userFarms = await db.getUserFarms(ctx.user.id);
        if (!userFarms.find(f => f.id === input.farmId)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You do not have access to this farm',
          });
        }
        await db.updateUser(ctx.user.id, { currentFarmId: input.farmId });
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

   healthcheck: router({
    check: publicProcedure.query(async () => {
      const { healthCheckService } = await import('./services/healthcheck');
      return await healthCheckService.runHealthCheck();
    }),
  }),

  // ============================================================================
  // CROPS — Catálogo Agronômico por Fazenda (Fase 5 — Módulo 1)
  // ============================================================================
  crops: router({
    /**
     * Lista todas as culturas ativas de uma fazenda.
     */
    list: protectedProcedure
      .input(z.object({ farmId: z.number() }))
      .query(async ({ ctx, input }) => {
        // Valida que o usuário tem acesso à fazenda
        const userFarms = await db.getUserFarms(ctx.user.id);
        if (!userFarms.find(f => f.id === input.farmId)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado a esta fazenda.' });
        }
        return db.getCropsByFarm(input.farmId);
      }),

    /**
     * Retorna uma cultura pelo id.
     */
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const crop = await db.getCropById(input.id);
        if (!crop) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cultura não encontrada.' });
        // Valida acesso à fazenda
        const userFarms = await db.getUserFarms(ctx.user.id);
        if (!userFarms.find(f => f.id === crop.farmId)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado a esta fazenda.' });
        }
        return crop;
      }),

    /**
     * Cria ou atualiza uma cultura para uma fazenda.
     */
    upsert: protectedProcedure
      .input(z.object({
        farmId: z.number(),
        name: z.string().min(1).max(64),
        displayName: z.string().min(1).max(128),
        variety: z.string().max(128).optional(),
        plantingWindowStart: z.number().min(1).max(12),
        plantingWindowEnd: z.number().min(1).max(12),
        harvestWindowStart: z.number().min(1).max(12),
        harvestWindowEnd: z.number().min(1).max(12),
        cycleDays: z.number().min(1),
        minTempSpray: z.number(),
        maxTempSpray: z.number(),
        minHumiditySpray: z.number().min(0).max(100),
        maxHumiditySpray: z.number().min(0).max(100),
        maxWindSpeedSpray: z.number().min(0),
        minDeltaT: z.number(),
        maxDeltaT: z.number(),
        nitrogenKgHa: z.number().optional(),
        phosphorusKgHa: z.number().optional(),
        potassiumKgHa: z.number().optional(),
        sulfurKgHa: z.number().optional(),
        expectedYieldBagHa: z.number().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const userFarms = await db.getUserFarms(ctx.user.id);
        if (!userFarms.find(f => f.id === input.farmId)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado a esta fazenda.' });
        }
        await db.upsertCrop({
          ...input,
          minTempSpray: String(input.minTempSpray),
          maxTempSpray: String(input.maxTempSpray),
          maxWindSpeedSpray: String(input.maxWindSpeedSpray),
          minDeltaT: String(input.minDeltaT),
          maxDeltaT: String(input.maxDeltaT),
          nitrogenKgHa: input.nitrogenKgHa != null ? String(input.nitrogenKgHa) : null,
          phosphorusKgHa: input.phosphorusKgHa != null ? String(input.phosphorusKgHa) : null,
          potassiumKgHa: input.potassiumKgHa != null ? String(input.potassiumKgHa) : null,
          sulfurKgHa: input.sulfurKgHa != null ? String(input.sulfurKgHa) : null,
          expectedYieldBagHa: input.expectedYieldBagHa != null ? String(input.expectedYieldBagHa) : null,
          isActive: true,
        });
        return { success: true };
      }),

    /**
     * Desativa (soft delete) uma cultura.
     */
    deactivate: protectedProcedure
      .input(z.object({ id: z.number(), farmId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const userFarms = await db.getUserFarms(ctx.user.id);
        if (!userFarms.find(f => f.id === input.farmId)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado a esta fazenda.' });
        }
        await db.deactivateCrop(input.id, input.farmId);
        return { success: true };
      }),

    /**
     * Analisa condições climáticas para uma cultura específica (Motor Climático Agronômico).
     */
    analyzeConditions: protectedProcedure
      .input(z.object({
        cropName: z.string(),
        temperature: z.number(),
        humidity: z.number(),
        windSpeed: z.number(),
        rainProbability: z.number().min(0).max(100).optional(),
      }))
      .query(async ({ input }) => {
        const { analyzeAgronomicConditions } = await import('./services/agronomyService');
        return analyzeAgronomicConditions(
          {
            temperature: input.temperature,
            humidity: input.humidity,
            windSpeed: input.windSpeed,
            rainProbability: input.rainProbability,
          },
          input.cropName
        );
      }),

    /**
     * Retorna o status de safra (janela de plantio/colheita) para o mês atual.
     */
    seasonStatus: protectedProcedure
      .input(z.object({ cropName: z.string() }))
      .query(async ({ input }) => {
        const { getCropSeasonStatus } = await import('./services/agronomyService');
        const currentMonth = new Date().getMonth() + 1;
        return getCropSeasonStatus(input.cropName, currentMonth);
      }),

    /**
     * Bootstrap: insere as 5 culturas-padrão para uma fazenda recém-criada.
     */
    bootstrapDefaults: protectedProcedure
      .input(z.object({ farmId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const userFarms = await db.getUserFarms(ctx.user.id);
        if (!userFarms.find(f => f.id === input.farmId)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado a esta fazenda.' });
        }
        const { getDefaultCropsForFarm } = await import('./services/agronomyService');
        const defaultCrops = getDefaultCropsForFarm(input.farmId);
        await db.insertCropsBatch(defaultCrops);
        return { success: true, count: defaultCrops.length };
      }),
  }),
});
export type AppRouter = typeof appRouter;
