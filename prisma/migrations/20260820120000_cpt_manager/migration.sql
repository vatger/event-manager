-- CreateTable: Verantwortliche für die Forums-Bewerbung der CPTs je FIR
CREATE TABLE `CptResponsible` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `firCode` VARCHAR(8) NOT NULL,
    `userCID` INTEGER NOT NULL,
    `addedByCID` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CptResponsible_firCode_userCID_key`(`firCode`, `userCID`),
    INDEX `CptResponsible_firCode_idx`(`firCode`),
    INDEX `CptResponsible_userCID_idx`(`userCID`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: lokaler Arbeitsstand zu einem CPT aus der Training-API
CREATE TABLE `CptStatus` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cptId` INTEGER NOT NULL,
    `firCode` VARCHAR(8) NULL,
    `position` VARCHAR(32) NULL,
    `traineeName` VARCHAR(191) NULL,
    `cptDate` DATETIME(3) NULL,
    `posted` BOOLEAN NOT NULL DEFAULT false,
    `postedAt` DATETIME(3) NULL,
    `postedByCID` INTEGER NULL,
    `reminder3dSentAt` DATETIME(3) NULL,
    `reminderDaySentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CptStatus_cptId_key`(`cptId`),
    INDEX `CptStatus_firCode_idx`(`firCode`),
    INDEX `CptStatus_cptDate_idx`(`cptDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CptResponsible` ADD CONSTRAINT `CptResponsible_firCode_fkey` FOREIGN KEY (`firCode`) REFERENCES `FIR`(`code`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CptResponsible` ADD CONSTRAINT `CptResponsible_userCID_fkey` FOREIGN KEY (`userCID`) REFERENCES `User`(`cid`) ON DELETE CASCADE ON UPDATE CASCADE;
