/**
 * AgroIntel Canarana — Fase 7: Motor de Revalidação Inteligente
 *
 * Estratégia de revalidação adaptativa:
 * - 05:00 → Relatório inicial do dia
 * - 06:00–09:00 → Revalidações frequentes (a cada hora)
 * - Após 09:00 → Revalidações espaçadas (a cada 2 horas)
 * - Após 20:00 → Pausa noturna (sem revalidação operacional)
 *
 * Sistema anti-spam:
 * - Só envia alerta quando houver mudança operacional relevante
 * - Ignora oscilações pequenas (< threshold configurável)
 * - Controla cooldown por fazenda para evitar fadiga
 */

import { logger } from './logger';
import { getCurrentSeasonalPeriod } from './operationalProfiles';
import type { ProfileAnalysisResult, SeasonalContext } from './operationalProfiles';

// ---------------------------------------------------------------------------
// TIPOS
// ---------------------------------------------------------------------------

export interface RevalidationScheduleEntry {
  hour: number;
  minute: number;
  intervalMinutes: number; // 0 = execução única naquele horário
  label: string;
}

export interface AlertThresholds {
  minScoreChangeTrigger: number;   // mudança mínima de score para disparar alerta (ex: 20 pontos)
  minWindChangeTrigger: number;    // km/h de variação de vento para disparar alerta
  minTempChangeTrigger: number;    // °C de variação de temperatura para disparar alerta
  minHumidityChangeTrigger: number; // % de variação de UR para disparar alerta
  rainAlertThreshold: number;      // % de probabilidade de chuva para disparar alerta
  cooldownMinutes: number;         // minutos mínimos entre alertas para a mesma fazenda
}

export interface FarmRevalidationState {
  farmId: number;
  lastCheckTime: Date | null;
  lastAlertTime: Date | null;
  lastScore: number | null;
  lastRecommendation: string | null;
  lastWeatherSnapshot: {
    temperature: number;
    humidity: number;
    windSpeed: number;
    rainProbability24h: number;
  } | null;
  alertCount: number; // alertas enviados hoje
}

export interface RevalidationDecision {
  shouldAlert: boolean;
  reason: string;
  alertType: 'window_lost' | 'window_gained' | 'wind_critical' | 'rain_incoming' | 'delta_t_critical' | 'routine' | 'none';
  priority: 'high' | 'normal' | 'low';
}

// ---------------------------------------------------------------------------
// CONFIGURAÇÃO DE HORÁRIOS ADAPTATIVOS
// ---------------------------------------------------------------------------

/**
 * Retorna o schedule de revalidação para o dia atual.
 * Frequência adaptativa: mais densa de manhã, espaçada à tarde.
 */
export function buildDailyRevalidationSchedule(): RevalidationScheduleEntry[] {
  return [
    // Relatório inicial do dia
    { hour: 5, minute: 0, intervalMinutes: 0, label: 'Relatório inicial 05:00' },

    // Janela operacional principal: revalidação a cada hora
    { hour: 6, minute: 0, intervalMinutes: 0, label: 'Revalidação 06:00' },
    { hour: 7, minute: 0, intervalMinutes: 0, label: 'Revalidação 07:00' },
    { hour: 8, minute: 0, intervalMinutes: 0, label: 'Revalidação 08:00' },
    { hour: 9, minute: 0, intervalMinutes: 0, label: 'Revalidação 09:00' },

    // Após 09:00: temperatura sobe, UR cai — revalidação a cada 2 horas
    { hour: 11, minute: 0, intervalMinutes: 0, label: 'Revalidação 11:00' },
    { hour: 13, minute: 0, intervalMinutes: 0, label: 'Revalidação 13:00' },
    { hour: 15, minute: 0, intervalMinutes: 0, label: 'Revalidação 15:00' },
    { hour: 17, minute: 0, intervalMinutes: 0, label: 'Revalidação 17:00' },

    // Encerramento do dia operacional
    { hour: 19, minute: 0, intervalMinutes: 0, label: 'Encerramento 19:00' },
  ];
}

/**
 * Verifica se o horário atual está dentro da janela operacional primária.
 * Janela primária: 05:00–09:00 (maior densidade de revalidação)
 */
export function isPrimaryOperationalWindow(hour: number): boolean {
  return hour >= 5 && hour <= 9;
}

/**
 * Verifica se o horário atual está dentro da janela operacional secundária.
 * Janela secundária: 09:00–19:00 (revalidação a cada 2h)
 */
export function isSecondaryOperationalWindow(hour: number): boolean {
  return hour > 9 && hour <= 19;
}

/**
 * Retorna o próximo horário de revalidação a partir do horário atual.
 */
export function getNextRevalidationTime(currentHour: number, currentMinute: number): Date {
  const schedule = buildDailyRevalidationSchedule();
  const now = new Date();

  for (const entry of schedule) {
    if (
      entry.hour > currentHour ||
      (entry.hour === currentHour && entry.minute > currentMinute)
    ) {
      const next = new Date(now);
      next.setHours(entry.hour, entry.minute, 0, 0);
      return next;
    }
  }

  // Próxima execução: amanhã às 05:00
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(5, 0, 0, 0);
  return tomorrow;
}

// ---------------------------------------------------------------------------
// MOTOR ANTI-SPAM — DECISÃO DE ALERTA
// ---------------------------------------------------------------------------

const DEFAULT_THRESHOLDS: AlertThresholds = {
  minScoreChangeTrigger: 20,
  minWindChangeTrigger: 5,
  minTempChangeTrigger: 3,
  minHumidityChangeTrigger: 10,
  rainAlertThreshold: 50,
  cooldownMinutes: 90,
};

/**
 * Decide se deve enviar alerta com base na variação das condições climáticas.
 * Implementa lógica anti-spam: só alerta quando há impacto operacional relevante.
 */
export function shouldSendAlert(
  farmState: FarmRevalidationState,
  currentAnalysis: ProfileAnalysisResult,
  currentWeather: {
    temperature: number;
    humidity: number;
    windSpeed: number;
    rainProbability24h: number;
  },
  seasonalContext: SeasonalContext,
  thresholds: AlertThresholds = DEFAULT_THRESHOLDS
): RevalidationDecision {

  // Entressafra: nunca alertar operacionalmente
  if (seasonalContext.period === 'entressafra') {
    return { shouldAlert: false, reason: 'Entressafra: alertas operacionais desativados.', alertType: 'none', priority: 'low' };
  }

  // Período de redução de alertas (mar-abr): só alertas críticos
  if (seasonalContext.reduceAlerts) {
    const hasCriticalRisk = currentAnalysis.activeRisks.some((r) => r.severity === 'critico');
    if (!hasCriticalRisk) {
      return { shouldAlert: false, reason: 'Período de redução de alertas (Mar-Abr): apenas alertas críticos.', alertType: 'none', priority: 'low' };
    }
  }

  // Cooldown: não alertar se o último alerta foi recente
  if (farmState.lastAlertTime) {
    const minutesSinceLastAlert = (Date.now() - farmState.lastAlertTime.getTime()) / 60000;
    if (minutesSinceLastAlert < thresholds.cooldownMinutes) {
      return {
        shouldAlert: false,
        reason: `Cooldown ativo: último alerta há ${Math.round(minutesSinceLastAlert)}min (mínimo: ${thresholds.cooldownMinutes}min).`,
        alertType: 'none',
        priority: 'low',
      };
    }
  }

  // Sem estado anterior: primeiro alerta do dia
  if (!farmState.lastScore || !farmState.lastRecommendation || !farmState.lastWeatherSnapshot) {
    return {
      shouldAlert: true,
      reason: 'Primeiro relatório do dia.',
      alertType: 'routine',
      priority: 'normal',
    };
  }

  const prev = farmState.lastWeatherSnapshot;
  const prevScore = farmState.lastScore;
  const prevRec = farmState.lastRecommendation;

  // --- Perda relevante de janela operacional ---
  if (
    (prevRec === 'recomendado' || prevRec === 'aceitavel') &&
    (currentAnalysis.recommendation === 'nao-recomendado' || currentAnalysis.recommendation === 'aguardar')
  ) {
    return {
      shouldAlert: true,
      reason: `Perda de janela operacional: ${prevRec} → ${currentAnalysis.recommendation}.`,
      alertType: 'window_lost',
      priority: 'high',
    };
  }

  // --- Ganho relevante de janela operacional ---
  if (
    (prevRec === 'nao-recomendado' || prevRec === 'aguardar') &&
    (currentAnalysis.recommendation === 'recomendado' || currentAnalysis.recommendation === 'aceitavel')
  ) {
    return {
      shouldAlert: true,
      reason: `Abertura de janela operacional: ${prevRec} → ${currentAnalysis.recommendation}.`,
      alertType: 'window_gained',
      priority: 'high',
    };
  }

  // --- Vento crítico ---
  const windChange = Math.abs(currentWeather.windSpeed - prev.windSpeed);
  if (windChange >= thresholds.minWindChangeTrigger && currentAnalysis.activeRisks.some((r) => r.risk === 'deriva' && (r.severity === 'alto' || r.severity === 'critico'))) {
    return {
      shouldAlert: true,
      reason: `Vento crítico detectado: ${prev.windSpeed} → ${currentWeather.windSpeed} km/h (variação: ${windChange.toFixed(1)} km/h).`,
      alertType: 'wind_critical',
      priority: 'high',
    };
  }

  // --- Chuva iminente ---
  if (
    prev.rainProbability24h < thresholds.rainAlertThreshold &&
    currentWeather.rainProbability24h >= thresholds.rainAlertThreshold
  ) {
    return {
      shouldAlert: true,
      reason: `Chuva iminente: probabilidade subiu de ${prev.rainProbability24h}% para ${currentWeather.rainProbability24h}%.`,
      alertType: 'rain_incoming',
      priority: 'high',
    };
  }

  // --- Delta T crítico ---
  if (currentAnalysis.deltaTStatus === 'critico' && farmState.lastScore && farmState.lastScore >= 50) {
    return {
      shouldAlert: true,
      reason: `Delta T crítico (${currentAnalysis.deltaT.toFixed(1)}°C): condição operacional deteriorou.`,
      alertType: 'delta_t_critical',
      priority: 'high',
    };
  }

  // --- Mudança significativa de score ---
  const scoreChange = Math.abs(currentAnalysis.score - prevScore);
  if (scoreChange >= thresholds.minScoreChangeTrigger) {
    return {
      shouldAlert: true,
      reason: `Mudança significativa de score: ${prevScore} → ${currentAnalysis.score} (variação: ${scoreChange} pontos).`,
      alertType: 'routine',
      priority: 'normal',
    };
  }

  // Sem mudança relevante: não alertar
  return {
    shouldAlert: false,
    reason: `Sem mudança operacional relevante (score: ${prevScore} → ${currentAnalysis.score}, variação: ${scoreChange} pontos).`,
    alertType: 'none',
    priority: 'low',
  };
}

// ---------------------------------------------------------------------------
// GERENCIADOR DE ESTADO DE REVALIDAÇÃO POR FAZENDA
// ---------------------------------------------------------------------------

class RevalidationStateManager {
  private states: Map<number, FarmRevalidationState> = new Map();

  getState(farmId: number): FarmRevalidationState {
    if (!this.states.has(farmId)) {
      this.states.set(farmId, {
        farmId,
        lastCheckTime: null,
        lastAlertTime: null,
        lastScore: null,
        lastRecommendation: null,
        lastWeatherSnapshot: null,
        alertCount: 0,
      });
    }
    return this.states.get(farmId)!;
  }

  updateAfterCheck(
    farmId: number,
    analysis: ProfileAnalysisResult,
    weather: { temperature: number; humidity: number; windSpeed: number; rainProbability24h: number }
  ): void {
    const state = this.getState(farmId);
    state.lastCheckTime = new Date();
    state.lastScore = analysis.score;
    state.lastRecommendation = analysis.recommendation;
    state.lastWeatherSnapshot = { ...weather };
    this.states.set(farmId, state);
  }

  updateAfterAlert(farmId: number): void {
    const state = this.getState(farmId);
    state.lastAlertTime = new Date();
    state.alertCount += 1;
    this.states.set(farmId, state);
  }

  /**
   * Reseta os estados diários (chamar à meia-noite).
   */
  resetDailyStates(): void {
    for (const [fId, state] of Array.from(this.states.entries())) {
      this.states.set(fId, {
        ...state,
        lastScore: null,
        lastRecommendation: null,
        lastWeatherSnapshot: null,
        lastAlertTime: null,
        alertCount: 0,
      });
    }
    logger.log({
      service: 'revalidation_engine',
      action: 'reset_daily',
      level: 'info',
      status: 'success',
      message: `Daily revalidation states reset for ${this.states.size} farms.`,
    });
  }

  getAllStates(): FarmRevalidationState[] {
    return Array.from(this.states.values());
  }
}

export const revalidationStateManager = new RevalidationStateManager();

// ---------------------------------------------------------------------------
// SCHEDULER DE REVALIDAÇÃO INTELIGENTE
// ---------------------------------------------------------------------------

class RevalidationScheduler {
  private intervals: NodeJS.Timeout[] = [];
  private isRunning = false;
  private dailyResetInterval: NodeJS.Timeout | null = null;

  /**
   * Inicia o scheduler de revalidação inteligente.
   * @param onRevalidate - Callback chamado a cada revalidação (recebe hora atual)
   */
  start(onRevalidate: (hour: number, minute: number, label: string) => Promise<void>): void {
    if (this.isRunning) {
      logger.log({
        service: 'revalidation_scheduler',
        action: 'start',
        level: 'warn',
        status: 'pending',
        message: 'Revalidation scheduler already running.',
      });
      return;
    }

    this.isRunning = true;
    const schedule = buildDailyRevalidationSchedule();

    logger.log({
      service: 'revalidation_scheduler',
      action: 'start',
      level: 'info',
      status: 'success',
      message: `Revalidation scheduler started. ${schedule.length} daily checkpoints configured.`,
    });

    // Verificar a cada minuto se é hora de revalidar
    const interval = setInterval(async () => {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();

      for (const entry of schedule) {
        if (entry.hour === hour && entry.minute === minute) {
          logger.log({
            service: 'revalidation_scheduler',
            action: 'trigger',
            level: 'info',
            status: 'pending',
            message: `Triggering revalidation: ${entry.label}`,
          });
          try {
            await onRevalidate(hour, minute, entry.label);
          } catch (err) {
            logger.log({
              service: 'revalidation_scheduler',
              action: 'trigger',
              level: 'error',
              status: 'failed',
              message: `Revalidation failed: ${entry.label}`,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }
    }, 60000); // Verifica a cada minuto

    this.intervals.push(interval);

    // Reset diário à meia-noite
    this.dailyResetInterval = setInterval(() => {
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        revalidationStateManager.resetDailyStates();
      }
    }, 60000);
  }

  stop(): void {
    for (const interval of this.intervals) {
      clearInterval(interval);
    }
    if (this.dailyResetInterval) {
      clearInterval(this.dailyResetInterval);
    }
    this.intervals = [];
    this.isRunning = false;

    logger.log({
      service: 'revalidation_scheduler',
      action: 'stop',
      level: 'info',
      status: 'success',
      message: 'Revalidation scheduler stopped.',
    });
  }

  getStatus(): { isRunning: boolean; scheduleCount: number } {
    return {
      isRunning: this.isRunning,
      scheduleCount: buildDailyRevalidationSchedule().length,
    };
  }
}

export const revalidationScheduler = new RevalidationScheduler();
