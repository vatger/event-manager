-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cid` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `rating` VARCHAR(191) NOT NULL,
    `role` ENUM('USER', 'MAIN_ADMIN') NOT NULL DEFAULT 'USER',
    `firId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `emailNotificationsEnabled` BOOLEAN NULL,

    UNIQUE INDEX `User_cid_key`(`cid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FIR` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `FIR_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Event` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `bannerUrl` VARCHAR(191) NULL,
    `startTime` DATETIME(3) NOT NULL,
    `endTime` DATETIME(3) NOT NULL,
    `airports` JSON NOT NULL,
    `signupDeadline` DATETIME(3) NULL,
    `staffedStations` JSON NULL,
    `status` ENUM('PLANNING', 'SIGNUP_OPEN', 'SIGNUP_CLOSED', 'ROSTER_PUBLISHED', 'DRAFT', 'CANCELLED') NOT NULL DEFAULT 'PLANNING',
    `rosterlink` VARCHAR(191) NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `firCode` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EventSignup` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `eventId` INTEGER NOT NULL,
    `userCID` INTEGER NOT NULL,
    `availability` JSON NOT NULL,
    `breakrequests` VARCHAR(191) NULL,
    `preferredStations` VARCHAR(191) NULL,
    `remarks` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EventSignup_eventId_userCID_key`(`eventId`, `userCID`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userCID` INTEGER NOT NULL,
    `eventId` INTEGER NULL,
    `type` ENUM('INFO', 'SYSTEM', 'EVENT', 'OTHER') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` VARCHAR(191) NOT NULL,
    `data` JSON NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_userCID_readAt_idx`(`userCID`, `readAt`),
    INDEX `Notification_eventId_idx`(`eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Permission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,

    UNIQUE INDEX `Permission_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Group` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `kind` ENUM('FIR_LEITUNG', 'FIR_TEAM', 'CUSTOM') NOT NULL DEFAULT 'CUSTOM',
    `firId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Group_name_firId_key`(`name`, `firId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GroupPermission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `groupId` INTEGER NOT NULL,
    `permissionId` INTEGER NOT NULL,
    `scope` ENUM('OWN_FIR', 'ALL') NOT NULL DEFAULT 'OWN_FIR',

    UNIQUE INDEX `GroupPermission_groupId_permissionId_scope_key`(`groupId`, `permissionId`, `scope`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserGroup` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userCID` INTEGER NOT NULL,
    `groupId` INTEGER NOT NULL,

    UNIQUE INDEX `UserGroup_userCID_groupId_key`(`userCID`, `groupId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VATGERLeitung` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userCID` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `VATGERLeitung_userCID_key`(`userCID`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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

-- CreateTable
CREATE TABLE `EventSignupCache` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `eventId` INTEGER NOT NULL,
    `data` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `expiresAt` DATETIME(3) NULL,

    UNIQUE INDEX `EventSignupCache_eventId_key`(`eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_firId_fkey` FOREIGN KEY (`firId`) REFERENCES `FIR`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Event` ADD CONSTRAINT `Event_firCode_fkey` FOREIGN KEY (`firCode`) REFERENCES `FIR`(`code`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventSignup` ADD CONSTRAINT `EventSignup_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventSignup` ADD CONSTRAINT `EventSignup_userCID_fkey` FOREIGN KEY (`userCID`) REFERENCES `User`(`cid`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userCID_fkey` FOREIGN KEY (`userCID`) REFERENCES `User`(`cid`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Group` ADD CONSTRAINT `Group_firId_fkey` FOREIGN KEY (`firId`) REFERENCES `FIR`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GroupPermission` ADD CONSTRAINT `GroupPermission_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `Group`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GroupPermission` ADD CONSTRAINT `GroupPermission_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `Permission`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserGroup` ADD CONSTRAINT `UserGroup_userCID_fkey` FOREIGN KEY (`userCID`) REFERENCES `User`(`cid`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserGroup` ADD CONSTRAINT `UserGroup_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `Group`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VATGERLeitung` ADD CONSTRAINT `VATGERLeitung_userCID_fkey` FOREIGN KEY (`userCID`) REFERENCES `User`(`cid`) ON DELETE RESTRICT ON UPDATE CASCADE;
