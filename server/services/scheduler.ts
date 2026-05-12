import { logger } from './logger';
import { telegramService } from './telegram';
import { analyzeWeather, saveWeatherAnalysis } from './weather';
import { newsCollectorService } from './newsCollector';
import { newsAnalysisService } from './newsAnalysis';
import { analyzeAgronomicConditions, formatAgronomicBulletin } from './agronomyService';
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
   * Schedule weather check at specific hour
   */
  private scheduleWeatherCheck(hour: number): void {
    const checkTime = () => {
      const now = new Date();
      return now.getHours() === hour && now.getMinutes() === 0;
    };

    this.weatherCheckInterval = setInterval(async () => {
      if (checkTime()) {
        await this.executeWeatherCheck();
      }
    }, 60000); // Check every minute
  }

  /**
   * Execute weather check for all users
   */
  private async executeWeatherCheck(): Promise<void> {
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
            const farmSettings = await db.getUserSettings(user.userId);
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

      logger.log({
        service: 'scheduler',
        action: 'weather_check',
        level: 'info',
        status: 'success',
        message: 'Weather check completed for all farms',
        metadata: { userCount: users.length, farmCount }
      });
    } catch (error) {
      logger.log({
        service: 'scheduler',
        action: 'weather_check',
        level: 'error',
        status: 'failed',
        message: 'Weather check failed',
        error: error instanceof Error ? error.message : String(error),
      });
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

      logger.log({
        service: 'scheduler',
        action: 'market_alerts',
        level: 'info',
        status: 'success',
        message: 'Market alerts check completed for all users',
        metadata: { userCount: users.length }
      });
    } catch (error) {
      logger.log({
        service: 'scheduler',
        action: 'market_alerts',
        level: 'error',
        status: 'failed',
        message: 'Market alerts check failed',
        error: error instanceof Error ? error.message : String(error),
      });
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
    const analysis = await analyzeWeather(
      userId,
      minHumidity,
      maxHumidity,
      maxTemperature,
      maxWindSpeed,
      process.env.OPENWEATHER_API_KEY,
      latitude,
      longitude,
      farmId
    );

    await saveWeatherAnalysis(userId, analysis, farmId);

    // Buscar fazenda e configurações
    const farm = await db.getFarmById(farmId);
    const farmName = farm?.name || 'Fazenda';
    const farmSettings = await db.getUserSettings(userId, farmId);

    // Buscar alertas de mercado recentes filtrados por cultura
    const monitoredCrops = farmSettings?.monitoredCrops as string[] || ['soja', 'milho'];
    const marketAlerts = await db.getMarketAlerts(userId, farmId, 3, monitoredCrops);

    // Nova análise agronômica detalhada
    const agronomicAnalysis = analyzeAgronomicConditions(
      {
        temperature: Number(analysis.currentTemp),
        humidity: analysis.currentHumidity,
        windSpeed: Number(analysis.currentWindSpeed),
        rainProbability: 0 // Simplificado para o boletim
      },
      farm?.mainCrop || 'soja'
    );

    const message = formatAgronomicBulletin(
      farmName,
      agronomicAnalysis,
      {
        temperature: Number(analysis.currentTemp),
        humidity: analysis.currentHumidity,
        windSpeed: Number(analysis.currentWindSpeed)
      },
      marketAlerts,
      monitoredCrops
    );

    const priority = agronomicAnalysis.sprayRecommendation === 'recomendado' ? 'high' : 'normal';
    await telegramService.sendMessage(telegramToken, telegramChatId, message, priority);

    logger.log({
      service: 'weather_job',
      action: 'execute',
      level: 'info',
      status: 'success',
      userId,
      farmId,
      message: 'Weather check job completed successfully for farm',
      metadata: { classification: analysis.overallClassification },
    });
  } catch (error) {
    logger.log({
      service: 'weather_job',
      action: 'execute',
      level: 'error',
      status: 'failed',
      userId,
      farmId,
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
  logger.log({
    service: 'market_job',
    action: 'execute',
    level: 'info',
    status: 'pending',
    userId,
    message: 'Starting market analysis job',
  });

  try {
    const rawNews = await newsCollectorService.collectNews();
    
    if (rawNews.length === 0) {
      logger.log({
        service: 'market_job',
        action: 'execute',
        level: 'info',
        status: 'success',
        userId,
        message: 'No new market news to analyze',
      });
      return;
    }

    await newsCollectorService.saveNewsToDatabase(userId, farmId, rawNews);

    const analysis = await newsAnalysisService.analyzeNews(rawNews);

    const message = newsAnalysisService.generateTelegramMessage(analysis);
    await telegramService.sendMessage(telegramToken, telegramChatId, message, 'normal');

    logger.log({
      service: 'market_job',
      action: 'execute',
      level: 'info',
      status: 'success',
      userId,
      message: 'Market analysis job completed',
      metadata: { newsCount: rawNews.length, riskLevel: analysis.riskLevel }
    });
  } catch (error) {
    logger.log({
      service: 'market_job',
      action: 'execute',
      level: 'error',
      status: 'failed',
      userId,
      message: 'Market analysis job failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
