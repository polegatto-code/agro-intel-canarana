import { logger } from './logger';
import { invokeLLM } from '../_core/llm';
import { cacheService, rateLimiter } from './cache';

export interface NewsItem {
  title: string;
  summary: string;
  source: string;
  url: string;
  date: Date;
  category: string;
}

export interface AnalysisResult {
  summary: string;
  keyPoints: string[];
  impactOnBrazil: string;
  affectedInputs: string[];
  affectedCrops: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
}

/**
 * News analysis service using LLM
 */
class NewsAnalysisService {
  private readonly cachePrefix = 'news_analysis:';
  private readonly cacheTTL = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Analyze agricultural news with LLM
   */
  async analyzeNews(news: NewsItem[]): Promise<AnalysisResult> {
    const cacheKey = `${this.cachePrefix}${Date.now().toString().slice(0, -3)}`;

    // Check cache
    const cached = cacheService.get<AnalysisResult>(cacheKey);
    if (cached) {
      logger.log({
        service: 'news_analysis',
        action: 'analyze',
        level: 'debug',
        status: 'success',
        message: 'Analysis from cache',
        metadata: { cached: true, newsCount: news.length },
      });
      return cached;
    }

    // Check rate limit
    if (!rateLimiter.isAllowed('news_analysis')) {
      logger.log({
        service: 'news_analysis',
        action: 'analyze',
        level: 'warn',
        status: 'failed',
        message: 'Rate limit exceeded for news analysis',
      });

      // Return default analysis on rate limit
      return this.getDefaultAnalysis();
    }

    try {
      const startTime = Date.now();

      // Format news for LLM
      const newsText = this.formatNewsForAnalysis(news);

      // Call LLM for analysis
      const response = await invokeLLM({
        messages: [
          {
            role: 'system',
            content: `Você é um especialista em agronegócio e mercado agrícola brasileiro. 
            Analise as notícias fornecidas e gere uma análise contextualizada para produtores rurais do Vale do Araguaia (Canarana-MT).
            Foque em:
            - Impacto direto para o Brasil
            - Insumos afetados (fertilizantes, defensivos, etc)
            - Culturas afetadas (soja, milho, sorgo, milheto, gergelim)
            - Nível de risco
            - Recomendações práticas
            
            Responda em JSON com a estrutura especificada.`,
          },
          {
            role: 'user',
            content: `Analise as seguintes notícias agrícolas:\n\n${newsText}`,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'news_analysis',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                summary: {
                  type: 'string',
                  description: 'Resumo executivo da análise',
                },
                keyPoints: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Pontos-chave da análise',
                },
                impactOnBrazil: {
                  type: 'string',
                  description: 'Como isso impacta o Brasil e especificamente o Vale do Araguaia',
                },
                affectedInputs: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Insumos afetados (ureia, MAP, KCL, etc)',
                },
                affectedCrops: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Culturas afetadas',
                },
                riskLevel: {
                  type: 'string',
                  enum: ['low', 'medium', 'high', 'critical'],
                  description: 'Nível de risco',
                },
                recommendations: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Recomendações práticas para o produtor',
                },
              },
              required: [
                'summary',
                'keyPoints',
                'impactOnBrazil',
                'affectedInputs',
                'affectedCrops',
                'riskLevel',
                'recommendations',
              ],
              additionalProperties: false,
            },
          },
        },
      });

      const duration = Date.now() - startTime;

      // Parse response
      const content = response.choices[0]?.message?.content;
      if (!content || typeof content !== 'string') {
        throw new Error('No response from LLM');
      }

      const analysis = JSON.parse(content) as AnalysisResult;

      // Cache the result
      cacheService.set(cacheKey, analysis, this.cacheTTL);

      logger.log({
        service: 'news_analysis',
        action: 'analyze',
        level: 'info',
        status: 'success',
        message: 'News analysis completed',
        metadata: {
          duration,
          newsCount: news.length,
          riskLevel: analysis.riskLevel,
        },
      });

      return analysis;
    } catch (error) {
      logger.log({
        service: 'news_analysis',
        action: 'analyze',
        level: 'error',
        status: 'failed',
        message: 'News analysis failed',
        error: error instanceof Error ? error.message : String(error),
      });

      // Return default analysis on error
      return this.getDefaultAnalysis();
    }
  }

  /**
   * Format news items for LLM analysis
   */
  private formatNewsForAnalysis(news: NewsItem[]): string {
    return news
      .map(
        (item, index) => `
${index + 1}. ${item.title}
   Fonte: ${item.source}
   Data: ${item.date.toLocaleDateString('pt-BR')}
   Categoria: ${item.category}
   Resumo: ${item.summary}
   URL: ${item.url}
`
      )
      .join('\n');
  }

  /**
   * Get default analysis when LLM is unavailable
   */
  private getDefaultAnalysis(): AnalysisResult {
    return {
      summary: 'Análise não disponível no momento. Por favor, tente novamente mais tarde.',
      keyPoints: ['Sistema de análise temporariamente indisponível'],
      impactOnBrazil: 'Impacto não determinado',
      affectedInputs: [],
      affectedCrops: [],
      riskLevel: 'medium',
      recommendations: ['Acompanhe as notícias agrícolas regularmente'],
    };
  }

  /**
   * Generate Telegram message from analysis
   */
  generateTelegramMessage(analysis: AnalysisResult): string {
    const riskEmoji = {
      low: '🟢',
      medium: '🟡',
      high: '🔴',
      critical: '⛔',
    };

    const emoji = riskEmoji[analysis.riskLevel];

    let message = `${emoji} <b>ANÁLISE DE MERCADO AGRÍCOLA</b>\n\n`;
    message += `<b>Resumo:</b>\n${analysis.summary}\n\n`;

    if (analysis.keyPoints.length > 0) {
      message += `<b>Pontos-Chave:</b>\n`;
      analysis.keyPoints.forEach((point) => {
        message += `• ${point}\n`;
      });
      message += '\n';
    }

    message += `<b>Impacto para o Brasil:</b>\n${analysis.impactOnBrazil}\n\n`;

    if (analysis.affectedInputs.length > 0) {
      message += `<b>Insumos Afetados:</b>\n`;
      analysis.affectedInputs.forEach((input) => {
        message += `• ${input}\n`;
      });
      message += '\n';
    }

    if (analysis.affectedCrops.length > 0) {
      message += `<b>Culturas Afetadas:</b>\n`;
      analysis.affectedCrops.forEach((crop) => {
        message += `• ${crop}\n`;
      });
      message += '\n';
    }

    if (analysis.recommendations.length > 0) {
      message += `<b>Recomendações:</b>\n`;
      analysis.recommendations.forEach((rec) => {
        message += `• ${rec}\n`;
      });
    }

    return message;
  }
}

export const newsAnalysisService = new NewsAnalysisService();
