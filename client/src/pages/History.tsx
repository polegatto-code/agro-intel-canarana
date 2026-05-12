import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Line,
  LineChart,
  Legend,
} from "recharts";
import {
  History,
  Cloud,
  TrendingUp,
  Bell,
  CheckCircle,
  XCircle,
  AlertTriangle,
  CalendarDays,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function classificationLabel(c: string) {
  const map: Record<string, { label: string; color: string }> = {
    excelente: { label: "Excelente", color: "bg-emerald-100 text-emerald-800" },
    boa: { label: "Boa", color: "bg-green-100 text-green-800" },
    moderada: { label: "Moderada", color: "bg-yellow-100 text-yellow-800" },
    ruim: { label: "Ruim", color: "bg-orange-100 text-orange-800" },
    "nao-recomendada": { label: "Não Recomendada", color: "bg-red-100 text-red-800" },
  };
  return map[c] || { label: c, color: "bg-slate-100 text-slate-800" };
}

function impactLabel(level: string) {
  const map: Record<string, { label: string; color: string }> = {
    low: { label: "Baixo", color: "bg-green-100 text-green-800" },
    medium: { label: "Médio", color: "bg-yellow-100 text-yellow-800" },
    high: { label: "Alto", color: "bg-red-100 text-red-800" },
  };
  return map[level] || { label: level, color: "bg-slate-100 text-slate-800" };
}

function formatDate(date: string | Date | null | undefined) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Chart configs ─────────────────────────────────────────────────────────────

const weatherChartConfig: ChartConfig = {
  temperature: { label: "Temperatura (°C)", color: "hsl(var(--chart-1))" },
  humidity: { label: "Umidade (%)", color: "hsl(var(--chart-2))" },
  windSpeed: { label: "Vento (km/h)", color: "hsl(var(--chart-3))" },
};

// ─── Main Component ────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const { isAuthenticated, loading } = useAuth();
  const [weatherDays, setWeatherDays] = useState<number>(7);

  const weatherQuery = trpc.weather.getHistory.useQuery(
    { days: weatherDays },
    { enabled: isAuthenticated }
  );

  const alertsQuery = trpc.marketAlerts.list.useQuery(
    { limit: 50 },
    { enabled: isAuthenticated }
  );

  const notificationsQuery = trpc.notifications.getHistory.useQuery(
    { limit: 30 },
    { enabled: isAuthenticated }
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Faça login para visualizar o histórico.</p>
      </div>
    );
  }

  // Prepare chart data from weather history
  const chartData = (weatherQuery.data || [])
    .slice()
    .reverse()
    .map((log) => ({
      date: new Date(log.createdAt).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      }),
      temperature: parseFloat(String(log.temperature)),
      humidity: log.humidity,
      windSpeed: parseFloat(String(log.windSpeed)),
    }));

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <History className="w-7 h-7 text-emerald-600" />
        <div>
          <h1 className="text-2xl font-bold">Histórico</h1>
          <p className="text-sm text-muted-foreground">
            Registros históricos de clima, alertas de mercado e notificações
          </p>
        </div>
      </div>

      <Tabs defaultValue="weather">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="weather" className="flex items-center gap-2">
            <Cloud className="w-4 h-4" />
            Clima
          </TabsTrigger>
          <TabsTrigger value="market" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Mercado
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notificações
          </TabsTrigger>
        </TabsList>

        {/* ── CLIMA ── */}
        <TabsContent value="weather" className="space-y-4">
          {/* Filter */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {weatherQuery.data?.length || 0} registros encontrados
            </p>
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-muted-foreground" />
              <Select
                value={String(weatherDays)}
                onValueChange={(v) => setWeatherDays(Number(v))}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Últimos 7 dias</SelectItem>
                  <SelectItem value="14">Últimos 14 dias</SelectItem>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Chart */}
          {chartData.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tendência Climática</CardTitle>
                <CardDescription>Temperatura, umidade e vento ao longo do tempo</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={weatherChartConfig} className="h-64">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="temperature"
                      stroke="var(--color-temperature)"
                      strokeWidth={2}
                      dot={false}
                      name="Temperatura (°C)"
                    />
                    <Line
                      type="monotone"
                      dataKey="humidity"
                      stroke="var(--color-humidity)"
                      strokeWidth={2}
                      dot={false}
                      name="Umidade (%)"
                    />
                    <Line
                      type="monotone"
                      dataKey="windSpeed"
                      stroke="var(--color-windSpeed)"
                      strokeWidth={2}
                      dot={false}
                      name="Vento (km/h)"
                    />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>
          ) : null}

          {/* Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Registros Detalhados</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {weatherQuery.isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : !weatherQuery.data || weatherQuery.data.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Cloud className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>Nenhum registro climático ainda.</p>
                  <p className="text-xs mt-1">
                    Os dados serão coletados automaticamente às 5h da manhã.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead className="text-right">Temp. (°C)</TableHead>
                        <TableHead className="text-right">Umidade (%)</TableHead>
                        <TableHead className="text-right">Vento (km/h)</TableHead>
                        <TableHead>Janela</TableHead>
                        <TableHead>Aplicação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {weatherQuery.data.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm">{formatDate(log.createdAt)}</TableCell>
                          <TableCell className="text-right font-medium">
                            {parseFloat(String(log.temperature)).toFixed(1)}
                          </TableCell>
                          <TableCell className="text-right">{log.humidity}</TableCell>
                          <TableCell className="text-right">
                            {parseFloat(String(log.windSpeed)).toFixed(1)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {log.applicationWindowStart != null && log.applicationWindowEnd != null
                              ? `${log.applicationWindowStart}h – ${log.applicationWindowEnd}h`
                              : "—"}
                          </TableCell>
                          <TableCell>
                            {log.isApplicationRecommended ? (
                              <span className="flex items-center gap-1 text-emerald-600 text-sm">
                                <CheckCircle className="w-4 h-4" />
                                Sim
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-red-500 text-sm">
                                <XCircle className="w-4 h-4" />
                                Não
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── MERCADO ── */}
        <TabsContent value="market" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {alertsQuery.data?.length || 0} alertas encontrados
            </p>
          </div>

          <Card>
            <CardContent className="p-0">
              {alertsQuery.isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : !alertsQuery.data || alertsQuery.data.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>Nenhum alerta de mercado ainda.</p>
                  <p className="text-xs mt-1">
                    Os alertas são gerados automaticamente com análise de IA.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Título</TableHead>
                        <TableHead>Impacto</TableHead>
                        <TableHead>Insumos Afetados</TableHead>
                        <TableHead>Notificado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {alertsQuery.data.map((alert) => {
                        const impact = impactLabel(alert.impactLevel);
                        return (
                          <TableRow key={alert.id}>
                            <TableCell className="text-sm whitespace-nowrap">
                              {formatDate(alert.createdAt)}
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">{alert.title}</p>
                                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                  {alert.summary}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={`${impact.color} border-0 text-xs`}>
                                {impact.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {(alert.affectedInputs as string[]).slice(0, 3).map((inp) => (
                                  <Badge
                                    key={inp}
                                    variant="outline"
                                    className="text-xs px-1.5 py-0"
                                  >
                                    {inp}
                                  </Badge>
                                ))}
                                {(alert.affectedInputs as string[]).length > 3 && (
                                  <Badge variant="outline" className="text-xs px-1.5 py-0">
                                    +{(alert.affectedInputs as string[]).length - 3}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {alert.notificationSent ? (
                                <span className="flex items-center gap-1 text-emerald-600 text-sm">
                                  <CheckCircle className="w-4 h-4" />
                                  Sim
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-slate-400 text-sm">
                                  <AlertTriangle className="w-4 h-4" />
                                  Não
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── NOTIFICAÇÕES ── */}
        <TabsContent value="notifications" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {notificationsQuery.data?.length || 0} notificações encontradas
            </p>
          </div>

          <Card>
            <CardContent className="p-0">
              {notificationsQuery.isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : !notificationsQuery.data || notificationsQuery.data.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>Nenhuma notificação enviada ainda.</p>
                  <p className="text-xs mt-1">
                    Configure o Telegram nas configurações para receber alertas.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Mensagem</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {notificationsQuery.data.map((notif) => (
                        <TableRow key={notif.id}>
                          <TableCell className="text-sm whitespace-nowrap">
                            {formatDate(notif.createdAt)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                notif.type === "weather"
                                  ? "border-blue-300 text-blue-700"
                                  : "border-amber-300 text-amber-700"
                              }
                            >
                              {notif.type === "weather" ? "Clima" : "Mercado"}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <p className="text-sm line-clamp-2">{notif.messageContent}</p>
                          </TableCell>
                          <TableCell>
                            {notif.deliveryStatus === "sent" ? (
                              <span className="flex items-center gap-1 text-emerald-600 text-sm">
                                <CheckCircle className="w-4 h-4" />
                                Enviado
                              </span>
                            ) : notif.deliveryStatus === "failed" ? (
                              <span className="flex items-center gap-1 text-red-500 text-sm">
                                <XCircle className="w-4 h-4" />
                                Falhou
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-slate-400 text-sm">
                                <AlertTriangle className="w-4 h-4" />
                                Pendente
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
