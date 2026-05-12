import { skipToken } from "@/lib/skipToken";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Settings, Bell, Thermometer, Wind, Droplets, Wheat, FlaskConical, Send } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useFarms } from "@/_core/hooks/useFarms";


const AVAILABLE_CROPS = [
  { value: "soja", label: "Soja" },
  { value: "milho", label: "Milho" },
  { value: "algodao", label: "Algodão" },
  { value: "sorgo", label: "Sorgo" },
  { value: "feijao", label: "Feijão" },
  { value: "arroz", label: "Arroz" },
  { value: "cana", label: "Cana-de-açúcar" },
  { value: "trigo", label: "Trigo" },
];

const AVAILABLE_INPUTS = [
  { value: "ureia", label: "Ureia" },
  { value: "map", label: "MAP" },
  { value: "kcl", label: "KCl" },
  { value: "super-simples", label: "Superfosfato Simples" },
  { value: "super-triplo", label: "Superfosfato Triplo" },
  { value: "nitrato-amonio", label: "Nitrato de Amônio" },
  { value: "sulfato-amonio", label: "Sulfato de Amônio" },
  { value: "npk-20-00-20", label: "NPK 20-00-20" },
  { value: "npk-30-00-20", label: "NPK 30-00-20" },
  { value: "glifosato", label: "Glifosato" },
  { value: "fungicida", label: "Fungicida" },
  { value: "inseticida", label: "Inseticida" },
];

export default function SettingsPage() {
  const { isAuthenticated, loading } = useAuth();
  const { activeFarm } = useFarms();

  const settingsQuery = trpc.settings.get.useQuery(
    activeFarm ? { farmId: activeFarm.id } : skipToken,
    {
      enabled: isAuthenticated && !!activeFarm,
    }
  );

  const updateMutation = trpc.settings.update.useMutation({
    onSuccess: () => {
      toast.success("Configurações salvas com sucesso!");
      settingsQuery.refetch();
    },
    onError: (err) => {
      toast.error("Erro ao salvar configurações: " + err.message);
    },
  });

  // Form state
  const [telegramToken, setTelegramToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [minHumidity, setMinHumidity] = useState(50);
  const [maxHumidity, setMaxHumidity] = useState(90);
  const [maxTemperature, setMaxTemperature] = useState(30);
  const [maxWindSpeed, setMaxWindSpeed] = useState(15);
  const [monitoredCrops, setMonitoredCrops] = useState<string[]>(["soja", "milho"]);
  const [monitoredInputs, setMonitoredInputs] = useState<string[]>(["ureia", "map", "kcl"]);
  const [marketAlertFrequency, setMarketAlertFrequency] = useState<"daily" | "weekly">("daily");
  const [enableWeatherNotifications, setEnableWeatherNotifications] = useState(true);
  const [enableMarketNotifications, setEnableMarketNotifications] = useState(true);

  // Populate form when data loads
  useEffect(() => {
    if (settingsQuery.data) {
      const s = settingsQuery.data;
      setTelegramToken(s.telegramToken || "");
      setTelegramChatId(s.telegramChatId || "");
      setMinHumidity(s.minHumidity ?? 50);
      setMaxHumidity(s.maxHumidity ?? 90);
      setMaxTemperature(s.maxTemperature ?? 30);
      setMaxWindSpeed(s.maxWindSpeed ?? 15);
      setMonitoredCrops((s.monitoredCrops as string[]) || ["soja", "milho"]);
      setMonitoredInputs((s.monitoredInputs as string[]) || ["ureia", "map", "kcl"]);
      setMarketAlertFrequency(s.marketAlertFrequency || "daily");
      setEnableWeatherNotifications(s.enableWeatherNotifications ?? true);
      setEnableMarketNotifications(s.enableMarketNotifications ?? true);
    }
  }, [settingsQuery.data]);

  const toggleCrop = (value: string) => {
    setMonitoredCrops((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    );
  };

  const toggleInput = (value: string) => {
    setMonitoredInputs((prev) =>
      prev.includes(value) ? prev.filter((i) => i !== value) : [...prev, value]
    );
  };

  const handleSave = () => {
    if (!activeFarm) {
      toast.error("Nenhuma fazenda selecionada");
      return;
    }
    updateMutation.mutate({
      farmId: activeFarm.id,
      telegramToken,
      telegramChatId,
      minHumidity,
      maxHumidity,
      maxTemperature,
      maxWindSpeed,
      monitoredCrops,
      monitoredInputs,
      marketAlertFrequency,
      enableWeatherNotifications,
      enableMarketNotifications,
    });
  };

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
        <p className="text-muted-foreground">Faça login para acessar as configurações.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Settings className="w-7 h-7 text-emerald-600" />
        <div>
          <h1 className="text-2xl font-bold">Configurações</h1>
          <p className="text-sm text-muted-foreground">
            Personalize os parâmetros do sistema AgroIntel para sua fazenda
          </p>
        </div>
      </div>

      {settingsQuery.isLoading && (
        <div className="text-center text-muted-foreground py-8">Carregando configurações...</div>
      )}

      {/* Telegram */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-500" />
            Notificações via Telegram
          </CardTitle>
          <CardDescription>
            Configure o bot do Telegram para receber alertas climáticos e de mercado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="telegram-token">Token do Bot</Label>
            <Input
              id="telegram-token"
              type="password"
              placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
              value={telegramToken}
              onChange={(e) => setTelegramToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Obtenha o token criando um bot com o{" "}
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                @BotFather
              </a>{" "}
              no Telegram
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="telegram-chat-id">Chat ID</Label>
            <Input
              id="telegram-chat-id"
              placeholder="-100123456789"
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              ID do chat ou grupo onde as mensagens serão enviadas. Use{" "}
              <a
                href="https://t.me/userinfobot"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                @userinfobot
              </a>{" "}
              para descobrir seu ID
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Climate Parameters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Thermometer className="w-5 h-5 text-orange-500" />
            Parâmetros Climáticos
          </CardTitle>
          <CardDescription>
            Defina os limites para classificação da janela de aplicação de defensivos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Humidity Range */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Droplets className="w-4 h-4 text-cyan-500" />
                Umidade Relativa
              </Label>
              <span className="text-sm font-medium text-muted-foreground">
                {minHumidity}% – {maxHumidity}%
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground w-16">Mínima</span>
                <Slider
                  min={0}
                  max={100}
                  step={5}
                  value={[minHumidity]}
                  onValueChange={([v]) => setMinHumidity(v)}
                  className="flex-1"
                />
                <span className="text-sm font-medium w-12 text-right">{minHumidity}%</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground w-16">Máxima</span>
                <Slider
                  min={0}
                  max={100}
                  step={5}
                  value={[maxHumidity]}
                  onValueChange={([v]) => setMaxHumidity(v)}
                  className="flex-1"
                />
                <span className="text-sm font-medium w-12 text-right">{maxHumidity}%</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Max Temperature */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Thermometer className="w-4 h-4 text-red-500" />
                Temperatura Máxima para Aplicação
              </Label>
              <span className="text-sm font-medium text-muted-foreground">{maxTemperature}°C</span>
            </div>
            <div className="flex items-center gap-4">
              <Slider
                min={20}
                max={45}
                step={1}
                value={[maxTemperature]}
                onValueChange={([v]) => setMaxTemperature(v)}
                className="flex-1"
              />
              <span className="text-sm font-medium w-12 text-right">{maxTemperature}°C</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Acima deste valor, a aplicação não é recomendada por risco de volatilização
            </p>
          </div>

          <Separator />

          {/* Max Wind Speed */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Wind className="w-4 h-4 text-slate-500" />
                Velocidade Máxima do Vento
              </Label>
              <span className="text-sm font-medium text-muted-foreground">{maxWindSpeed} km/h</span>
            </div>
            <div className="flex items-center gap-4">
              <Slider
                min={5}
                max={30}
                step={1}
                value={[maxWindSpeed]}
                onValueChange={([v]) => setMaxWindSpeed(v)}
                className="flex-1"
              />
              <span className="text-sm font-medium w-16 text-right">{maxWindSpeed} km/h</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Acima deste valor, há risco de deriva do defensivo
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Monitored Crops */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wheat className="w-5 h-5 text-yellow-600" />
            Culturas Monitoradas
          </CardTitle>
          <CardDescription>
            Selecione as culturas para personalizar os alertas de mercado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_CROPS.map((crop) => {
              const isSelected = monitoredCrops.includes(crop.value);
              return (
                <Badge
                  key={crop.value}
                  variant={isSelected ? "default" : "outline"}
                  className={`cursor-pointer select-none transition-colors ${
                    isSelected
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
                      : "hover:bg-accent"
                  }`}
                  onClick={() => toggleCrop(crop.value)}
                >
                  {crop.label}
                </Badge>
              );
            })}
          </div>
          {monitoredCrops.length === 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Selecione ao menos uma cultura para monitoramento
            </p>
          )}
        </CardContent>
      </Card>

      {/* Monitored Inputs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-purple-500" />
            Insumos Monitorados
          </CardTitle>
          <CardDescription>
            Selecione os insumos cujos preços e disponibilidade serão acompanhados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_INPUTS.map((input) => {
              const isSelected = monitoredInputs.includes(input.value);
              return (
                <Badge
                  key={input.value}
                  variant={isSelected ? "default" : "outline"}
                  className={`cursor-pointer select-none transition-colors ${
                    isSelected
                      ? "bg-purple-600 hover:bg-purple-700 text-white border-purple-600"
                      : "hover:bg-accent"
                  }`}
                  onClick={() => toggleInput(input.value)}
                >
                  {input.label}
                </Badge>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-500" />
            Preferências de Notificação
          </CardTitle>
          <CardDescription>
            Controle quais tipos de alertas você deseja receber via Telegram
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Alertas Climáticos</Label>
              <p className="text-sm text-muted-foreground">
                Receba notificações diárias sobre janela de aplicação
              </p>
            </div>
            <Switch
              checked={enableWeatherNotifications}
              onCheckedChange={setEnableWeatherNotifications}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Alertas de Mercado</Label>
              <p className="text-sm text-muted-foreground">
                Receba análises de notícias sobre insumos, dólar e geopolítica
              </p>
            </div>
            <Switch
              checked={enableMarketNotifications}
              onCheckedChange={setEnableMarketNotifications}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Frequência dos Alertas de Mercado</Label>
            <Select
              value={marketAlertFrequency}
              onValueChange={(v) => setMarketAlertFrequency(v as "daily" | "weekly")}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Diário</SelectItem>
                <SelectItem value="weekly">Semanal</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-3 pb-6">
        <Button
          variant="outline"
          onClick={() => settingsQuery.refetch()}
          disabled={settingsQuery.isLoading}
        >
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-32"
        >
          {updateMutation.isPending ? (
            <span className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Salvando...
            </span>
          ) : (
            "Salvar Configurações"
          )}
        </Button>
      </div>
    </div>
  );
}
