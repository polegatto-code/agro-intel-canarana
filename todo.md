# AgroIntel Canarana - TODO

## Fase 1: Schema e Banco de Dados Expandido
- [x] Pesquisar parametros agronômicos ideais
- [x] Criar schema inicial com 6 tabelas
- [x] Expandir schema com tabela de classificação de pulverização
- [x] Adicionar tabela de histórico diário (weather_daily_summary)
- [x] Adicionar tabela de análise de mercado (market_analysis_daily)
- [ ] Atualizar insumos monitorados (ureia, MAP, KCL, Super Simples, Super Triplo, Nitrato de Amônio, Sulfato de Amônio, NPK formulados)
- [ ] Atualizar culturas (soja, milho, sorgo, milheto, gergelim)

## Fase 2: Infraestrutura de Automação e Logging
- [x] Criar logger centralizado com níveis e contexto
- [x] Implementar Telegram service com prioridades e retry
- [x] Criar weather service com classificação operacional
- [x] Implementar scheduler base
- [ ] Criar endpoints tRPC para disparo manual
- [ ] Integrar com cron real (5h da manhã)
- [ ] Implementar job handler para múltiplos usuários

## Fase 3: Score Operacional e Análise de Riscos
- [ ] Implementar score numérico (0-100) além da classificação
- [ ] Identificar automaticamente riscos (deriva, volatilização, lavagem, absorção, estresse)
- [ ] Criar matriz de risco operacional
- [ ] Salvar análise de risco no banco

## Fase 4: Sistema de Deduplicação e Cache
- [ ] Implementar deduplicação de alertas Telegram
- [ ] Cache inteligente para APIs climáticas
- [ ] Cache para APIs de mercado
- [ ] Rate limiting para proteção de APIs
- [ ] Histórico bruto + histórico resumido

## Fase 5: Endpoints de Teste e Healthcheck
- [ ] Criar endpoints tRPC para teste de clima
- [ ] Criar endpoints tRPC para teste de mercado
- [ ] Criar endpoints tRPC para teste de Telegram
- [ ] Endpoint de execução manual de cron
- [ ] Healthcheck completo do sistema
- [ ] Monitoramento de APIs, banco, cron, Telegram, filas

## Fase 6: Integração com Cron Real
- [ ] Configurar cron para 5h da manhã
- [ ] Job handler para processar todos os usuários
- [ ] Tratamento de erros e retry
- [ ] Logging de execução
- [ ] Notificação de falhas críticas

## Fase 7: Análise de Notícias com LLM
- [ ] Implementar busca de notícias (dólar, insumos, geopolítica, clima EUA, China, exportações)
- [ ] Usar LLM para análise contextualizada
- [ ] Gerar interpretação do cenário (não apenas números)
- [ ] Cruzar impacto geopolítico com realidade brasileira
- [ ] Salvar análise no banco de dados

## Fase 8: Cron de Mercado com Boletim Interpretativo
- [ ] Coletar notícias agrícolas relevantes
- [ ] Usar LLM para gerar análise resumida
- [ ] Incluir tendências de fertilizantes, defensivos, dólar, soja, milho, logística
- [ ] Enviar boletim via Telegram com interpretação
- [ ] Salvar histórico de boletins

## Fase 9: Arquitetura para Múltiplas Localidades
- [ ] Preparar para múltiplas fazendas
- [ ] Preparar para múltiplas regiões
- [ ] Preparar para múltiplas culturas
- [ ] Preparar para múltiplos usuários
- [ ] Estrutura de recomendação agronômica baseada em cenário

## Fase 10: Dashboard e Visualizações
- [ ] Página de configurações completa
- [ ] Histórico com análise de tendências
- [ ] Gráficos de evolução
- [ ] Comparação de períodos
- [ ] Exportação de relatórios

## Fase 11: Testes e Otimização
- [ ] Testar fluxo completo de clima
- [ ] Testar geração de alertas de mercado
- [ ] Validar cálculos de classificação operacional
- [ ] Testar responsividade do design
- [ ] Otimizar performance de consultas

## Fase 12: Entrega Final
- [ ] Documentação de uso
- [ ] Guia de configuração inicial
- [ ] Checkpoint final
- [ ] Apresentação ao usuário
