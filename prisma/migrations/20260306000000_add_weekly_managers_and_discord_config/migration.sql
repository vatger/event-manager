-- CreateTable: WeeklyEventManager
CREATE TABLE `WeeklyEventManager` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userCID` INTEGER NOT NULL,
    `configId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `WeeklyEventManager_userCID_configId_key`(`userCID`, `configId`),
    INDEX `WeeklyEventManager_userCID_idx`(`userCID`),
    INDEX `WeeklyEventManager_configId_idx`(`configId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `WeeklyEventManager` ADD CONSTRAINT `WeeklyEventManager_userCID_fkey` FOREIGN KEY (`userCID`) REFERENCES `User`(`cid`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WeeklyEventManager` ADD CONSTRAINT `WeeklyEventManager_configId_fkey` FOREIGN KEY (`configId`) REFERENCES `WeeklyEventConfiguration`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: FirDiscordConfig
CREATE TABLE `FirDiscordConfig` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `firId` INTEGER NOT NULL,
    `channelId` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `FirDiscordConfig_firId_key`(`firId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `FirDiscordConfig` ADD CONSTRAINT `FirDiscordConfig_firId_fkey` FOREIGN KEY (`firId`) REFERENCES `FIR`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
