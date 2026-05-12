import { 
  int, 
  mysqlEnum, 
  mysqlTable, 
  text, 
  timestamp, 
  varchar,
  decimal,
  json,
  boolean
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  currentFarmId: int("currentFarmId"), // FK para farms.id - fazenda ativa do usuário
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Farms (propriedades agrícolas) - suporte multi-fazenda
 */
export const farms = mysqlTable("farms", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // Proprietário da fazenda
  
  // Farm information
  name: varchar("name", { length: 255 }).notNull(),
  municipio: varchar("municipio", { length: 255 }).notNull(),
  
  // Geographic coordinates
  latitude: decimal("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: decimal("longitude", { precision: 11, scale: 8 }).notNull(),
  altitude: decimal("altitude", { precision: 7, scale: 2 }), // Opcional
  
  // Agricultural information
  mainCrop: varchar("mainCrop", { length: 64 }).notNull(), // e.g., 'soja', 'milho'
  agriculturalWindowStart: int("agriculturalWindowStart"), // Mês de início (1-12)
  agriculturalWindowEnd: int("agriculturalWindowEnd"), // Mês de término (1-12)
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Farm = typeof farms.$inferSelect;
export type InsertFarm = typeof farms.$inferInsert;

/**
 * Farm users - relação N:N entre users e farms (suporte a RBAC futuro)
 */
export const farmUsers = mysqlTable("farm_users", {
  id: int("id").autoincrement().primaryKey(),
  farmId: int("farmId").notNull(),
  userId: int("userId").notNull(),
  
  // Role na fazenda
  role: mysqlEnum("role", ["owner", "manager", "viewer"]).default("viewer").notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FarmUser = typeof farmUsers.$inferSelect;
export type InsertFarmUser = typeof farmUsers.$inferInsert;

/**
 * User settings for the agricultural intelligence system
 */
export const userSettings = mysqlTable("userSettings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  farmId: int("farmId").notNull(), // FK para farms.id - configurações por fazenda
  
  // Telegram configuration
  telegramToken: varchar("telegramToken", { length: 255 }).notNull(),
  telegramChatId: varchar("telegramChatId", { length: 255 }).notNull(),
  
  // Application parameters (climate thresholds)
  minHumidity: int("minHumidity").default(50).notNull(),
  maxHumidity: int("maxHumidity").default(90).notNull(),
  maxTemperature: int("maxTemperature").default(30).notNull(),
  maxWindSpeed: int("maxWindSpeed").default(15).notNull(),
  
  // Monitored crops
  monitoredCrops: json("monitoredCrops").$type<string[]>().default(['soja', 'milho']).notNull(),
  
  // Market alert frequency
  marketAlertFrequency: mysqlEnum("marketAlertFrequency", ["daily", "weekly"]).default("daily").notNull(),
  
  // Monitored inputs - expanded list
  monitoredInputs: json("monitoredInputs").$type<string[]>().default([
    'ureia',
    'map',
    'kcl',
    'super-simples',
    'super-triplo',
    'nitrato-amonio',
    'sulfato-amonio',
    'npk-20-00-20',
    'npk-30-00-20'
  ]).notNull(),
  
  // Enable/disable notifications
  enableWeatherNotifications: boolean("enableWeatherNotifications").default(true).notNull(),
  enableMarketNotifications: boolean("enableMarketNotifications").default(true).notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = typeof userSettings.$inferInsert;

/**
 * Weather data logs for Canarana-MT
 */
export const weatherLogs = mysqlTable("weatherLogs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  farmId: int("farmId").notNull(), // FK para farms.id - dados climáticos por fazenda
  
  // Current conditions
  temperature: decimal("temperature", { precision: 5, scale: 2 }).notNull(),
  humidity: int("humidity").notNull(),
  windSpeed: decimal("windSpeed", { precision: 5, scale: 2 }).notNull(),
  
  // Forecast data (JSON with hourly breakdown)
  hourlyForecast: json("hourlyForecast").$type<Array<{
    hour: number;
    temperature: number;
    humidity: number;
    windSpeed: number;
    isRecommended: boolean;
    classification: 'excelente' | 'boa' | 'moderada' | 'ruim' | 'nao-recomendada';
  }>>().notNull(),
  
  // Calculated application window
  applicationWindowStart: int("applicationWindowStart"),
  applicationWindowEnd: int("applicationWindowEnd"),
  isApplicationRecommended: boolean("isApplicationRecommended").default(false).notNull(),
  
  // Metadata
  source: varchar("source", { length: 64 }).default("openweathermap").notNull(),
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WeatherLog = typeof weatherLogs.$inferSelect;
export type InsertWeatherLog = typeof weatherLogs.$inferInsert;

/**
 * Daily weather summary for historical analysis
 */
export const weatherDailySummary = mysqlTable("weatherDailySummary", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  farmId: int("farmId").notNull(), // FK para farms.id
  
  // Date of the summary
  summaryDate: timestamp("summaryDate").notNull(),
  
  // Daily metrics
  minTemperature: decimal("minTemperature", { precision: 5, scale: 2 }).notNull(),
  maxTemperature: decimal("maxTemperature", { precision: 5, scale: 2 }).notNull(),
  avgHumidity: int("avgHumidity").notNull(),
  avgWindSpeed: decimal("avgWindSpeed", { precision: 5, scale: 2 }).notNull(),
  rainProbability: int("rainProbability").notNull(),
  
  // Operational classification
  operationalClassification: mysqlEnum("operationalClassification", [
    'excelente',
    'boa',
    'moderada',
    'ruim',
    'nao-recomendada'
  ]).notNull(),
  
  // Application window
  bestApplicationStart: int("bestApplicationStart"),
  bestApplicationEnd: int("bestApplicationEnd"),
  
  // Summary notes
  notes: text("notes"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WeatherDailySummary = typeof weatherDailySummary.$inferSelect;
export type InsertWeatherDailySummary = typeof weatherDailySummary.$inferInsert;

/**
 * Market alerts and agricultural news
 */
export const marketAlerts = mysqlTable("marketAlerts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  farmId: int("farmId").notNull(), // FK para farms.id - alertas por fazenda
  
  // Alert content
  title: varchar("title", { length: 255 }).notNull(),
  summary: text("summary").notNull(),
  
  // LLM-generated analysis
  aiAnalysis: text("aiAnalysis"),
  
  // Affected inputs/commodities
  affectedInputs: json("affectedInputs").$type<string[]>().notNull(),
  affectedCrops: json("affectedCrops").$type<string[]>().notNull(),
  
  // Impact level
  impactLevel: mysqlEnum("impactLevel", ["low", "medium", "high"]).default("medium").notNull(),
  
  // Source information
  source: varchar("source", { length: 255 }),
  sourceUrl: varchar("sourceUrl", { length: 500 }),
  
  // Notification status
  notificationSent: boolean("notificationSent").default(false).notNull(),
  notificationSentAt: timestamp("notificationSentAt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MarketAlert = typeof marketAlerts.$inferSelect;
export type InsertMarketAlert = typeof marketAlerts.$inferInsert;

/**
 * Daily market analysis summary
 */
export const marketAnalysisDaily = mysqlTable("marketAnalysisDaily", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  farmId: int("farmId").notNull(), // FK para farms.id
  
  // Date of the analysis
  analysisDate: timestamp("analysisDate").notNull(),
  
  // Analysis content
  title: varchar("title", { length: 255 }).notNull(),
  summary: text("summary").notNull(),
  
  // LLM-generated interpretation
  interpretation: text("interpretation").notNull(),
  
  // Topics covered
  topics: json("topics").$type<string[]>().notNull(),
  
  // Key insights
  keyInsights: json("keyInsights").$type<string[]>().notNull(),
  
  // Affected inputs and crops
  affectedInputs: json("affectedInputs").$type<string[]>().notNull(),
  affectedCrops: json("affectedCrops").$type<string[]>().notNull(),
  
  // Overall impact assessment
  overallImpact: mysqlEnum("overallImpact", ["positive", "neutral", "negative"]).default("neutral").notNull(),
  
  // Notification status
  notificationSent: boolean("notificationSent").default(false).notNull(),
  notificationSentAt: timestamp("notificationSentAt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MarketAnalysisDaily = typeof marketAnalysisDaily.$inferSelect;
export type InsertMarketAnalysisDaily = typeof marketAnalysisDaily.$inferInsert;

/**
 * Sent notifications log (for history)
 */
export const notificationLogs = mysqlTable("notificationLogs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  farmId: int("farmId").notNull(), // FK para farms.id
  
  // Notification type
  type: mysqlEnum("type", ["weather", "market"]).notNull(),
  
  // Reference to the alert/weather that triggered it
  referenceId: int("referenceId"),
  
  // Message content
  messageContent: text("messageContent").notNull(),
  
  // Delivery status
  deliveryStatus: mysqlEnum("deliveryStatus", ["pending", "sent", "failed"]).default("pending").notNull(),
  deliveryError: text("deliveryError"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  sentAt: timestamp("sentAt"),
});

export type NotificationLog = typeof notificationLogs.$inferSelect;
export type InsertNotificationLog = typeof notificationLogs.$inferInsert;

/**
 * Crop catalog — metadados agronômicos por fazenda
 * Módulo 1 da Fase 5: Base Agronômica
 */
export const crops = mysqlTable("crops", {
  id: int("id").autoincrement().primaryKey(),
  farmId: int("farmId").notNull(), // FK para farms.id — isolamento multi-fazenda

  // Identificação da cultura
  name: varchar("name", { length: 64 }).notNull(),  // e.g., 'soja', 'milho'
  displayName: varchar("displayName", { length: 128 }).notNull(), // e.g., 'Soja (Glycine max)'
  variety: varchar("variety", { length: 128 }), // Variedade/cultivar opcional

  // Janela de plantio para a região (meses 1-12)
  plantingWindowStart: int("plantingWindowStart").notNull(), // Mês de início do plantio
  plantingWindowEnd: int("plantingWindowEnd").notNull(),   // Mês de fim do plantio
  harvestWindowStart: int("harvestWindowStart").notNull(),  // Mês de início da colheita
  harvestWindowEnd: int("harvestWindowEnd").notNull(),    // Mês de fim da colheita
  cycleDays: int("cycleDays").notNull(),                  // Duração média do ciclo em dias

  // Exigências climáticas para pulverização
  minTempSpray: decimal("minTempSpray", { precision: 5, scale: 2 }).notNull(), // °C mínimo para pulverização
  maxTempSpray: decimal("maxTempSpray", { precision: 5, scale: 2 }).notNull(), // °C máximo para pulverização
  minHumiditySpray: int("minHumiditySpray").notNull(),  // % umidade mínima
  maxHumiditySpray: int("maxHumiditySpray").notNull(),  // % umidade máxima
  maxWindSpeedSpray: decimal("maxWindSpeedSpray", { precision: 5, scale: 2 }).notNull(), // km/h máximo
  minDeltaT: decimal("minDeltaT", { precision: 5, scale: 2 }).notNull(), // Delta T mínimo (°C)
  maxDeltaT: decimal("maxDeltaT", { precision: 5, scale: 2 }).notNull(), // Delta T máximo (°C)

  // Exigências nutricionais (kg/ha por macronutriente)
  nitrogenKgHa: decimal("nitrogenKgHa", { precision: 8, scale: 2 }),  // N
  phosphorusKgHa: decimal("phosphorusKgHa", { precision: 8, scale: 2 }), // P2O5
  potassiumKgHa: decimal("potassiumKgHa", { precision: 8, scale: 2 }), // K2O
  sulfurKgHa: decimal("sulfurKgHa", { precision: 8, scale: 2 }),     // S

  // Produtividade esperada na região
  expectedYieldBagHa: decimal("expectedYieldBagHa", { precision: 8, scale: 2 }), // sacas/ha

  // Notas agronômicas livres
  notes: text("notes"),

  // Status
  isActive: boolean("isActive").default(true).notNull(),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Crop = typeof crops.$inferSelect;
export type InsertCrop = typeof crops.$inferInsert;

/**
 * Scheduled job tracking
 */
export const scheduledJobs = mysqlTable("scheduledJobs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  farmId: int("farmId").notNull(), // FK para farms.id
  
  // Job type
  jobType: mysqlEnum("jobType", ["weather_check", "market_analysis"]).notNull(),
  
  // Last execution
  lastExecutedAt: timestamp("lastExecutedAt"),
  lastExecutionStatus: mysqlEnum("lastExecutionStatus", ["success", "failed", "pending"]).default("pending").notNull(),
  lastExecutionError: text("lastExecutionError"),
  
  // Next scheduled execution
  nextExecutionAt: timestamp("nextExecutionAt"),
  
  // Is enabled
  isEnabled: boolean("isEnabled").default(true).notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ScheduledJob = typeof scheduledJobs.$inferSelect;
export type InsertScheduledJob = typeof scheduledJobs.$inferInsert;
