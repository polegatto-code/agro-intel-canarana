import { logger } from './logger';
import { cacheService, rateLimiter } from './cache';
import * as db from '../db';

export interface NewsSource {
  name: string;
  url: string;
  category: string;
  priority: 'high' | 'normal' | 'low';
}

export interface RawNewsItem {
  title: string;
  summary: string;
  source: string;
  url: string;
  date: Date;
  category: string;
  rawContent?: string;
}

/**
 * News collector service
 * Collects agricultural news from multiple sources
 */
class NewsCollectorService {
  private readonly cachePrefix = 'news_collector:';
  private readonly cacheTTL = 12 * 60 * 60 * 1000; // 12 hours

  private readonly newsSources: NewsSource[] = [
    // Agricultural news sources
    {
      name: 'Embrapa',
      url: 'https://www.embrapa.br/noticias',
      category: 'research',
      priority: 'high',
    },
    {
      name: 'Conab',
      url: 'https://www.conab.gov.br/ultimas-noticias',
      category: 'market',
      priority: 'high',
    },
    {
      name: 'Agrolink',
      url: 'https://www.agrolink.com.br/noticias',
      category: 'market',
      priority: 'normal',
    },
    {
      name: 'Agência Brasil',
      url: 'https://agenciabrasil.ebc.com.br/economia',
      category: 'economy',
      priority: 'normal',
    },
  ];

  /**
   * Collect news from all sources
   */
  async collectNews(): Promise<RawNewsItem[]> {
    const cacheKey = `${this.cachePrefix}all:${Date.now().toString().slice(0, -3)}`;

    // Check cache
    const cached = cacheService.get<RawNewsItem[]>(cacheKey);
    if (cached && cached.length > 0) {
      logger.log({
        service: 'news_collector',
        action: 'collect_all',
        level: 'debug',
        status: 'success',
        message: 'News from cache',
        metadata: { cached: true, count: cached.length },
      });
      return cached;
    }

    logger.log({
      service: 'news_collector',
      action: 'collect_all',
      level: 'info',
      status: 'pending',
      message: 'Starting news collection from all sources',
      metadata: { sources: this.newsSources.length },
    });

    const allNews: RawNewsItem[] = [];
    const results = await Promise.allSettled(
      this.newsSources.map((source) => this.collectFromSource(source))
    );

    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const source = this.newsSources[i];

      if (result.status === 'fulfilled') {
        allNews.push(...result.value);
        successCount++;

        logger.log({
          service: 'news_collector',
          action: 'collect_all',
          level: 'debug',
          status: 'success',
          message: `Collected from ${source.name}`,
          metadata: { source: source.name, count: result.value.length },
        });
      } else {
        failureCount++;

        logger.log({
          service: 'news_collector',
          action: 'collect_all',
          level: 'warn',
          status: 'failed',
          message: `Failed to collect from ${source.name}`,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          metadata: { source: source.name },
        });
      }
    }

    // Sort by date (newest first)
    allNews.sort((a, b) => b.date.getTime() - a.date.getTime());

    // Cache the results
    if (allNews.length > 0) {
      cacheService.set(cacheKey, allNews, this.cacheTTL);
    }

    logger.log({
      service: 'news_collector',
      action: 'collect_all',
      level: 'info',
      status: 'success',
      message: 'News collection completed',
      metadata: { total: allNews.length, successCount, failureCount },
    });

    return allNews;
  }

  /**
   * Collect news from a specific source
   */
  private async collectFromSource(source: NewsSource): Promise<RawNewsItem[]> {
    // Check rate limit
    if (!rateLimiter.isAllowed(`news_source:${source.name}`)) {
      logger.log({
        service: 'news_collector',
        action: 'collect_source',
        level: 'warn',
        status: 'failed',
        message: `Rate limit exceeded for ${source.name}`,
        metadata: { source: source.name },
      });
      return [];
    }

    try {
      const startTime = Date.now();

      // Mock news data for development
      // In production, this would call real APIs (RSS feeds, web scraping, news APIs)
      const news = this.getMockNewsFromSource(source);

      const duration = Date.now() - startTime;

      logger.log({
        service: 'news_collector',
        action: 'collect_source',
        level: 'debug',
        status: 'success',
        message: `Collected from ${source.name}`,
        metadata: { source: source.name, count: news.length, duration },
      });

      return news;
    } catch (error) {
      logger.log({
        service: 'news_collector',
        action: 'collect_source',
        level: 'error',
        status: 'failed',
        message: `Failed to collect from ${source.name}`,
        error: error instanceof Error ? error.message : String(error),
        metadata: { source: source.name },
      });

      return [];
    }
  }

  /**
   * Get mock news for development
   */
  private getMockNewsFromSource(source: NewsSource): RawNewsItem[] {
    const mockNews: Record<string, RawNewsItem[]> = {
      'Embrapa': [
        {
          title: 'Embrapa divulga novas recomendações para aplicação de defensivos em soja',
          summary:
            'Pesquisadores da Embrapa apresentam estudo sobre melhores horários e condições climáticas para aplicação de defensivos em soja no Mato Grosso.',
          source: 'Embrapa',
          url: 'https://www.embrapa.br/noticias/exemplo1',
          date: new Date(Date.now() - 2 * 60 * 60 * 1000),
          category: 'research',
          rawContent: 'Conteúdo completo da notícia...',
        },
        {
          title: 'Impacto da umidade relativa na eficácia de herbicidas',
          summary:
            'Estudo mostra que umidade relativa entre 60-80% oferece melhor absorção de herbicidas em milho.',
          source: 'Embrapa',
          url: 'https://www.embrapa.br/noticias/exemplo2',
          date: new Date(Date.now() - 4 * 60 * 60 * 1000),
          category: 'research',
        },
      ],
      'Conab': [
        {
          title: 'Preço da ureia sobe 8% em maio',
          summary: 'Conab registra aumento de 8% no preço da ureia no mês de maio devido a fatores geopolíticos.',
          source: 'Conab',
          url: 'https://www.conab.gov.br/noticias/exemplo1',
          date: new Date(Date.now() - 1 * 60 * 60 * 1000),
          category: 'market',
        },
        {
          title: 'Safra de soja 2026 projeta aumento de 12%',
          summary:
            'Conab atualiza projeção da safra de soja para 2026 com aumento de 12% em relação ao ano anterior.',
          source: 'Conab',
          url: 'https://www.conab.gov.br/noticias/exemplo2',
          date: new Date(Date.now() - 3 * 60 * 60 * 1000),
          category: 'market',
        },
      ],
      'Agrolink': [
        {
          title: 'Dólar fecha em alta: impacto nos custos de insumos',
          summary:
            'Dólar fecha em alta de 2,5% afetando diretamente o preço de insumos importados como MAP e KCL.',
          source: 'Agrolink',
          url: 'https://www.agrolink.com.br/noticias/exemplo1',
          date: new Date(Date.now() - 30 * 60 * 1000),
          category: 'economy',
        },
      ],
      'Agência Brasil': [
        {
          title: 'Brasil mantém posição como maior exportador de soja',
          summary:
            'Dados mostram que Brasil mantém liderança global em exportações de soja, com China como principal destino.',
          source: 'Agência Brasil',
          url: 'https://agenciabrasil.ebc.com.br/economia/exemplo1',
          date: new Date(Date.now() - 5 * 60 * 60 * 1000),
          category: 'economy',
        },
      ],
    };

    return mockNews[source.name] || [];
  }

  /**
   * Save news to database
   */
  async saveNewsToDatabase(userId: number, news: RawNewsItem[]): Promise<void> {
    if (news.length === 0) {
      logger.log({
        service: 'news_collector',
        action: 'save_news',
        level: 'debug',
        status: 'pending',
        message: 'No news to save',
        metadata: { userId },
      });
      return;
    }

    try {
      const startTime = Date.now();

      // Save each news item
      for (const item of news) {
        await db.createMarketAlert({
          userId,
          title: item.title,
          summary: item.summary,
          affectedInputs: [],
          affectedCrops: [],
          impactLevel: 'medium',
          source: item.source,
          sourceUrl: item.url,
          aiAnalysis: null,
          notificationSent: false,
          notificationSentAt: null,
        });
      }

      const duration = Date.now() - startTime;

      logger.log({
        service: 'news_collector',
        action: 'save_news',
        level: 'info',
        status: 'success',
        message: 'News saved to database',
        metadata: { userId, count: news.length, duration },
      });
    } catch (error) {
      logger.log({
        service: 'news_collector',
        action: 'save_news',
        level: 'error',
        status: 'failed',
        message: 'Failed to save news to database',
        error: error instanceof Error ? error.message : String(error),
        metadata: { userId, count: news.length },
      });

      throw error;
    }
  }

  /**
   * Get news by category
   */
  async getNewsByCategory(category: string): Promise<RawNewsItem[]> {
    const allNews = await this.collectNews();
    return allNews.filter((item) => item.category === category);
  }

  /**
   * Get latest news
   */
  async getLatestNews(limit: number = 10): Promise<RawNewsItem[]> {
    const allNews = await this.collectNews();
    return allNews.slice(0, limit);
  }

  /**
   * Get news related to specific inputs
   */
  async getNewsRelatedToInputs(inputs: string[]): Promise<RawNewsItem[]> {
    const allNews = await this.collectNews();

    return allNews.filter((item) => {
      const text = `${item.title} ${item.summary}`.toLowerCase();
      return inputs.some((input) => text.includes(input.toLowerCase()));
    });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    cacheService.delete(`${this.cachePrefix}*`);

    logger.log({
      service: 'news_collector',
      action: 'clear_cache',
      level: 'debug',
      status: 'success',
      message: 'News collector cache cleared',
    });
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      sources: this.newsSources.length,
      cacheSize: cacheService.getStats().size,
    };
  }
}

export const newsCollectorService = new NewsCollectorService();
