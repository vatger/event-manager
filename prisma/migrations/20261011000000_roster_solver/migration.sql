-- Automatische Planung des Besetzungsplans: strukturierte Wünsche je
-- Controller, Einstellungen je Plan und die Läufe des Planers.
ALTER TABLE `EventRoster` ADD COLUMN `solverConfig` JSON NULL;

CREATE TABLE `EventRosterPreference` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `rosterId` INTEGER NOT NULL,
  `userCID` INTEGER NOT NULL,
  `preferredStations` JSON NULL,
  `avoidedStations` JSON NULL,
  `maxTotalMinutes` INTEGER NULL,
  `excludeFromSolver` BOOLEAN NOT NULL DEFAULT false,
  `updatedByCID` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `EventRosterPreference_rosterId_userCID_key`(`rosterId`, `userCID`),
  INDEX `EventRosterPreference_rosterId_idx`(`rosterId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `EventRosterSolverRun` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `rosterId` INTEGER NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'queued',
  `progress` INTEGER NOT NULL DEFAULT 0,
  `config` JSON NOT NULL,
  `result` JSON NULL,
  `error` TEXT NULL,
  `createdByCID` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `startedAt` DATETIME(3) NULL,
  `finishedAt` DATETIME(3) NULL,
  `appliedAt` DATETIME(3) NULL,
  `appliedByCID` INTEGER NULL,

  INDEX `EventRosterSolverRun_rosterId_createdAt_idx`(`rosterId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `EventRosterPreference`
  ADD CONSTRAINT `EventRosterPreference_rosterId_fkey`
  FOREIGN KEY (`rosterId`) REFERENCES `EventRoster`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `EventRosterSolverRun`
  ADD CONSTRAINT `EventRosterSolverRun_rosterId_fkey`
  FOREIGN KEY (`rosterId`) REFERENCES `EventRoster`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
