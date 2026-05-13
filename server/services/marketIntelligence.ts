/**
 * AgroIntel Canarana — Fase 7: Motor de Inteligência de Mercado
 *
 * O sistema NÃO é um portal de notícias.
 * O sistema INTERPRETA o impacto operacional e econômico para o produtor.
 *
 * Monitora:
 * - Conab, USDA, Chicago, dólar, fertilizantes (KCL, fósforo, nitrogenados)
 * - Químicos, sementes soja, petróleo, diesel, logística
 * - Geopolítica, políticas internacionais, políticas Brasil
 * - Commodities agrícolas
 *
 * Para cada evento, o sistema:
 * 1. Identifica a categoria de impacto
 * 2. Interpreta as consequências para o produtor de Canarana-MT
 * 3. Estima o impacto provável (custo de produção, margem, decisão operacional)
 * 4. Aponta possíveis riscos e oportunidades
 * 5. Sugere ação ou monitoramento
 *
 * Fontes: somente fontes altamente confiáveis.
 */

// ---------------------------------------------------------------------------
// TIPOS
// ---------------------------------------------------------------------------

export type MarketCategory =
  | 'fertilizantes'
  | 'defensivos'
  | 'sementes'
  | 'commodities_agricolas'
  | 'energia_combustivel'
  | 'logistica_frete'
  | 'cambio_dolar'
  | 'politica_brasil'
  | 'politica_internacional'
  | 'geopolitica'
  | 'credito_rural'
  | 'clima_global';

export type ImpactDirection = 'positivo' | 'negativo' | 'neutro' | 'incerto';
export type ImpactMagnitude = 'baixo' | 'moderado' | 'alto' | 'critico';
export type TimeHorizon = 'imediato' | 'curto_prazo' | 'medio_prazo' | 'longo_prazo';

export interface MarketEvent {
  id: string;
  title: string;
  summary: string;
  category: MarketCategory;
  source: string;
  publishedAt: Date;
  rawUrl?: string;
}

export interface MarketImpactAnalysis {
  eventId: string;
  category: MarketCategory;
  impactDirection: ImpactDirection;
  impactMagnitude: ImpactMagnitude;
  timeHorizon: TimeHorizon;
  // Interpretação para o produtor
  whatHappened: string;
  whatItMeans: string;          // O que pode acontecer
  probableImpact: string;       // Impacto provável no custo/receita
  marketReaction: string;       // Possível reação do mercado
  risks: string[];              // Riscos identificados
  opportunities: string[];      // Oportunidades identificadas
  suggestedAction: string;      // Ação ou monitoramento sugerido
  affectedInputs: string[];     // Insumos afetados (KCL, ureia, diesel, etc.)
  affectedCrops: string[];      // Culturas afetadas
  confidenceLevel: 'alta' | 'media' | 'baixa';
}

export interface MarketIntelligenceBulletin {
  generatedAt: Date;
  period: string;
  overallMarketSentiment: 'favoravel' | 'neutro' | 'desfavoravel' | 'volatil';
  sentimentReason: string;
  analyses: MarketImpactAnalysis[];
  topRisks: string[];
  topOpportunities: string[];
  keyNumbers: { label: string; value: string; trend: 'up' | 'down' | 'stable' }[];
  telegramMessage: string;
}

// ---------------------------------------------------------------------------
// MAPEAMENTO DE CATEGORIAS PARA IMPACTOS TÍPICOS
// ---------------------------------------------------------------------------

interface CategoryImpactTemplate {
  label: string;
  typicalAffectedInputs: string[];
  typicalAffectedCrops: string[];
  interpretationGuide: string;
}

export const CATEGORY_TEMPLATES: Record<MarketCategory, CategoryImpactTemplate> = {
  fertilizantes: {
    label: 'Fertilizantes',
    typicalAffectedInputs: ['KCL', 'MAP', 'ureia', 'sulfato de amônio', 'superfosfato'],
    typicalAffectedCrops: ['soja', 'milho', 'sorgo', 'gergelim'],
    interpretationGuide:
      'Alta de fertilizantes eleva custo de produção. KCL e fósforo têm maior peso na soja. Ureia impacta milho safrinha. Monitorar janela de compra antecipada.',
  },
  defensivos: {
    label: 'Defensivos Agrícolas',
    typicalAffectedInputs: ['fungicidas', 'herbicidas', 'inseticidas', 'adjuvantes'],
    typicalAffectedCrops: ['soja', 'milho', 'sorgo', 'gergelim'],
    interpretationGuide:
      'Variação cambial impacta diretamente o custo de defensivos importados. Alta do dólar encarece fungicidas e herbicidas.',
  },
  sementes: {
    label: 'Sementes',
    typicalAffectedInputs: ['sementes soja', 'sementes milho', 'sementes sorgo'],
    typicalAffectedCrops: ['soja', 'milho', 'sorgo'],
    interpretationGuide:
      'Preço de sementes de soja é influenciado por royalties e câmbio. Monitorar disponibilidade e preço para próxima safra.',
  },
  commodities_agricolas: {
    label: 'Commodities Agrícolas',
    typicalAffectedInputs: [],
    typicalAffectedCrops: ['soja', 'milho', 'sorgo', 'gergelim'],
    interpretationGuide:
      'Chicago define o preço base. Basis local em Canarana-MT varia com logística e demanda regional. Alta de Chicago melhora margem se câmbio acompanhar.',
  },
  energia_combustivel: {
    label: 'Energia e Combustível',
    typicalAffectedInputs: ['diesel', 'gasolina', 'energia elétrica'],
    typicalAffectedCrops: ['soja', 'milho', 'sorgo', 'milheto', 'gergelim'],
    interpretationGuide:
      'Diesel é o maior custo variável de campo. Alta do petróleo pressiona diesel e frete. Impacto direto no custo de colheita, pulverização e transporte.',
  },
  logistica_frete: {
    label: 'Logística e Frete',
    typicalAffectedInputs: ['frete rodoviário', 'frete ferroviário'],
    typicalAffectedCrops: ['soja', 'milho'],
    interpretationGuide:
      'Canarana-MT tem alta dependência de frete rodoviário. Gargalos logísticos reduzem basis e comprimem margem do produtor.',
  },
  cambio_dolar: {
    label: 'Câmbio / Dólar',
    typicalAffectedInputs: ['todos os insumos importados'],
    typicalAffectedCrops: ['soja', 'milho', 'sorgo', 'gergelim'],
    interpretationGuide:
      'Dólar alto beneficia receita (soja/milho cotados em dólar) mas encarece insumos importados. Efeito líquido depende do momento de compra de insumos vs venda da produção.',
  },
  politica_brasil: {
    label: 'Política Brasil',
    typicalAffectedInputs: ['crédito rural', 'PRONAF', 'seguro agrícola'],
    typicalAffectedCrops: ['soja', 'milho', 'sorgo', 'milheto', 'gergelim'],
    interpretationGuide:
      'Políticas de crédito rural, Plano Safra e regulações fitossanitárias impactam custo de capital e acesso a mercados.',
  },
  politica_internacional: {
    label: 'Política Internacional',
    typicalAffectedInputs: ['fertilizantes importados', 'defensivos importados'],
    typicalAffectedCrops: ['soja', 'milho'],
    interpretationGuide:
      'Tarifas, embargos e acordos comerciais afetam exportações de soja/milho e importações de insumos. China é o principal comprador de soja brasileira.',
  },
  geopolitica: {
    label: 'Geopolítica',
    typicalAffectedInputs: ['fertilizantes', 'petróleo'],
    typicalAffectedCrops: ['soja', 'milho'],
    interpretationGuide:
      'Conflitos geopolíticos afetam oferta global de fertilizantes (Rússia/Belarus = KCL; Rússia = ureia) e petróleo. Monitorar impacto em preços de insumos.',
  },
  credito_rural: {
    label: 'Crédito Rural',
    typicalAffectedInputs: ['custo de capital'],
    typicalAffectedCrops: ['soja', 'milho', 'sorgo', 'milheto', 'gergelim'],
    interpretationGuide:
      'Taxa Selic e condições de crédito rural afetam custo de financiamento da safra. Monitorar Plano Safra e linhas do BNDES.',
  },
  clima_global: {
    label: 'Clima Global',
    typicalAffectedInputs: [],
    typicalAffectedCrops: ['soja', 'milho', 'sorgo'],
    interpretationGuide:
      'El Niño/La Niña afetam distribuição de chuvas no Cerrado. Seca nos EUA ou Argentina impacta Chicago e preço da soja.',
  },
};

// ---------------------------------------------------------------------------
// MOTOR DE INTERPRETAÇÃO DE IMPACTO
// ---------------------------------------------------------------------------

/**
 * Interpreta um evento de mercado e gera análise de impacto para o produtor.
 * Esta função é o núcleo do motor de inteligência — não replica manchetes,
 * mas interpreta consequências operacionais e econômicas.
 */
export function interpretMarketEvent(
  event: MarketEvent,
  monitoredCrops: string[] = ['soja', 'milho']
): MarketImpactAnalysis {
  const template = CATEGORY_TEMPLATES[event.category];
  const affectedCrops = template.typicalAffectedCrops.filter((c) => monitoredCrops.includes(c));

  // Análise baseada em palavras-chave do título/resumo para determinar direção e magnitude
  const { direction, magnitude } = inferImpactFromText(event.title + ' ' + event.summary, event.category);

  const interpretation = buildInterpretation(event, template, direction, magnitude, affectedCrops);

  return {
    eventId: event.id,
    category: event.category,
    impactDirection: direction,
    impactMagnitude: magnitude,
    timeHorizon: inferTimeHorizon(event.category, magnitude),
    whatHappened: event.summary,
    whatItMeans: interpretation.whatItMeans,
    probableImpact: interpretation.probableImpact,
    marketReaction: interpretation.marketReaction,
    risks: interpretation.risks,
    opportunities: interpretation.opportunities,
    suggestedAction: interpretation.suggestedAction,
    affectedInputs: template.typicalAffectedInputs,
    affectedCrops,
    confidenceLevel: 'media',
  };
}

/**
 * Infere direção e magnitude do impacto a partir do texto do evento.
 */
function inferImpactFromText(
  text: string,
  category: MarketCategory
): { direction: ImpactDirection; magnitude: ImpactMagnitude } {
  const lower = text.toLowerCase();

  // Palavras de alta negativa
  const negativeHighWords = ['crise', 'colapso', 'embargo', 'sanção', 'guerra', 'escassez', 'seca severa', 'quebra de safra'];
  // Palavras de alta positiva
  const positiveHighWords = ['recorde', 'máxima histórica', 'forte alta', 'boom', 'expansão acelerada'];
  // Palavras de baixa negativa
  const negativeMedWords = ['alta', 'aumento', 'elevação', 'pressão', 'déficit', 'queda de oferta', 'redução de estoque'];
  // Palavras de baixa positiva
  const positiveMedWords = ['queda', 'redução', 'baixa', 'excedente', 'safra recorde', 'boa safra', 'chuvas regulares'];

  let direction: ImpactDirection = 'neutro';
  let magnitude: ImpactMagnitude = 'baixo';

    // Para commodities: alta = positivo para receita
  // Para insumos: alta = negativo para custo
  const isInputCategory = ['fertilizantes', 'defensivos', 'sementes', 'energia_combustivel', 'logistica_frete', 'credito_rural'].includes(category);
  const isCommodityCategory = ['commodities_agricolas', 'cambio_dolar'].includes(category);

  if (negativeHighWords.some((w) => lower.includes(w))) {
    direction = isInputCategory ? 'negativo' : isCommodityCategory ? 'positivo' : 'negativo';
    magnitude = 'critico';
  } else if (positiveHighWords.some((w) => lower.includes(w))) {
    direction = isInputCategory ? 'negativo' : isCommodityCategory ? 'positivo' : 'positivo';
    magnitude = 'alto';
  } else if (negativeMedWords.some((w) => lower.includes(w))) {
    direction = isInputCategory ? 'negativo' : isCommodityCategory ? 'positivo' : 'negativo';
    magnitude = 'moderado';
  } else if (positiveMedWords.some((w) => lower.includes(w))) {
    direction = isInputCategory ? 'positivo' : isCommodityCategory ? 'negativo' : 'positivo';
    magnitude = 'moderado';
  }

  // Refinamento específico para Dólar: Impacto misto
  if (category === 'cambio_dolar') {
    if (lower.includes('alta') || lower.includes('subida') || lower.includes('valorização')) {
      direction = 'neutro'; // Dólar alto ajuda venda mas encarece insumo
      magnitude = 'alto';
    }
  } else {
    direction = 'neutro';
    magnitude = 'baixo';
  }

  return { direction, magnitude };
}

/**
 * Infere o horizonte temporal do impacto.
 */
function inferTimeHorizon(category: MarketCategory, magnitude: ImpactMagnitude): TimeHorizon {
  if (category === 'cambio_dolar' || category === 'commodities_agricolas') {
    return magnitude === 'critico' ? 'imediato' : 'curto_prazo';
  }
  if (category === 'fertilizantes' || category === 'defensivos') {
    return 'medio_prazo';
  }
  if (category === 'geopolitica' || category === 'politica_internacional') {
    return magnitude === 'critico' ? 'curto_prazo' : 'medio_prazo';
  }
  return 'medio_prazo';
}

/**
 * Constrói a interpretação textual do impacto para o produtor.
 */
function buildInterpretation(
  event: MarketEvent,
  template: CategoryImpactTemplate,
  direction: ImpactDirection,
  magnitude: ImpactMagnitude,
  affectedCrops: string[]
): {
  whatItMeans: string;
  probableImpact: string;
  marketReaction: string;
  risks: string[];
  opportunities: string[];
  suggestedAction: string;
} {
  const cropsStr = affectedCrops.length > 0 ? affectedCrops.join(', ') : 'culturas monitoradas';
  const magnitudeLabel = { baixo: 'pequeno', moderado: 'moderado', alto: 'significativo', critico: 'crítico' }[magnitude];

  let whatItMeans = template.interpretationGuide;
  let probableImpact = '';
  let marketReaction = '';
  const risks: string[] = [];
  const opportunities: string[] = [];
  let suggestedAction = '';

  switch (event.category) {
    case 'fertilizantes':
      if (direction === 'negativo') {
        probableImpact = `Alta de fertilizantes pode elevar o custo de produção de ${cropsStr} em ${magnitude === 'critico' ? '15-25%' : magnitude === 'alto' ? '8-15%' : '3-8%'} dependendo do nível de adubação.`;
        marketReaction = 'Produtores tendem a antecipar compras ou reduzir doses. Distribuidores podem estocar preventivamente.';
        risks.push('Aumento do custo de produção por hectare.');
        risks.push('Redução de margem se preço da commodity não acompanhar.');
        opportunities.push('Compra antecipada antes de nova alta pode travar custo favorável.');
        suggestedAction = 'Avaliar antecipação de compra de fertilizantes para próxima safra. Comparar preço atual com projeções.';
      } else {
        probableImpact = `Queda de fertilizantes pode reduzir custo de produção de ${cropsStr}.`;
        opportunities.push('Oportunidade de compra a preço mais baixo para a próxima safra.');
        suggestedAction = 'Monitorar tendência. Se queda se confirmar, aguardar piso antes de comprar.';
      }
      break;

    case 'commodities_agricolas':
      if (direction === 'positivo') {
        probableImpact = `Alta de ${cropsStr} em Chicago pode melhorar a receita bruta do produtor. Basis local em Canarana-MT pode demorar a refletir a alta.`;
        marketReaction = 'Tradings tendem a aumentar oferta de contratos de venda futura. Produtores podem fixar preço.';
        opportunities.push('Janela de fixação de preço favorável para a safra atual ou próxima.');
        risks.push('Basis negativo pode absorver parte da alta de Chicago.');
        suggestedAction = 'Avaliar fixação de preço para parte da produção. Consultar cooperativa ou trading local.';
      } else if (direction === 'negativo') {
        probableImpact = `Queda de ${cropsStr} comprime margem do produtor. Monitorar custo de produção vs preço de venda.`;
        risks.push('Margem negativa se custo de produção superar preço de venda.');
        risks.push('Pressão sobre fluxo de caixa da fazenda.');
        suggestedAction = 'Revisar projeção de custo vs receita. Evitar fixar preço em queda.';
      }
      break;

    case 'cambio_dolar':
      if (direction === 'positivo') {
        probableImpact = 'Dólar alto melhora receita em reais (soja/milho cotados em dólar), mas encarece insumos importados (fertilizantes, defensivos).';
        marketReaction = 'Produtores com produção não fixada se beneficiam. Quem já fixou perde a valorização.';
        risks.push('Custo de insumos importados sobe junto com o dólar.');
        opportunities.push('Receita em reais aumenta para quem não fixou preço.');
        suggestedAction = 'Avaliar momento de fixação de preço da produção e compra de insumos.';
      } else {
        probableImpact = 'Dólar em queda reduz receita em reais mas barateia insumos importados.';
        opportunities.push('Oportunidade de compra de fertilizantes e defensivos a custo menor.');
        suggestedAction = 'Avaliar compra antecipada de insumos importados enquanto câmbio está favorável.';
      }
      break;

    case 'energia_combustivel':
      if (direction === 'negativo') {
        probableImpact = `Alta do diesel eleva custo operacional de campo (pulverização, colheita, transporte) para ${cropsStr}. Impacto estimado: ${magnitude === 'critico' ? 'R$ 80-150/ha' : 'R$ 20-60/ha'} dependendo da operação.`;
        marketReaction = 'Prestadores de serviço agrícola tendem a repassar alta para diárias e contratos.';
        risks.push('Aumento do custo de colheita e transporte.');
        risks.push('Prestadores de serviço podem reajustar preços.');
        suggestedAction = 'Revisar contratos de prestação de serviço. Avaliar estoque de diesel na fazenda.';
      }
      break;

    case 'logistica_frete':
      if (direction === 'negativo') {
        probableImpact = 'Alta do frete reduz basis e comprime margem do produtor de Canarana-MT, que depende de transporte rodoviário de longa distância.';
        risks.push('Basis negativo mais acentuado.');
        risks.push('Redução da margem líquida por hectare.');
        suggestedAction = 'Monitorar basis local. Avaliar armazenagem na fazenda para aguardar normalização do frete.';
      }
      break;

    case 'geopolitica':
    case 'politica_internacional':
      probableImpact = `Instabilidade geopolítica pode afetar oferta global de insumos (fertilizantes, petróleo) e demanda por ${cropsStr}.`;
      marketReaction = 'Mercados tendem a precificar incerteza com prêmio de risco. Volatilidade aumenta.';
      risks.push('Volatilidade de preços de insumos e commodities.');
      risks.push('Possível escassez de insumos específicos.');
      opportunities.push('Preços de commodities podem subir com redução de oferta global.');
      suggestedAction = 'Monitorar evolução. Evitar decisões de compra/venda em momento de alta volatilidade.';
      break;

    default:
      probableImpact = `Evento pode impactar ${cropsStr} de forma ${magnitudeLabel}.`;
      suggestedAction = 'Monitorar desdobramentos. Consultar fontes confiáveis (Conab, USDA, Cepea).';
  }

  return { whatItMeans, probableImpact, marketReaction, risks, opportunities, suggestedAction };
}

// ---------------------------------------------------------------------------
// GERADOR DE BOLETIM DE INTELIGÊNCIA DE MERCADO
// ---------------------------------------------------------------------------

/**
 * Gera um boletim consolidado de inteligência de mercado para o produtor.
 * Foco em interpretação, não em replicação de manchetes.
 */
export function generateMarketIntelligenceBulletin(
  analyses: MarketImpactAnalysis[],
  monitoredCrops: string[] = ['soja', 'milho']
): MarketIntelligenceBulletin {
  const now = new Date();

  // Calcular sentimento geral
  const negativeCount = analyses.filter((a) => a.impactDirection === 'negativo').length;
  const positiveCount = analyses.filter((a) => a.impactDirection === 'positivo').length;
  const criticalCount = analyses.filter((a) => a.impactMagnitude === 'critico').length;

  let overallSentiment: MarketIntelligenceBulletin['overallMarketSentiment'];
  let sentimentReason: string;

  if (criticalCount >= 2) {
    overallSentiment = 'volatil';
    sentimentReason = `${criticalCount} evento(s) crítico(s) identificado(s). Alta volatilidade.`;
  } else if (negativeCount > positiveCount * 1.5) {
    overallSentiment = 'desfavoravel';
    sentimentReason = `Predominância de fatores negativos (${negativeCount} vs ${positiveCount} positivos).`;
  } else if (positiveCount > negativeCount * 1.5) {
    overallSentiment = 'favoravel';
    sentimentReason = `Predominância de fatores positivos (${positiveCount} vs ${negativeCount} negativos).`;
  } else {
    overallSentiment = 'neutro';
    sentimentReason = 'Equilíbrio entre fatores positivos e negativos.';
  }

  // Consolidar riscos e oportunidades top
  const allRisks = analyses.flatMap((a) => a.risks).slice(0, 5);
  const allOpportunities = analyses.flatMap((a) => a.opportunities).slice(0, 3);

  // Gerar mensagem Telegram
  const telegramMessage = buildMarketTelegramMessage(analyses, overallSentiment, sentimentReason, monitoredCrops);

  return {
    generatedAt: now,
    period: `${now.toLocaleDateString('pt-BR')} — ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
    overallMarketSentiment: overallSentiment,
    sentimentReason,
    analyses,
    topRisks: allRisks,
    topOpportunities: allOpportunities,
    keyNumbers: [],
    telegramMessage,
  };
}

/**
 * Formata a mensagem de mercado para Telegram.
 * Foco em interpretação operacional, não em manchetes.
 */
function buildMarketTelegramMessage(
  analyses: MarketImpactAnalysis[],
  sentiment: string,
  sentimentReason: string,
  monitoredCrops: string[]
): string {
  const sentimentEmoji = sentiment === 'favoravel' ? '🟢' : sentiment === 'desfavoravel' ? '🔴' : sentiment === 'volatil' ? '⚠️' : '🟡';
  const cropsStr = monitoredCrops.join(', ');

  let msg = `${sentimentEmoji} <b>INTELIGÊNCIA DE MERCADO</b>\n`;
  msg += `<i>Culturas: ${cropsStr}</i>\n\n`;
  msg += `<b>Cenário Geral:</b> ${sentimentReason}\n\n`;

  // Filtrar apenas análises com impacto moderado ou maior
  const relevantAnalyses = analyses.filter(
    (a) => a.impactMagnitude !== 'baixo' && a.impactDirection !== 'neutro'
  );

  if (relevantAnalyses.length === 0) {
    msg += `<i>Sem eventos de mercado relevantes no período.</i>\n`;
    return msg;
  }

  for (const analysis of relevantAnalyses.slice(0, 4)) {
    const dirEmoji = analysis.impactDirection === 'positivo' ? '📈' : analysis.impactDirection === 'negativo' ? '📉' : '📊';
    const magLabel = { baixo: '', moderado: '⚡', alto: '🔥', critico: '🚨' }[analysis.impactMagnitude];
    msg += `${dirEmoji}${magLabel} <b>${CATEGORY_TEMPLATES[analysis.category].label}</b>\n`;
    msg += `• ${analysis.probableImpact}\n`;
    if (analysis.suggestedAction) {
      msg += `• <i>Ação: ${analysis.suggestedAction}</i>\n`;
    }
    msg += '\n';
  }

  if (relevantAnalyses.length > 4) {
    msg += `<i>+${relevantAnalyses.length - 4} outros eventos monitorados.</i>\n`;
  }

  return msg;
}

/**
 * Determina se um evento de mercado é relevante o suficiente para gerar alerta.
 * Refinado para reduzir ruído e focar em impacto real.
 */
export function isMarketEventAlertWorthy(analysis: MarketImpactAnalysis): boolean {
  // Sempre alertar para eventos críticos
  if (analysis.impactMagnitude === 'critico') return true;

  // Alertar para eventos de alto impacto se afetarem as culturas monitoradas
  if (analysis.impactMagnitude === 'alto' && analysis.affectedCrops.length > 0) return true;

  // Alertas moderados negativos só para categorias críticas (Insumos/Diesel)
  const criticalCategories: MarketCategory[] = ['fertilizantes', 'energia_combustivel', 'defensivos', 'cambio_dolar'];
  if (
    analysis.impactMagnitude === 'moderado' && 
    analysis.impactDirection === 'negativo' && 
    criticalCategories.includes(analysis.category)
  ) {
    return true;
  }

  return false;
}
