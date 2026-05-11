CREATE TABLE `marketAlerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`summary` text NOT NULL,
	`aiAnalysis` text,
	`affectedInputs` json NOT NULL,
	`affectedCrops` json NOT NULL,
	`impactLevel` enum('low','medium','high') NOT NULL DEFAULT 'medium',
	`source` varchar(255),
	`sourceUrl` varchar(500),
	`notificationSent` boolean NOT NULL DEFAULT false,
	`notificationSentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketAlerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notificationLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('weather','market') NOT NULL,
	`referenceId` int,
	`messageContent` text NOT NULL,
	`deliveryStatus` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
	`deliveryError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`sentAt` timestamp,
	CONSTRAINT `notificationLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scheduledJobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`jobType` enum('weather_check','market_analysis') NOT NULL,
	`lastExecutedAt` timestamp,
	`lastExecutionStatus` enum('success','failed','pending') NOT NULL DEFAULT 'pending',
	`lastExecutionError` text,
	`nextExecutionAt` timestamp,
	`isEnabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scheduledJobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`telegramToken` varchar(255) NOT NULL,
	`telegramChatId` varchar(255) NOT NULL,
	`minHumidity` int NOT NULL DEFAULT 50,
	`maxHumidity` int NOT NULL DEFAULT 90,
	`maxTemperature` int NOT NULL DEFAULT 30,
	`maxWindSpeed` int NOT NULL DEFAULT 15,
	`monitoredCrops` json NOT NULL DEFAULT ('["soja","milho"]'),
	`marketAlertFrequency` enum('daily','weekly') NOT NULL DEFAULT 'daily',
	`monitoredInputs` json NOT NULL DEFAULT ('["ureia","kcl","map","superfosfato"]'),
	`enableWeatherNotifications` boolean NOT NULL DEFAULT true,
	`enableMarketNotifications` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userSettings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `weatherLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`temperature` decimal(5,2) NOT NULL,
	`humidity` int NOT NULL,
	`windSpeed` decimal(5,2) NOT NULL,
	`hourlyForecast` json NOT NULL,
	`applicationWindowStart` int,
	`applicationWindowEnd` int,
	`isApplicationRecommended` boolean NOT NULL DEFAULT false,
	`source` varchar(64) NOT NULL DEFAULT 'openweathermap',
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `weatherLogs_id` PRIMARY KEY(`id`)
);
