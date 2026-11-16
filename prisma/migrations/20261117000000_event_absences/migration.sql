-- „Ich bin nicht dabei“-Meldungen der Lotsen je Event
CREATE TABLE `EventAbsence` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `eventId` INTEGER NOT NULL,
  `userCID` INTEGER NOT NULL,
  `reason` VARCHAR(200) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `EventAbsence_eventId_userCID_key`(`eventId`, `userCID`),
  INDEX `EventAbsence_eventId_idx`(`eventId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `EventAbsence`
  ADD CONSTRAINT `EventAbsence_eventId_fkey`
  FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `EventAbsence`
  ADD CONSTRAINT `EventAbsence_userCID_fkey`
  FOREIGN KEY (`userCID`) REFERENCES `User`(`cid`) ON DELETE CASCADE ON UPDATE CASCADE;
