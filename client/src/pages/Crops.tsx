/**
 * AgroIntel Canarana — Fase 5: Agro & Mercado
 * Página: Culturas — Catálogo Agronômico da Fazenda
 *
 * Exibe:
 * - Catálogo de culturas cadastradas para a fazenda ativa
 * - Metadados técnicos (janela de plantio, exigências nutricionais)
 * - Status de safra (dentro/fora de época)
 * - Análise climática agronômica (Delta T, recomendação de pulverização)
 * - Bootstrap automático das culturas padrão
 */

import { trpc } from "@/lib/trpc";
import { useFarms } from "@/_core/hooks/useFarms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sprout,
  Thermometer,
  Wind,
  Droplets,
  Calendar,
  Leaf,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Info,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// TIPOS
// ---------------------------------------------------------------------------

interface CropCardProps {
  crop: {
    id: number;
    farmId: number;
    name: string;
    displayName: string;
    variety: string | null;
    plantingWindowStart: number;
    plantingWindowEnd: number;
    harvestWindowStart: number;
    harvestWindowEnd: number;
    cycleDays: number;
    minTempSpray: string;
    maxTempSpray: string;
    minHumiditySpray: number;
    maxHumiditySpray: number;
    maxWindSpeedSpray: string;
    minDeltaT: string;
    maxDeltaT: string;
    nitrogenKgHa: string | null;
    phosphorusKgHa: string | null;
    potassiumKgHa: string | null;
    sulfurKgHa: string | null;
    expectedYieldBagHa: string | null;
    notes: string | null;
    isActive: boolean;
  };
}

// ---------------------------------------------------------------------------
// UTILITÁRIOS
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  "", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

function monthRange(start: number, end: number): string {
  return `${MONTH_NAMES[start]}–${MONTH_NAMES[end]}`;
}

function getCropEmoji(name: string): string {
  const emojis: Record<string, string> = {
    soja: "🌱",
    milho: "🌽",
    sorgo: "🌾",
    milheto: "🌿",
    gergelim: "✨",
  };
  return emojis[name] ?? "🌾";
}

// ---------------------------------------------------------------------------
// COMPONENTE: STATUS DE SAFRA
// ---------------------------------------------------------------------------

function SeasonStatusBadge({ cropName }: { cropName: string }) {
  const { data, isLoading } = trpc.crops.seasonStatus.useQuery({ cropName });

  if (isLoading) return <Skeleton className="h-5 w-24" />;
  if (!data) return null;

  if (data.isPlantingWindow) {
    return (
      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs">
        <Calendar className="h-3 w-3 mr-1" />
        Época de plantio
      </Badge>
    );
  }
  if (data.isHarvestWindow) {
    return (
      <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">
        <Calendar className="h-3 w-3 mr-1" />
        Época de colheita
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs text-muted-foreground">
      <Calendar className="h-3 w-3 mr-1" />
      Fora de época
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// COMPONENTE: CARD DE CULTURA
// ---------------------------------------------------------------------------

function CropCard({ crop }: CropCardProps) {
  const utils = trpc.useUtils();

  const deactivate = trpc.crops.deactivate.useMutation({
    onSuccess: () => {
      toast.success(`Cultura ${crop.displayName} desativada.`);
      utils.crops.list.invalidate();
    },
    onError: (err: { message: string }) => toast.error(`Erro ao desativar: ${err.message}`),
  });

  return (
    <Card className="border hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{getCropEmoji(crop.name)}</span>
            <div>
              <CardTitle className="text-base font-semibold leading-tight">
                {crop.displayName}
              </CardTitle>
              {crop.variety && (
                <CardDescription className="text-xs mt-0.5">{crop.variety}</CardDescription>
              )}
            </div>
          </div>
          <SeasonStatusBadge cropName={crop.name} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Janelas de Plantio e Colheita */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-3">
            <p className="text-xs text-muted-foreground font-medium mb-1 flex items-center gap-1">
              <Leaf className="h-3 w-3" /> Plantio
            </p>
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              {monthRange(crop.plantingWindowStart, crop.plantingWindowEnd)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Ciclo: {crop.cycleDays} dias</p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-3">
            <p className="text-xs text-muted-foreground font-medium mb-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Colheita
            </p>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              {monthRange(crop.harvestWindowStart, crop.harvestWindowEnd)}
            </p>
            {crop.expectedYieldBagHa && (
              <p className="text-xs text-muted-foreground mt-0.5">
                ~{crop.expectedYieldBagHa} sc/ha
              </p>
            )}
          </div>
        </div>

        <Separator />

        {/* Condições para Pulverização */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <Droplets className="h-3 w-3" /> Condições para Pulverização
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <Thermometer className="h-3 w-3 text-orange-500 shrink-0" />
              <span className="text-muted-foreground">Temp:</span>
              <span className="font-medium">
                {crop.minTempSpray}–{crop.maxTempSpray}°C
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Droplets className="h-3 w-3 text-blue-500 shrink-0" />
              <span className="text-muted-foreground">Umid:</span>
              <span className="font-medium">
                {crop.minHumiditySpray}–{crop.maxHumiditySpray}%
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Wind className="h-3 w-3 text-slate-500 shrink-0" />
              <span className="text-muted-foreground">Vento:</span>
              <span className="font-medium">≤{crop.maxWindSpeedSpray} km/h</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Info className="h-3 w-3 text-purple-500 shrink-0" />
              <span className="text-muted-foreground">Delta T:</span>
              <span className="font-medium">
                {crop.minDeltaT}–{crop.maxDeltaT}°C
              </span>
            </div>
          </div>
        </div>

        {/* Exigências Nutricionais */}
        {(crop.nitrogenKgHa || crop.phosphorusKgHa || crop.potassiumKgHa) && (
          <>
            <Separator />
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <Sprout className="h-3 w-3" /> Nutrição (kg/ha)
              </p>
              <div className="flex flex-wrap gap-2">
                {crop.nitrogenKgHa && (
                  <Badge variant="outline" className="text-xs">
                    N: {crop.nitrogenKgHa}
                  </Badge>
                )}
                {crop.phosphorusKgHa && (
                  <Badge variant="outline" className="text-xs">
                    P₂O₅: {crop.phosphorusKgHa}
                  </Badge>
                )}
                {crop.potassiumKgHa && (
                  <Badge variant="outline" className="text-xs">
                    K₂O: {crop.potassiumKgHa}
                  </Badge>
                )}
                {crop.sulfurKgHa && (
                  <Badge variant="outline" className="text-xs">
                    S: {crop.sulfurKgHa}
                  </Badge>
                )}
              </div>
            </div>
          </>
        )}

        {/* Notas agronômicas */}
        {crop.notes && (
          <>
            <Separator />
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
              {crop.notes}
            </p>
          </>
        )}

        {/* Ação de desativar */}
        <div className="pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-destructive hover:text-destructive w-full"
            onClick={() => deactivate.mutate({ id: crop.id, farmId: crop.farmId })}
            disabled={deactivate.isPending}
          >
            <XCircle className="h-3 w-3 mr-1" />
            Remover cultura
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// COMPONENTE: ANÁLISE CLIMÁTICA ATUAL
// ---------------------------------------------------------------------------

function CurrentWeatherAnalysis({ farmId }: { farmId: number }) {
  const { data: crops, isLoading: cropsLoading } = trpc.crops.list.useQuery({ farmId });

  // Busca o clima mais recente da fazenda
  const { data: weatherData } = trpc.weather.getCurrent.useQuery(undefined, {
    refetchInterval: 5 * 60 * 1000,
  });

  if (cropsLoading || !weatherData || !crops || crops.length === 0) return null;

  const weather = {
    temperature: Number(weatherData.temperature),
    humidity: weatherData.humidity,
    windSpeed: Number(weatherData.windSpeed),
    rainProbability: weatherData.hourlyForecast?.[0]
      ? (weatherData.hourlyForecast.filter((h: { isRecommended: boolean }) => !h.isRecommended).length /
          weatherData.hourlyForecast.length) *
        100
      : 0,
  };

  return (
    <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Thermometer className="h-4 w-4 text-blue-600" />
          Análise Climática Atual para Pulverização
        </CardTitle>
        <CardDescription className="text-xs">
          Temp: {weather.temperature}°C · Umid: {weather.humidity}% · Vento: {weather.windSpeed} km/h
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {crops.map((crop) => (
            <CropWeatherAnalysisCard
              key={crop.id}
              cropName={crop.name}
              displayName={crop.displayName}
              weather={weather}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CropWeatherAnalysisCard({
  cropName,
  displayName,
  weather,
}: {
  cropName: string;
  displayName: string;
  weather: {
    temperature: number;
    humidity: number;
    windSpeed: number;
    rainProbability: number;
  };
}) {
  const { data, isLoading } = trpc.crops.analyzeConditions.useQuery({
    cropName,
    temperature: weather.temperature,
    humidity: weather.humidity,
    windSpeed: weather.windSpeed,
    rainProbability: weather.rainProbability,
  });

  if (isLoading) return <Skeleton className="h-20 rounded-lg" />;
  if (!data) return null;

  const isRecommended = data.sprayRecommendation === "recomendado";
  const isAcceptable = data.sprayRecommendation === "aceitavel";

  return (
    <div
      className={`rounded-lg p-3 border text-xs space-y-1.5 ${
        isRecommended
          ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20"
          : isAcceptable
          ? "bg-amber-50 border-amber-200 dark:bg-amber-950/20"
          : "bg-red-50 border-red-200 dark:bg-red-950/20"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium">
          {getCropEmoji(cropName)} {displayName.split(" ")[0]}
        </span>
        {isRecommended ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        ) : isAcceptable ? (
          <AlertTriangle className="h-4 w-4 text-amber-600" />
        ) : (
          <XCircle className="h-4 w-4 text-red-600" />
        )}
      </div>
      <p className="text-muted-foreground leading-tight">{data.sprayReason}</p>
      <div className="flex items-center gap-2 pt-0.5">
        <Badge
          variant="outline"
          className={`text-xs px-1.5 py-0 ${
            data.deltaTStatus === "ideal"
              ? "border-emerald-300 text-emerald-700"
              : data.deltaTStatus === "aceitavel"
              ? "border-amber-300 text-amber-700"
              : "border-red-300 text-red-700"
          }`}
        >
          ΔT {data.deltaT.toFixed(1)}°C
        </Badge>
        <Badge
          variant="outline"
          className={`text-xs px-1.5 py-0 ${
            data.rainRisk === "baixo"
              ? "border-emerald-300 text-emerald-700"
              : data.rainRisk === "moderado"
              ? "border-amber-300 text-amber-700"
              : "border-red-300 text-red-700"
          }`}
        >
          Chuva: {data.rainRisk}
        </Badge>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PÁGINA PRINCIPAL
// ---------------------------------------------------------------------------

export default function Crops() {
  const { activeFarm, loading: farmLoading } = useFarms();
  const utils = trpc.useUtils();

  const {
    data: crops,
    isLoading: cropsLoading,
    error,
  } = trpc.crops.list.useQuery(
    { farmId: activeFarm?.id ?? 0 },
    { enabled: !!activeFarm?.id }
  );

  const bootstrap = trpc.crops.bootstrapDefaults.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count} culturas padrão cadastradas com sucesso!`);
      utils.crops.list.invalidate();
    },
    onError: (err: { message: string }) => toast.error(`Erro ao cadastrar culturas: ${err.message}`),
  });

  const isLoading = farmLoading || cropsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!activeFarm) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
        <Sprout className="h-12 w-12 text-muted-foreground/40" />
        <p className="text-muted-foreground">Nenhuma fazenda ativa encontrada.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
        <AlertTriangle className="h-12 w-12 text-destructive/60" />
        <p className="text-muted-foreground">Erro ao carregar culturas: {error.message}</p>
      </div>
    );
  }

  const hasCrops = crops && crops.length > 0;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Sprout className="h-5 w-5 text-emerald-600" />
            Culturas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Catálogo agronômico de <strong>{activeFarm.name}</strong> — janelas de plantio,
            exigências nutricionais e condições para pulverização.
          </p>
        </div>
        {!hasCrops && (
          <Button
            onClick={() => bootstrap.mutate({ farmId: activeFarm.id })}
            disabled={bootstrap.isPending}
            className="shrink-0"
          >
            {bootstrap.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sprout className="h-4 w-4 mr-2" />
            )}
            Cadastrar culturas padrão
          </Button>
        )}
      </div>

      {/* Análise climática atual */}
      {hasCrops && <CurrentWeatherAnalysis farmId={activeFarm.id} />}

      {/* Catálogo de culturas */}
      {hasCrops ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(crops as Parameters<typeof CropCard>[0]['crop'][]).map((crop) => (
            <CropCard key={crop.id} crop={crop} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4 border rounded-xl bg-muted/20">
          <Sprout className="h-16 w-16 text-muted-foreground/30" />
          <div className="space-y-1">
            <p className="font-medium text-muted-foreground">Nenhuma cultura cadastrada</p>
            <p className="text-sm text-muted-foreground/70">
              Clique em "Cadastrar culturas padrão" para adicionar automaticamente as 5 culturas
              do Vale do Araguaia: Soja, Milho, Sorgo, Milheto e Gergelim.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
