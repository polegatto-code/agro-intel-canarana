import { skipToken } from "@/lib/skipToken";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Cloud, Droplets, Wind, TrendingUp, Calendar, Bell } from "lucide-react";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useFarms } from "@/_core/hooks/useFarms";


/**
 * Dashboard Principal - AgroIntel Canarana
 * Exibe condições climáticas, janela de aplicação e alertas de mercado
 */

/**
 * Dashboard Principal - AgroIntel Canarana
 * Exibe condições climáticas, janela de aplicação e alertas de mercado
 */
export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Get active farm
  const { activeFarm } = useFarms();

  // Queries
  const weatherQuery = trpc.weather.getCurrent.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const settingsQuery = trpc.settings.get.useQuery(
    activeFarm ? { farmId: activeFarm.id } : skipToken,
    {
      enabled: isAuthenticated && !!activeFarm,
    }
  );

  const alertsQuery = trpc.marketAlerts.list.useQuery(
    activeFarm ? { farmId: activeFarm.id, limit: 3 } : skipToken,
    { enabled: isAuthenticated && !!activeFarm }
  );

  // Update current time
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          <p className="mt-4 text-slate-300">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-white mb-4">AgroIntel Canarana</h1>
            <p className="text-xl text-slate-300 mb-8">
              Inteligência Agrícola Avançada para o Vale do Araguaia
            </p>
            <p className="text-lg text-slate-400 mb-12 max-w-2xl mx-auto">
              Monitore condições climáticas em tempo real, receba recomendações de aplicação otimizadas e análises de mercado com IA para tomar decisões mais inteligentes.
            </p>
            <Button
              onClick={() => (window.location.href = getLoginUrl())}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 text-lg"
            >
              Entrar com Manus
            </Button>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <Cloud className="w-8 h-8 text-blue-400 mb-2" />
                <CardTitle className="text-white">Clima em Tempo Real</CardTitle>
              </CardHeader>
              <CardContent className="text-slate-300">
                Monitore temperatura, umidade e vento com previsão horária para Canarana-MT
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <TrendingUp className="w-8 h-8 text-green-400 mb-2" />
                <CardTitle className="text-white">Janela de Aplicação</CardTitle>
              </CardHeader>
              <CardContent className="text-slate-300">
                Identifique automaticamente os melhores horários para aplicação de defensivos
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <Bell className="w-8 h-8 text-amber-400 mb-2" />
                <CardTitle className="text-white">Alertas de Mercado</CardTitle>
              </CardHeader>
              <CardContent className="text-slate-300">
                Análise IA de notícias sobre dólar, insumos e geopolítica com impacto local
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated view - Dashboard
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white">AgroIntel Canarana</h1>
              <p className="text-sm text-slate-400">Bem-vindo, {user?.name}</p>
            </div>
            <div className="text-right">
              <p className="text-slate-300 text-sm">
                {currentTime.toLocaleDateString('pt-BR')} às {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Climate Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Temperature Card */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-white flex items-center gap-2">
                <Cloud className="w-5 h-5 text-blue-400" />
                Temperatura
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-white">
                {weatherQuery.data?.temperature || '--'}°C
              </div>
              <p className="text-slate-400 text-sm mt-2">Condição atual em Canarana-MT</p>
            </CardContent>
          </Card>

          {/* Humidity Card */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-white flex items-center gap-2">
                <Droplets className="w-5 h-5 text-cyan-400" />
                Umidade Relativa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-white">
                {weatherQuery.data?.humidity || '--'}%
              </div>
              <p className="text-slate-400 text-sm mt-2">Ideal: 50-90%</p>
            </CardContent>
          </Card>

          {/* Wind Speed Card */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-white flex items-center gap-2">
                <Wind className="w-5 h-5 text-amber-400" />
                Velocidade do Vento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-white">
                {weatherQuery.data?.windSpeed || '--'} km/h
              </div>
              <p className="text-slate-400 text-sm mt-2">Máximo recomendado: 15 km/h</p>
            </CardContent>
          </Card>
        </div>

        {/* Application Window */}
        {weatherQuery.data && (
          <Card className="bg-gradient-to-r from-emerald-900 to-emerald-800 border-emerald-700 mb-8">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Janela de Aplicação Recomendada
              </CardTitle>
              <CardDescription className="text-emerald-100">
                Baseado nas condições climáticas de hoje
              </CardDescription>
            </CardHeader>
            <CardContent>
              {weatherQuery.data.isApplicationRecommended ? (
                <div className="bg-emerald-900 bg-opacity-50 rounded-lg p-6 border border-emerald-600">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-emerald-100 font-semibold">Aplicação RECOMENDADA</span>
                    <span className="bg-emerald-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
                      ✓ Excelente
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-emerald-200 text-sm">Início recomendado</p>
                      <p className="text-2xl font-bold text-white">
                        {weatherQuery.data.applicationWindowStart}:00
                      </p>
                    </div>
                    <div>
                      <p className="text-emerald-200 text-sm">Término recomendado</p>
                      <p className="text-2xl font-bold text-white">
                        {weatherQuery.data.applicationWindowEnd}:00
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-red-900 bg-opacity-50 rounded-lg p-6 border border-red-600">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <span className="text-red-100 font-semibold">Aplicação NÃO RECOMENDADA</span>
                  </div>
                  <p className="text-red-200 text-sm">
                    As condições climáticas não são favoráveis para aplicação hoje. Consulte o histórico de previsões.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Recent Market Alerts */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-amber-400" />
              Últimos Alertas de Mercado
            </CardTitle>
            <CardDescription className="text-slate-400">
              Análise de notícias agrícolas relevantes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {alertsQuery.data && alertsQuery.data.length > 0 ? (
              <div className="space-y-4">
                {alertsQuery.data.map((alert) => (
                  <div
                    key={alert.id}
                    className="bg-slate-700 rounded-lg p-4 border-l-4 border-amber-500"
                  >
                    <h4 className="font-semibold text-white mb-1">{alert.title}</h4>
                    <p className="text-slate-300 text-sm mb-2">{alert.summary}</p>
                    <div className="flex gap-2 flex-wrap">
                      {alert.affectedInputs.map((input) => (
                        <span
                          key={input}
                          className="bg-slate-600 text-slate-100 text-xs px-2 py-1 rounded"
                        >
                          {input}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-center py-8">
                Nenhum alerta de mercado no momento
              </p>
            )}
          </CardContent>
        </Card>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          <Button variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-700">
            Ver Histórico Completo
          </Button>
          <Button variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-700">
            Configurar Parâmetros
          </Button>
          <Button variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-700">
            Análise de Tendências
          </Button>
        </div>
      </div>
    </div>
  );
}
