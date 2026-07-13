-- CreateTable: EventRoster (per-event staffing plan for the roster editor)
CREATE TABLE `EventRoster` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `eventId` INTEGER NOT NULL,
    `slotMinutes` INTEGER NOT NULL DEFAULT 30,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EventRoster_eventId_key`(`eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: EventRosterStation (confirmed stations of a roster)
CREATE TABLE `EventRosterStation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rosterId` INTEGER NOT NULL,
    `callsign` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `EventRosterStation_rosterId_callsign_key`(`rosterId`, `callsign`),
    INDEX `EventRosterStation_rosterId_idx`(`rosterId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: EventRosterAssignment (controller staffing a station for a time range)
CREATE TABLE `EventRosterAssignment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rosterId` INTEGER NOT NULL,
    `stationId` INTEGER NOT NULL,
    `userCID` INTEGER NOT NULL,
    `startTime` DATETIME(3) NOT NULL,
    `endTime` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EventRosterAssignment_rosterId_idx`(`rosterId`),
    INDEX `EventRosterAssignment_stationId_idx`(`stationId`),
    INDEX `EventRosterAssignment_userCID_idx`(`userCID`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EventRoster` ADD CONSTRAINT `EventRoster_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `EventRosterStation` ADD CONSTRAINT `EventRosterStation_rosterId_fkey` FOREIGN KEY (`rosterId`) REFERENCES `EventRoster`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `EventRosterAssignment` ADD CONSTRAINT `EventRosterAssignment_rosterId_fkey` FOREIGN KEY (`rosterId`) REFERENCES `EventRoster`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `EventRosterAssignment` ADD CONSTRAINT `EventRosterAssignment_stationId_fkey` FOREIGN KEY (`stationId`) REFERENCES `EventRosterStation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
