# KNOWN_ISSUES — Problemas Conhecidos

**Última atualização:** 12 de maio de 2026 — Fase 7

Este documento lista limitações, bugs conhecidos ou comportamentos inesperados que ainda não foram resolvidos.

| Problema | Descrição | Workaround / Status |
|---|---|---|
| **Stubs de Clima** | `weatherConsensus.ts` possui 5 adaptadores que são apenas stubs. | Atualmente o sistema depende 100% do OpenWeatherMap. |
| **Estimativa de Chuva (mm)** | O OpenWeatherMap (via `openweather.ts`) não retorna volume de chuva em mm para o forecast horário. | O `weatherConsensus.ts` usa uma estimativa baseada na probabilidade (ex: >70% = 5mm). |
| **Wind Direction / UV / Pressure** | A interface `WeatherData` atual não expõe esses campos. | Estão marcados como `undefined` no consenso climático até que a interface seja expandida. |
| **Divergência Multi-API** | O cálculo de divergência sempre indicará "baixo" ou "apenas uma fonte" enquanto houver apenas uma API ativa. | Funcionalidade plena aguarda implementação de segunda API (ex: WeatherAPI). |
| **Fadiga de Alerta (Market)** | O motor de mercado pode gerar muitos alertas se houver alta volatilidade. | Implementado filtro por magnitude (moderado/alto/crítico) como mitigação inicial. |
| **Scheduler Inativo** | O scheduler principal não é iniciado no bootstrap do servidor. | Requer ativação manual ou integração no `server/_core/index.ts`. |
| **Dívida de Tipagem** | Algumas iterações de Map no `revalidationEngine.ts` exigem `Array.from` para evitar erros de target ES. | Corrigido localmente, mas indica necessidade de revisão do `tsconfig.json`. |
