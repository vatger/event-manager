-- AlterTable
ALTER TABLE `WeeklyEventConfiguration` ADD COLUMN `airports` JSON NULL,
    ADD COLUMN `bannerUrl` TEXT NULL,
    ADD COLUMN `description` TEXT NULL,
    ADD COLUMN `endTime` VARCHAR(191) NULL,
    ADD COLUMN `minStaffing` INTEGER NULL DEFAULT 0,
    ADD COLUMN `requiresRoster` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `signupDeadlineHours` INTEGER NULL DEFAULT 24,
    ADD COLUMN `staffedStations` JSON NULL,
    ADD COLUMN `startTime` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `WeeklyEventOccurrence` ADD COLUMN `eventId` INTEGER NULL,
    ADD COLUMN `rosterPublished` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `rosterPublishedAt` DATETIME(3) NULL,
    ADD COLUMN `signupDeadline` DATETIME(3) NULL,
    ADD COLUMN `signupStatus` VARCHAR(191) NOT NULL DEFAULT 'auto';

-- CreateTable
CREATE TABLE `WeeklyEventSignup` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `occurrenceId` INTEGER NOT NULL,
    `userCID` INTEGER NOT NULL,
    `remarks` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WeeklyEventSignup_userCID_idx`(`userCID`),
    INDEX `WeeklyEventSignup_occurrenceId_idx`(`occurrenceId`),
    UNIQUE INDEX `WeeklyEventSignup_occurrenceId_userCID_key`(`occurrenceId`, `userCID`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WeeklyEventRoster` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `occurrenceId` INTEGER NOT NULL,
    `userCID` INTEGER NOT NULL,
    `station` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WeeklyEventRoster_occurrenceId_idx`(`occurrenceId`),
    INDEX `WeeklyEventRoster_userCID_idx`(`userCID`),
    UNIQUE INDEX `WeeklyEventRoster_occurrenceId_station_key`(`occurrenceId`, `station`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CronJobStatus` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `jobName` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `schedule` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastRunAt` DATETIME(3) NULL,
    `lastRunStatus` VARCHAR(191) NULL,
    `lastRunDuration` INTEGER NULL,
    `lastError` TEXT NULL,
    `runCount` INTEGER NOT NULL DEFAULT 0,
    `errorCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CronJobStatus_jobName_key`(`jobName`),
    INDEX `CronJobStatus_jobName_idx`(`jobName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `WeeklyEventOccurrence_eventId_idx` ON `WeeklyEventOccurrence`(`eventId`);

-- AddForeignKey
ALTER TABLE `WeeklyEventSignup` ADD CONSTRAINT `WeeklyEventSignup_occurrenceId_fkey` FOREIGN KEY (`occurrenceId`) REFERENCES `WeeklyEventOccurrence`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WeeklyEventSignup` ADD CONSTRAINT `WeeklyEventSignup_userCID_fkey` FOREIGN KEY (`userCID`) REFERENCES `User`(`cid`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WeeklyEventRoster` ADD CONSTRAINT `WeeklyEventRoster_occurrenceId_fkey` FOREIGN KEY (`occurrenceId`) REFERENCES `WeeklyEventOccurrence`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
