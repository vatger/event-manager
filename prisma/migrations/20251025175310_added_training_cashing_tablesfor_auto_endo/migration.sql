/*
  Warnings:

  - You are about to drop the column `endorsement` on the `eventsignup` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `eventsignup` DROP COLUMN `endorsement`;

-- CreateTable
CREATE TABLE `TrainingEndorsementCache` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userCID` INTEGER NOT NULL,
    `position` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `fetchedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TrainingEndorsementCache_userCID_idx`(`userCID`),
    INDEX `TrainingEndorsementCache_fetchedAt_idx`(`fetchedAt`),
    UNIQUE INDEX `TrainingEndorsementCache_userCID_position_key`(`userCID`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TrainingSoloCache` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userCID` INTEGER NOT NULL,
    `position` VARCHAR(191) NOT NULL,
    `expiry` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `fetchedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TrainingSoloCache_userCID_idx`(`userCID`),
    INDEX `TrainingSoloCache_expiry_idx`(`expiry`),
    UNIQUE INDEX `TrainingSoloCache_userCID_position_key`(`userCID`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TrainingFamiliarizationCache` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userCID` INTEGER NOT NULL,
    `sectorName` VARCHAR(191) NOT NULL,
    `sectorFir` VARCHAR(191) NOT NULL,
    `fetchedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TrainingFamiliarizationCache_userCID_idx`(`userCID`),
    INDEX `TrainingFamiliarizationCache_sectorFir_idx`(`sectorFir`),
    UNIQUE INDEX `TrainingFamiliarizationCache_userCID_sectorFir_sectorName_key`(`userCID`, `sectorFir`, `sectorName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TrainingCacheMetadata` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lastUpdated` DATETIME(3) NOT NULL,
    `forceUpdate` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
