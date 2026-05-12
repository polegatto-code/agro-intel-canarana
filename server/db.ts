import { eq, desc, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, 
  users,
  userSettings,
  weatherLogs,
  weatherDailySummary,
  marketAlerts,
  marketAnalysisDaily,
  notificationLogs,
  scheduledJobs,
  farms,
  farmUsers,
  UserSettings,
  WeatherLog,
  WeatherDailySummary,
  MarketAlert,
  MarketAnalysisDaily,
  NotificationLog,
  ScheduledJob,
  Farm,
  FarmUser,
  InsertFarm,
  InsertFarmUser
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============================================================================
// USER SETTINGS QUERIES
// ============================================================================

export async function getUserSettings(userId: number): Promise<UserSettings | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function upsertUserSettings(userId: number, settings: Partial<Omit<UserSettings, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getUserSettings(userId);

  if (existing) {
    return db
      .update(userSettings)
      .set({ ...settings, updatedAt: new Date() })
      .where(eq(userSettings.userId, userId));
  } else {
    return db.insert(userSettings).values({
      userId,
      telegramToken: settings.telegramToken || '',
      telegramChatId: settings.telegramChatId || '',
      minHumidity: settings.minHumidity ?? 50,
      maxHumidity: settings.maxHumidity ?? 90,
      maxTemperature: settings.maxTemperature ?? 30,
      maxWindSpeed: settings.maxWindSpeed ?? 15,
      monitoredCrops: settings.monitoredCrops ?? ['soja', 'milho'],
      marketAlertFrequency: settings.marketAlertFrequency ?? 'daily',
      monitoredInputs: settings.monitoredInputs ?? ['ureia', 'kcl', 'map', 'superfosfato'],
      enableWeatherNotifications: settings.enableWeatherNotifications ?? true,
      enableMarketNotifications: settings.enableMarketNotifications ?? true,
    });
  }
}

// ============================================================================
// WEATHER LOGS QUERIES
// ============================================================================

export async function getLatestWeatherLog(userId: number): Promise<WeatherLog | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(weatherLogs)
    .where(eq(weatherLogs.userId, userId))
    .orderBy(desc(weatherLogs.createdAt))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createWeatherLog(log: Omit<WeatherLog, 'id' | 'createdAt'>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.insert(weatherLogs).values(log);
}

export async function getWeatherHistory(userId: number, days: number = 7) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(weatherLogs)
    .where(eq(weatherLogs.userId, userId))
    .orderBy(desc(weatherLogs.createdAt));
}

// ============================================================================
// MARKET ALERTS QUERIES
// ============================================================================

export async function createMarketAlert(alert: Omit<MarketAlert, 'id' | 'createdAt' | 'updatedAt'>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.insert(marketAlerts).values(alert);
}

export async function getMarketAlerts(userId: number, limit: number = 10) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(marketAlerts)
    .where(eq(marketAlerts.userId, userId))
    .orderBy(desc(marketAlerts.createdAt))
    .limit(limit);
}

export async function updateMarketAlert(alertId: number, updates: Partial<Omit<MarketAlert, 'id' | 'createdAt' | 'updatedAt'>>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .update(marketAlerts)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(marketAlerts.id, alertId));
}

// ============================================================================
// NOTIFICATION LOGS QUERIES
// ============================================================================

export async function createNotificationLog(log: Omit<NotificationLog, 'id' | 'createdAt'>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.insert(notificationLogs).values(log);
}

export async function getNotificationHistory(userId: number, limit: number = 20) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(notificationLogs)
    .where(eq(notificationLogs.userId, userId))
    .orderBy(desc(notificationLogs.createdAt))
    .limit(limit);
}

export async function updateNotificationLog(logId: number, updates: Partial<Omit<NotificationLog, 'id' | 'createdAt'>>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .update(notificationLogs)
    .set(updates)
    .where(eq(notificationLogs.id, logId));
}

// ============================================================================
// SCHEDULED JOBS QUERIES
// ============================================================================

export async function getOrCreateScheduledJob(userId: number, jobType: 'weather_check' | 'market_analysis'): Promise<ScheduledJob> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db
    .select()
    .from(scheduledJobs)
    .where(and(
      eq(scheduledJobs.userId, userId),
      eq(scheduledJobs.jobType, jobType)
    ))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  // Create new job
  const result = await db.insert(scheduledJobs).values({
    userId,
    jobType,
    isEnabled: true,
    lastExecutionStatus: 'pending',
  });

  // Return the created job (we need to fetch it since Drizzle doesn't return the full row)
  const created = await db
    .select()
    .from(scheduledJobs)
    .where(and(
      eq(scheduledJobs.userId, userId),
      eq(scheduledJobs.jobType, jobType)
    ))
    .limit(1);

  return created[0];
}

export async function updateScheduledJob(jobId: number, updates: Partial<Omit<ScheduledJob, 'id' | 'createdAt' | 'updatedAt'>>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .update(scheduledJobs)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(scheduledJobs.id, jobId));
}

// ============================================================================
// WEATHER DAILY SUMMARY QUERIES
// ============================================================================

export async function createWeatherDailySummary(summary: Omit<WeatherDailySummary, 'id' | 'createdAt'>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.insert(weatherDailySummary).values(summary);
}

export async function getWeatherDailySummary(userId: number, date: Date) {
  const db = await getDb();
  if (!db) return undefined;

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const result = await db
    .select()
    .from(weatherDailySummary)
    .where(and(
      eq(weatherDailySummary.userId, userId),
    ))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============================================================================
// MARKET ANALYSIS DAILY QUERIES
// ============================================================================

export async function createMarketAnalysisDaily(analysis: Omit<MarketAnalysisDaily, 'id' | 'createdAt'>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.insert(marketAnalysisDaily).values(analysis);
}

export async function getLatestMarketAnalysis(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(marketAnalysisDaily)
    .where(eq(marketAnalysisDaily.userId, userId))
    .orderBy(desc(marketAnalysisDaily.createdAt))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getMarketAnalysisHistory(userId: number, days: number = 7) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(marketAnalysisDaily)
    .where(eq(marketAnalysisDaily.userId, userId))
    .orderBy(desc(marketAnalysisDaily.createdAt));
}

export async function updateMarketAnalysisDaily(analysisId: number, updates: Partial<Omit<MarketAnalysisDaily, 'id' | 'createdAt'>>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .update(marketAnalysisDaily)
    .set(updates)
    .where(eq(marketAnalysisDaily.id, analysisId));
}


/**
 * Get all users with their settings
 */
export async function getAllUsersWithSettings() {
  const db = await getDb();
  if (!db) {
    console.warn('[Database] Cannot get users: database not available');
    return [];
  }

  try {
    const result = await db
      .select({
        userId: users.id,
        openId: users.openId,
        name: users.name,
        email: users.email,
        telegramToken: userSettings.telegramToken,
        telegramChatId: userSettings.telegramChatId,
        minHumidity: userSettings.minHumidity,
        maxHumidity: userSettings.maxHumidity,
        maxTemperature: userSettings.maxTemperature,
        maxWindSpeed: userSettings.maxWindSpeed,
        enableWeatherNotifications: userSettings.enableWeatherNotifications,
        enableMarketNotifications: userSettings.enableMarketNotifications,
        marketAlertFrequency: userSettings.marketAlertFrequency,
      })
      .from(users)
      .leftJoin(userSettings, eq(users.id, userSettings.userId));

    return result;
  } catch (error) {
    console.error('[Database] Failed to get users with settings:', error);
    return [];
  }
}



/**
 * ========== FARMS CRUD ==========
 */

export async function createFarm(farm: InsertFarm): Promise<Farm | null> {
  const db = await getDb();
  if (!db) {
    console.warn('[Database] Cannot create farm: database not available');
    return null;
  }

  try {
    const result = await db.insert(farms).values(farm);
    const insertedId = result[0].insertId;
    
    // Retrieve the created farm
    const created = await db
      .select()
      .from(farms)
      .where(eq(farms.id, Number(insertedId)))
      .limit(1);
    
    return created.length > 0 ? created[0] : null;
  } catch (error) {
    console.error('[Database] Failed to create farm:', error);
    throw error;
  }
}

export async function getFarmById(farmId: number): Promise<Farm | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db
      .select()
      .from(farms)
      .where(eq(farms.id, farmId))
      .limit(1);
    
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('[Database] Failed to get farm:', error);
    return null;
  }
}

export async function getFarmsByUserId(userId: number): Promise<Farm[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db
      .select()
      .from(farms)
      .where(eq(farms.userId, userId))
      .orderBy(farms.createdAt);
  } catch (error) {
    console.error('[Database] Failed to get farms by user:', error);
    return [];
  }
}

export async function updateFarm(farmId: number, updates: Partial<Omit<Farm, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Farm | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    await db
      .update(farms)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(farms.id, farmId));
    
    return getFarmById(farmId);
  } catch (error) {
    console.error('[Database] Failed to update farm:', error);
    throw error;
  }
}

export async function deleteFarm(farmId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    // Delete all farm_users entries first
    await db.delete(farmUsers).where(eq(farmUsers.farmId, farmId));
    
    // Delete the farm
    await db.delete(farms).where(eq(farms.id, farmId));
    
    return true;
  } catch (error) {
    console.error('[Database] Failed to delete farm:', error);
    throw error;
  }
}

/**
 * ========== FARM USERS CRUD ==========
 */

export async function addUserToFarm(farmId: number, userId: number, role: 'owner' | 'manager' | 'viewer' = 'viewer'): Promise<FarmUser | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.insert(farmUsers).values({ farmId, userId, role });
    const insertedId = result[0].insertId;
    
    const created = await db
      .select()
      .from(farmUsers)
      .where(eq(farmUsers.id, Number(insertedId)))
      .limit(1);
    
    return created.length > 0 ? created[0] : null;
  } catch (error) {
    console.error('[Database] Failed to add user to farm:', error);
    throw error;
  }
}

export async function removeUserFromFarm(farmId: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db.delete(farmUsers).where(
      and(eq(farmUsers.farmId, farmId), eq(farmUsers.userId, userId))
    );
    return true;
  } catch (error) {
    console.error('[Database] Failed to remove user from farm:', error);
    throw error;
  }
}

export async function getFarmUsersForFarm(farmId: number): Promise<FarmUser[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db
      .select()
      .from(farmUsers)
      .where(eq(farmUsers.farmId, farmId));
  } catch (error) {
    console.error('[Database] Failed to get farm users:', error);
    return [];
  }
}

export async function getUserFarms(userId: number): Promise<Farm[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    // Get farms where user is owner
    const ownedFarms = await db
      .select()
      .from(farms)
      .where(eq(farms.userId, userId));
    
    // Get farms where user is added via farm_users
    const sharedFarms = await db
      .select({ farm: farms })
      .from(farmUsers)
      .innerJoin(farms, eq(farmUsers.farmId, farms.id))
      .where(eq(farmUsers.userId, userId))
      .then(results => results.map(r => r.farm));
    
    // Combine and deduplicate
    const allFarms = [...ownedFarms, ...sharedFarms];
    const uniqueFarms = Array.from(new Map(allFarms.map(f => [f.id, f])).values());
    
    return uniqueFarms.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  } catch (error) {
    console.error('[Database] Failed to get user farms:', error);
    return [];
  }
}
