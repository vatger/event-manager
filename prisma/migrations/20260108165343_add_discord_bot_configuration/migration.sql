-- CreateTable for Discord Bot Weekly Event Configuration
CREATE TABLE `WeeklyEventConfiguration` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `firId` INTEGER NULL,
    `name` VARCHAR(191) NOT NULL,
    `weekday` INTEGER NOT NULL,
    `weeksOn` INTEGER NOT NULL DEFAULT 1,
    `weeksOff` INTEGER NOT NULL DEFAULT 0,
    `startDate` DATETIME(3) NOT NULL,
    `checkDaysAhead` INTEGER NOT NULL DEFAULT 14,
    `discordChannelId` VARCHAR(191) NULL,
    `discordRoleId` VARCHAR(191) NULL,
    `requiredStaffing` JSON NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WeeklyEventConfiguration_firId_fkey`(`firId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable for Weekly Event Occurrences
CREATE TABLE `WeeklyEventOccurrence` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `configId` INTEGER NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `myVatsimChecked` BOOLEAN NOT NULL DEFAULT false,
    `myVatsimRegistered` BOOLEAN NULL,
    `staffingChecked` BOOLEAN NOT NULL DEFAULT false,
    `staffingSufficient` BOOLEAN NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WeeklyEventOccurrence_date_idx`(`date`),
    INDEX `WeeklyEventOccurrence_configId_fkey`(`configId`),
    UNIQUE INDEX `WeeklyEventOccurrence_configId_date_key`(`configId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable for Discord Bot Configuration (FIR-specific settings)
CREATE TABLE `DiscordBotConfiguration` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `firId` INTEGER NULL,
    `defaultChannelId` VARCHAR(191) NULL,
    `eventRegistrationDeadlineDays` INTEGER NOT NULL DEFAULT 14,
    `staffingCheckTime` VARCHAR(191) NOT NULL DEFAULT '10:00',
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DiscordBotConfiguration_firId_key`(`firId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `WeeklyEventConfiguration` ADD CONSTRAINT `WeeklyEventConfiguration_firId_fkey` FOREIGN KEY (`firId`) REFERENCES `FIR`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WeeklyEventOccurrence` ADD CONSTRAINT `WeeklyEventOccurrence_configId_fkey` FOREIGN KEY (`configId`) REFERENCES `WeeklyEventConfiguration`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DiscordBotConfiguration` ADD CONSTRAINT `DiscordBotConfiguration_firId_fkey` FOREIGN KEY (`firId`) REFERENCES `FIR`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
