CREATE TABLE `marketAnalysisDaily` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`analysisDate` timestamp NOT NULL,
	`title` varchar(255) NOT NULL,
	`summary` text NOT NULL,
	`interpretation` text NOT NULL,
	`topics` json NOT NULL,
	`keyInsights` json NOT NULL,
	`affectedInputs` json NOT NULL,
	`affectedCrops` json NOT NULL,
	`overallImpact` enum('positive','neutral','negative') NOT NULL DEFAULT 'neutral',
	`notificationSent` boolean NOT NULL DEFAULT false,
	`notificationSentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `marketAnalysisDaily_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `weatherDailySummary` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`summaryDate` timestamp NOT NULL,
	`minTemperature` decimal(5,2) NOT NULL,
	`maxTemperature` decimal(5,2) NOT NULL,
	`avgHumidity` int NOT NULL,
	`avgWindSpeed` decimal(5,2) NOT NULL,
	`rainProbability` int NOT NULL,
	`operationalClassification` enum('excelente','boa','moderada','ruim','nao-recomendada') NOT NULL,
	`bestApplicationStart` int,
	`bestApplicationEnd` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `weatherDailySummary_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `userSettings` MODIFY COLUMN `monitoredInputs` json NOT NULL DEFAULT ('["ureia","map","kcl","super-simples","super-triplo","nitrato-amonio","sulfato-amonio","npk-20-00-20","npk-30-00-20"]');