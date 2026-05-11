# AgroIntel Canarana - TODO

## Fase 1: Schema e Banco de Dados Expandido
- [x] Pesquisar parametros agronômicos ideais
- [x] Criar schema inicial com 6 tabelas
- [x] Expandir schema com tabela de classificação de pulverização
- [x] Adicionar tabela de histórico diário (weather_daily_summary)
- [x] Adicionar tabela de análise de mercado (market_analysis_daily)
- [x] Atualizar insumos monitorados (ureia, MAP, KCL, Super Simples, Super Triplo, Nitrato de Amônio, Sulfato de Amônio, NPK formulados)
- [x] Atualizar culturas (soja, milho, sorgo, milheto, gergelim)

## Fase 2: Infraestrutura de Automação e Logging
- [x] Criar logger centralizado com níveis e contexto
- [x] Implementar Telegram service com prioridades e retry
- [x] Criar weather service com classificação operacional
- [x] Implementar scheduler base
- [x] Criar endpoints tRPC para disparo manual
- [x] Integrar com cron real (5h da manhã)
- [x] Implementar job handler para múltiplos usuários

## Fase 3: Score Operacional e Análise de Riscos
- [x] Implementar score numérico (0-100) além da classificação
- [x] Identificar automaticamente riscos (deriva, volatilização, lavagem, absorção, estresse)
- [x] Criar matriz de risco operacional
- [x] Salvar análise de risco no banco

## Fase 4: Sistema de Deduplicação e Cache
- [x] Implementar deduplicação de alertas Telegram
- [x] Cache inteligente para APIs climáticas
- [x] Cache para APIs de mercado
- [x] Rate limiting para proteção de APIs
- [x] Histórico bruto + histórico resumido

## Fase 5: Endpoints de Teste e Healthcheck
- [x] Criar endpoints tRPC para teste de clima
- [x] Criar endpoints tRPC para teste de mercado
- [x] Criar endpoints tRPC para teste de Telegram
- [x] Endpoint de execução manual de cron
- [x] Healthcheck completo do sistema
- [x] Monitoramento de APIs, banco, cron, Telegram, filas

## Fase 6: Integração com Cron Real
- [x] Configurar cron para 5h da manhã
- [x] Job handler para processar todos os usuários
- [x] Tratamento de erros e retry
- [x] Logging de execução
- [x] Notificação de falhas críticas

## Fase 7: Análise de Notícias com LLM
- [x] Implementar busca de notícias (dólar, insumos, geopolítica, clima EUA, China, exportações)
- [x] Usar LLM para análise contextualizada
- [x] Gerar interpretação do cenário (não apenas números)
- [x] Cruzar impacto geopolítico com realidade brasileira
- [x] Salvar análise no banco de dados

## Fase 8: Robustez e Observabilidade
- [x] Criar serviço de métricas (performance, erros, latência)
- [x] Implementar circuit breaker para APIs externas
- [x] Criar retry service com exponencial backoff
- [x] Integrar metrics em todos os fluxos críticos
- [x] Integrar circuit breaker em weather, news, telegram
- [x] Integrar retry em todas as operações críticas
- [x] Implementar logs estruturados com correlation IDs
- [x] Adicionar request IDs e execution IDs
- [x] Criar testes ponta a ponta automatizados
- [ ] Adicionar monitoramento Prometheus-style
- [ ] Implementar graceful shutdown
- [x] Criar Docker e docker-compose
- [ ] Estruturar multi-tenant corretamente
- [ ] Criar dashboard administrativo
- [x] Documentação técnica completa
- [ ] Validação contínua simulando produção

## Fase 9: Preparação para Produção
- [ ] Integrar cronJobService no bootstrap do servidor
- [ ] Validar execução automática real às 5h
- [ ] Testar fluxo completo ponta a ponta
- [ ] Validar estabilidade em execução contínua
- [ ] Preparar estrutura para múltiplos usuários
- [ ] Preparar estrutura para múltiplas fazendas
- [ ] Preparar estrutura para múltiplas regiões
- [ ] Criar scripts de migração
- [ ] Criar scripts de bootstrap
- [ ] Documentar troubleshooting
- [ ] Criar diagrama da arquitetura

## Fase 10: Dashboard Operacional
- [ ] Dashboard com status dos serviços
- [ ] Visualização de alertas
- [ ] Histórico de execuções
- [ ] Métricas em tempo real
- [ ] Fila de jobs
- [ ] Logs resumidos
- [ ] Gráficos de tendência
- [ ] Filtros por fazenda/cultura/região

## Fase 11: Inteligência Agronômica Avançada
- [ ] Recomendação de aplicação baseada em clima
- [ ] Janela operacional otimizada
- [ ] Tendência climática
- [ ] Risco de deriva
- [ ] Risco fitossanitário
- [ ] Impacto de mercado
- [ ] Previsão de preços
- [ ] Análise comparativa histórica

## Fase 12: Validação e Deploy
- [ ] Executar validação contínua simulando produção
- [ ] Testar failover e recuperação
- [ ] Testar escalabilidade
- [ ] Testar performance sob carga
- [ ] Validar segurança
- [ ] Criar checkpoint final
- [ ] Deploy em produção
