CREATE TABLE `farm_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`farmId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('owner','manager','viewer') NOT NULL DEFAULT 'viewer',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `farm_users_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `farms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`municipio` varchar(255) NOT NULL,
	`latitude` decimal(10,8) NOT NULL,
	`longitude` decimal(11,8) NOT NULL,
	`altitude` decimal(7,2),
	`mainCrop` varchar(64) NOT NULL,
	`agriculturalWindowStart` int,
	`agriculturalWindowEnd` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `farms_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `marketAlerts` ADD `farmId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `marketAnalysisDaily` ADD `farmId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `notificationLogs` ADD `farmId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `scheduledJobs` ADD `farmId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `userSettings` ADD `farmId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `currentFarmId` int;--> statement-breakpoint
ALTER TABLE `weatherDailySummary` ADD `farmId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `weatherLogs` ADD `farmId` int NOT NULL;