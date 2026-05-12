-- Migration 0004: Fase 5 — Módulo 1: Base Agronômica
-- Cria tabela crops com metadados técnicos por fazenda
-- Culturas-alvo: Soja, Milho, Sorgo, Milheto, Gergelim

CREATE TABLE `crops` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `farmId` int NOT NULL,

  -- Identificação da cultura
  `name` varchar(64) NOT NULL,
  `displayName` varchar(128) NOT NULL,
  `variety` varchar(128),

  -- Janela de plantio (meses 1-12)
  `plantingWindowStart` int NOT NULL,
  `plantingWindowEnd` int NOT NULL,
  `harvestWindowStart` int NOT NULL,
  `harvestWindowEnd` int NOT NULL,
  `cycleDays` int NOT NULL,

  -- Exigências climáticas para pulverização
  `minTempSpray` decimal(5,2) NOT NULL,
  `maxTempSpray` decimal(5,2) NOT NULL,
  `minHumiditySpray` int NOT NULL,
  `maxHumiditySpray` int NOT NULL,
  `maxWindSpeedSpray` decimal(5,2) NOT NULL,
  `minDeltaT` decimal(5,2) NOT NULL,
  `maxDeltaT` decimal(5,2) NOT NULL,

  -- Exigências nutricionais (kg/ha)
  `nitrogenKgHa` decimal(8,2),
  `phosphorusKgHa` decimal(8,2),
  `potassiumKgHa` decimal(8,2),
  `sulfurKgHa` decimal(8,2),

  -- Produtividade esperada
  `expectedYieldBagHa` decimal(8,2),

  -- Notas agronômicas
  `notes` text,

  -- Status
  `isActive` boolean NOT NULL DEFAULT true,

  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,

  -- Índices
  INDEX `crops_farmId_idx` (`farmId`),
  INDEX `crops_name_idx` (`name`),
  UNIQUE KEY `crops_farmId_name_unique` (`farmId`, `name`)
);
