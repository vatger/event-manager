-- CreateTable: EventResponsible join table for multiple responsibles per event
CREATE TABLE `EventResponsible` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `eventId` INTEGER NOT NULL,
    `userCID` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `EventResponsible_eventId_userCID_key`(`eventId`, `userCID`),
    INDEX `EventResponsible_eventId_idx`(`eventId`),
    INDEX `EventResponsible_userCID_idx`(`userCID`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Migrate existing responsibleCID data into the new join table
INSERT INTO `EventResponsible` (`eventId`, `userCID`)
SELECT `id`, `responsibleCID`
FROM `Event`
WHERE `responsibleCID` IS NOT NULL;

-- AddForeignKey
ALTER TABLE `EventResponsible` ADD CONSTRAINT `EventResponsible_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `EventResponsible` ADD CONSTRAINT `EventResponsible_userCID_fkey` FOREIGN KEY (`userCID`) REFERENCES `User`(`cid`) ON DELETE CASCADE ON UPDATE CASCADE;

-- DropForeignKey for old responsibleCID
ALTER TABLE `Event` DROP FOREIGN KEY `Event_responsibleCID_fkey`;

-- DropColumn: remove the old single responsibleCID field
ALTER TABLE `Event` DROP COLUMN `responsibleCID`;
