-- Änderungsprotokoll des Besetzungsplans
CREATE TABLE `EventRosterActivity` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `rosterId` INTEGER NOT NULL,
  `actorCID` INTEGER NULL,
  `action` VARCHAR(40) NOT NULL,
  `summary` TEXT NOT NULL,
  `stationCallsign` VARCHAR(24) NULL,
  `targetCID` INTEGER NULL,
  `details` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `EventRosterActivity_rosterId_createdAt_idx`(`rosterId`, `createdAt`),
  INDEX `EventRosterActivity_actorCID_idx`(`actorCID`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `EventRosterActivity`
  ADD CONSTRAINT `EventRosterActivity_rosterId_fkey`
  FOREIGN KEY (`rosterId`) REFERENCES `EventRoster`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
