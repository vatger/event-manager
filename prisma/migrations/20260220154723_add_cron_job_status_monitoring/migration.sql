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
