-- Änderungsprotokoll der Event-Verwaltung
CREATE TABLE `EventActivity` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `eventId` INTEGER NOT NULL,
    `actorCID` INTEGER NULL,
    `category` VARCHAR(20) NOT NULL,
    `action` VARCHAR(40) NOT NULL,
    `summary` TEXT NOT NULL,
    `details` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EventActivity_eventId_createdAt_idx`(`eventId`, `createdAt`),
    INDEX `EventActivity_actorCID_idx`(`actorCID`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `EventActivity` ADD CONSTRAINT `EventActivity_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
