import { logger } from './logger';
import { telegramService } from './telegram';
import { analyzeWeather, saveWeatherAnalysis } from './weather';
import { newsCollectorService } from './newsCollector';
import { newsAnalysisService } from './newsAnalysis';
import { analyzeAgronomicConditions, formatAgronomicBulletin } from './agronomyService';
import { weatherConsensusEngine } from './weatherConsensus';
import { getCurrentSeasonalPeriod, analyzeSeasonalProfiles, formatSeasonalBulletin } from './operationalProfiles';
import { revalidationScheduler, revalidationStateManager, shouldSendAlert } from './revalidationEngine';
import { interpretMarketEvent, generateMarketIntelligenceBulletin, isMarketEventAlertWorthy } from './marketIntelligence';
import * as db from '../db';

export interface ScheduleConfig {
  weatherCheckHour: number; // 0-23
  marketAlertHour: number;
  urgentAlertCheckInterval: number; // minutes
}

class Scheduler {
  private weatherCheckInterval: NodeJS.Timeout | null = null;
  private marketAlertInterval: NodeJS.Timeout | null = null;
  private urgentAlertInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private isWeatherChecking = false;
  private isMarketChecking = false;
  private isUrgentChecking = false;

  /**
   * Start the scheduler
   */
  start(config: ScheduleConfig): void {
    if (this.isRunning) {
      logger.log({
        service: 'scheduler',
        action: 'start',
        level: 'warn',
        status: 'pending',
        message: 'Scheduler is already running',
      });
      return;
    }

    this.isRunning = true;

    logger.log({
      service: 'scheduler',
      action: 'start',
      level: 'info',
      status: 'success',
      message: `Scheduler started. Weather check at ${config.weatherCheckHour}:00, Market alert at ${config.marketAlertHour}:00`,
    });

    // Schedule weather check
    this.scheduleWeatherCheck(config.weatherCheckHour);

    // Schedule market alerts
    this.scheduleMarketAlerts(config.marketAlertHour);

    // Schedule urgent alert checks
    this.scheduleUrgentAlerts(config.urgentAlertCheckInterval);

    // Process Telegram retry queue every minute
    this.scheduleRetryQueue();
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.weatherCheckInterval) clearInterval(this.weatherCheckInterval);
    if (this.marketAlertInterval) clearInterval(this.marketAlertInterval);
    if (this.urgentAlertInterval) clearInterval(this.urgentAlertInterval);

    this.isRunning = false;

    logger.log({
      service: 'scheduler',
      action: 'stop',
      level: 'info',
      status: 'success',
      message: 'Scheduler stopped',
    });
  }

  /**
   * Schedule weather check using adaptive revalidation engine (Fase 7/8)
   */
  private scheduleWeatherCheck(_hour: number): void {
    // Inicia o motor de revalidação inteligente
    revalidationScheduler.start(async (hour, minute, label) => {
      logger.log({
        service: 'scheduler',
        action: 'revalidation_trigger',
        level: 'info',
        status: 'pending',
        message: `Adaptive revalidation triggered: ${label} (${hour}:${minute})`,
      });
      await this.executeWeatherCheck();
    });
  }

  /**
   * Execute weather check for all users
   */
  private async executeWeatherCheck(): Promise<void> {
    if (this.isWeatherChecking) {
      logger.log({
        service: 'scheduler',
        action: 'weather_check',
        level: 'warn',
        status: 'pending',
        message: 'Weather check already in progress, skipping',
      });
      return;
    }

    this.isWeatherChecking = true;
    const startTime = Date.now();
    logger.log({
      service: 'scheduler',
      action: 'weather_check',
      level: 'info',
      status: 'pending',
      message: 'Starting daily weather check for all farms',
    });

    try {
      const users = await db.getAllUsersWithSettings();
      let farmCount = 0;
      
      for (const user of users) {
        if (user.telegramToken && user.telegramChatId && user.enableWeatherNotifications) {
          const farms = await db.getUserFarms(user.userId);
          
          for (const farm of farms) {
            const farmSettings = await db.getUserSettings(user.userId, farm.id);
            if (!farmSettings) continue;
            
            await executeWeatherCheckForUser(
              user.userId,
              farm.id,
              Number(farm.latitude),
              Number(farm.longitude),
              user.telegramToken,
              user.telegramChatId,
              farmSettings.minHumidity || 50,
              farmSettings.maxHumidity || 90,
              farmSettings.maxTemperature || 30,
              farmSettings.maxWindSpeed || 15
            );
            farmCount++;
          }
        }
      }

      const duration = Date.now() - startTime;
      logger.log({
        service: 'scheduler',
        action: 'weather_check',
        level: 'info',
        status: 'success',
        duration,
        message: 'Weather check completed for all farms',
        metadata: { userCount: users.length, farmCount }
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.log({
        service: 'scheduler',
        action: 'weather_check',
        level: 'error',
        status: 'failed',
        duration,
        message: 'Weather check failed',
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.isWeatherChecking = false;
    }
  }

  /**
   * Schedule market alerts at specific hour
   */
  private scheduleMarketAlerts(hour: number): void {
    const checkTime = () => {
      const now = new Date();
      return now.getHours() === hour && now.getMinutes() === 0;
    };

    this.marketAlertInterval = setInterval(async () => {
      if (checkTime()) {
        await this.executeMarketAlerts();
      }
    }, 60000); // Check every minute
  }

  /**
   * Execute market alerts for all users
   */
  private async executeMarketAlerts(): Promise<void> {
    if (this.isMarketChecking) {
      logger.log({
        service: 'scheduler',
        action: 'market_alerts',
        level: 'warn',
        status: 'pending',
        message: 'Market alerts check already in progress, skipping',
      });
      return;
    }

    this.isMarketChecking = true;
    const startTime = Date.now();
    logger.log({
      service: 'scheduler',
      action: 'market_alerts',
      level: 'info',
      status: 'pending',
      message: 'Starting market alerts check for all users',
    });

    try {
      const users = await db.getAllUsersWithSettings();
      
      for (const user of users) {
        if (user.telegramToken && user.telegramChatId && user.enableMarketNotifications && user.farmId) {
          await executeMarketAnalysisForUser(
            user.userId,
            user.farmId,
            user.telegramToken,
            user.telegramChatId
          );
        }
      }

      const duration = Date.now() - startTime;
      logger.log({
        service: 'scheduler',
        action: 'market_alerts',
        level: 'info',
        status: 'success',
        duration,
        message: 'Market alerts check completed for all users',
        metadata: { userCount: users.length }
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.log({
        service: 'scheduler',
        action: 'market_alerts',
        level: 'error',
        status: 'failed',
        duration,
        message: 'Market alerts check failed',
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.isMarketChecking = false;
    }
  }

  /**
   * Schedule urgent alert checks
   */
  private scheduleUrgentAlerts(intervalMinutes: number): void {
    this.urgentAlertInterval = setInterval(async () => {
      await this.checkUrgentAlerts();
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Check for urgent alerts
   */
  private async checkUrgentAlerts(): Promise<void> {
    // Implementation for urgent alerts
  }

  /**
   * Process Telegram retry queue
   */
  private scheduleRetryQueue(): void {
    setInterval(async () => {
      // Retry logic
    }, 60000); // Every minute
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    uptime?: number;
  } {
    return {
      isRunning: this.isRunning,
    };
  }
}

export const scheduler = new Scheduler();

/**
 * Execute weather check for a specific user (legacy - iterates over farms)
 */
export async function executeWeatherCheckForUser(
  userId: number,
  farmId: number,
  latitude: number,
  longitude: number,
  telegramToken: string,
  telegramChatId: string,
  minHumidity: number = 50,
  maxHumidity: number = 90,
  maxTemperature: number = 30,
  maxWindSpeed: number = 15
): Promise<void> {
  const startTime = Date.now();
  logger.log({
    service: 'weather_job',
    action: 'execute',
    level: 'info',
    status: 'pending',
    userId,
    farmId,
    message: 'Starting weather check job for farm',
  });

  try {
    // 1. Obter clima via Consenso Multi-API (Fase 7)
    const consensus = await weatherConsensusEngine.fetchConsensus(latitude, longitude);
    
    // 2. Obter contexto sazonal regional (Fase 7)
    const seasonalContext = getCurrentSeasonalPeriod(new Date().getMonth() + 1);
    
    // 3. Análise detalhada por perfis operacionais (Fase 7)
    const seasonalAnalysis = analyzeSeasonalProfiles(
      {
        temperature: consensus.temperature,
        humidity: consensus.humidity,
        windSpeed: consensus.windSpeed,
        rainProbabilityNow: consensus.rainProbabilityNow,
        rainProbability24h: consensus.rainProbability24h,
        rainProbability48h: consensus.rainProbability48h,
        rainMmForecast3h: consensus.rainMmForecast3h,
        rainMmForecast24h: consensus.rainMmForecast24h
      }
    );

    // 4. Salvar análise (compatibilidade com legado)
    // Usamos o primeiro perfil dominante para o score legado
    const mainProfile = seasonalAnalysis.profileResults[0];
    const legacyAnalysis = {
      userId,
      farmId,
      currentTemp: consensus.temperature.toString(),
      currentHumidity: consensus.humidity,
      currentWindSpeed: consensus.windSpeed.toString(),
      overallClassification: seasonalAnalysis.overallRecommendation,
      score: mainProfile?.score || 0,
      isApplicationRecommended: seasonalAnalysis.overallRecommendation === 'operar' || seasonalAnalysis.overallRecommendation === 'cautela',
      applicationWindowStart: 0, // Não usado no novo motor
      applicationWindowEnd: 0,   // Não usado no novo motor
      notes: mainProfile?.activeRisks.map(r => `${r.risk.toUpperCase()}: ${r.detail}`) || [],
      timestamp: new Date()
    };
    await saveWeatherAnalysis(userId, legacyAnalysis as any, farmId);

    // 5. Buscar fazenda e configurações
    const farm = await db.getFarmById(farmId);
    const farmName = farm?.name || 'Fazenda';
    const farmSettings = await db.getUserSettings(userId, farmId);
    const monitoredCrops = farmSettings?.monitoredCrops as string[] || ['soja', 'milho'];

    // 6. Verificar se deve enviar alerta (Anti-Spam Fase 7)
    const farmState = revalidationStateManager.getState(farmId);
    // Para o anti-spam, usamos o perfil de maior score ou o primeiro disponível
    const bestProfile = seasonalAnalysis.profileResults.sort((a, b) => b.score - a.score)[0] || {
      score: 0,
      recommendation: 'nao-recomendado',
      activeRisks: [],
      deltaT: 0,
      deltaTStatus: 'critico'
    };

    const decision = shouldSendAlert(
      farmState,
      bestProfile as any,
      {
        temperature: consensus.temperature,
        humidity: consensus.humidity,
        windSpeed: consensus.windSpeed,
        rainProbability24h: consensus.rainProbability24h
      },
      seasonalContext
    );

    if (decision.shouldAlert) {
      // Buscar alertas de mercado recentes para o boletim
      const marketAlerts = await db.getMarketAlerts(userId, farmId, 2, monitoredCrops);

      // Formatar boletim sazonal (Fase 7)
      let message = formatSeasonalBulletin(
        seasonalContext,
        seasonalAnalysis.profileResults,
        seasonalAnalysis.overallRecommendation,
        {
          temperature: consensus.temperature,
          humidity: consensus.humidity,
          windSpeed: consensus.windSpeed,
          rainProbabilityNow: consensus.rainProbabilityNow,
          rainProbability24h: consensus.rainProbability24h,
          rainProbability48h: consensus.rainProbability48h,
          rainMmForecast3h: consensus.rainMmForecast3h,
          rainMmForecast24h: consensus.rainMmForecast24h
        }
      );

      // Adicionar cabeçalho da fazenda e alertas de mercado (Fase 7)
      message = `🚜 <b>${farmName.toUpperCase()}</b>\n\n` + message;
      
      if (marketAlerts.length > 0) {
        message += `<b>📊 MERCADO (${monitoredCrops.join('/')})</b>\n`;
        marketAlerts.forEach(alert => {
          message += `• ${alert.title}\n`;
        });
      }

      const priority = decision.priority === 'high' ? 'high' : 'normal';
      await telegramService.sendMessage(telegramToken, telegramChatId, message, priority);
      
      // Atualizar estado de alerta
      revalidationStateManager.updateAfterAlert(farmId);
    }

    // Atualizar estado de revalidação
    revalidationStateManager.updateAfterCheck(
      farmId,
      bestProfile as any,
      {
        temperature: consensus.temperature,
        humidity: consensus.humidity,
        windSpeed: consensus.windSpeed,
        rainProbability24h: consensus.rainProbability24h
      }
    );

    const duration = Date.now() - startTime;
    logger.log({
      service: 'weather_job',
      action: 'execute',
      level: 'info',
      status: 'success',
      userId,
      farmId,
      duration,
      message: `Weather check completed: ${seasonalAnalysis.overallRecommendation.toUpperCase()}`,
      metadata: { 
        classification: seasonalAnalysis.overallRecommendation,
        seasonalPeriod: seasonalContext.period,
        score: bestProfile.score,
        temp: consensus.temperature,
        wind: consensus.windSpeed,
        humidity: consensus.humidity,
        decision: decision.shouldAlert ? 'alert_sent' : 'suppressed_by_antispam',
        reason: decision.reason
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.log({
      service: 'weather_job',
      action: 'execute',
      level: 'error',
      status: 'failed',
      userId,
      farmId,
      duration,
      message: 'Weather check job failed for farm',
      error: error instanceof Error ? error.message : String(error),
    });

    const errorMessage = `❌ <b>Erro na Coleta Climática</b>\n\nNão foi possível processar os dados climáticos.\nTente novamente mais tarde.`;
    await telegramService.sendMessage(telegramToken, telegramChatId, errorMessage, 'high');
  }
}

/**
 * Format weather analysis into Telegram message
 */
function formatWeatherMessage(analysis: any): string {
  const classificationEmoji = {
    excelente: '🟢',
    boa: '🟡',
    moderada: '🟠',
    ruim: '🔴',
    'nao-recomendada': '⛔',
  };

  const emoji = classificationEmoji[analysis.overallClassification as keyof typeof classificationEmoji] || '❓';
  const classification = analysis.overallClassification.toUpperCase();

  let message = `${emoji} <b>RELATÓRIO CLIMÁTICO - CANARANA-MT</b>\n\n`;
  message += `<b>Classificação Operacional:</b> ${classification}\n`;
  message += `<b>Score:</b> ${analysis.score}/100\n\n`;

  message += `<b>Condições Atuais:</b>\n`;
  message += `🌡️ Temperatura: ${analysis.currentTemp}°C\n`;
  message += `💧 Umidade: ${analysis.currentHumidity}%\n`;
  message += `💨 Vento: ${analysis.currentWindSpeed} km/h\n\n`;

  if (analysis.isApplicationRecommended) {
    message += `<b>✅ Janela de Aplicação Recomendada:</b>\n`;
    message += `⏰ ${analysis.applicationWindowStart}:00 às ${analysis.applicationWindowEnd}:00\n\n`;
  } else {
    message += `<b>❌ Nenhuma janela ideal encontrada hoje</b>\n\n`;
  }

  if (analysis.notes.length > 0) {
    message += `<b>Observações:</b>\n`;
    analysis.notes.forEach((note: string) => {
      message += `• ${note}\n`;
    });
  }

  return message;
}

/**
 * Execute market analysis for a specific user
 */
export async function executeMarketAnalysisForUser(
  userId: number,
  farmId: number,
  telegramToken: string,
  telegramChatId: string
): Promise<void> {
  const startTime = Date.now();
  logger.log({
    service: 'market_job',
    action: 'execute',
    level: 'info',
    status: 'pending',
    userId,
    farmId,
    message: 'Starting market analysis job',
  });

  try {
    // 1. Coletar notícias brutas (legado)
    const rawNews = await newsCollectorService.collectNews();
    
    if (rawNews.length === 0) {
      const duration = Date.now() - startTime;
      logger.log({
        service: 'market_job',
        action: 'execute',
        level: 'info',
        status: 'success',
        userId,
        farmId,
        duration,
        message: 'No new market news to analyze',
      });
      return;
    }

    // 2. Salvar no banco (legado)
    await newsCollectorService.saveNewsToDatabase(userId, farmId, rawNews);

    // 3. Interpretar cada evento com o novo motor (Fase 7/8)
    const farmSettings = await db.getUserSettings(userId, farmId);
    const monitoredCrops = farmSettings?.monitoredCrops as string[] || ['soja', 'milho'];
    
    const analyses = rawNews.map((news, index) => interpretMarketEvent({
      id: `news-${Date.now()}-${index}`,
      title: news.title,
      summary: news.summary,
      category: (news.category as any) || 'commodities_agricolas',
      source: news.source,
      publishedAt: new Date()
    }, monitoredCrops));

    // 4. Gerar boletim interpretativo consolidado (Fase 7/8)
    const bulletin = generateMarketIntelligenceBulletin(analyses, monitoredCrops);

    // 5. Enviar apenas se houver eventos relevantes (Anti-Spam Mercado)
    const hasRelevantEvents = analyses.some(a => isMarketEventAlertWorthy(a));
    
    if (hasRelevantEvents) {
      await telegramService.sendMessage(telegramToken, telegramChatId, bulletin.telegramMessage, 'normal');
      
      logger.log({
        service: 'market_job',
        action: 'send_bulletin',
        level: 'info',
        status: 'success',
        userId,
        farmId,
        message: 'Market intelligence bulletin sent',
        metadata: { sentiment: bulletin.overallMarketSentiment, eventCount: analyses.length }
      });
    } else {
      logger.log({
        service: 'market_job',
        action: 'skip_bulletin',
        level: 'info',
        status: 'success',
        userId,
        farmId,
        message: 'Market bulletin skipped: no high-impact events',
      });
    }

    const duration = Date.now() - startTime;
    logger.log({
      service: 'market_job',
      action: 'execute',
      level: 'info',
      status: 'success',
      userId,
      farmId,
      duration,
      message: 'Market analysis job completed',
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.log({
      service: 'market_job',
      action: 'execute',
      level: 'error',
      status: 'failed',
      userId,
      farmId,
      duration,
      message: 'Market analysis job failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
