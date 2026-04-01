-- CreateTable
CREATE TABLE `EventTask` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `eventId` INTEGER NOT NULL,
    `type` ENUM('CREATE_BANNER', 'CREATE_TEXT', 'SUBMIT_CLEARING', 'REGISTER_MYVATSIM', 'CUSTOM') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('OPEN', 'IN_PROGRESS', 'DONE', 'SKIPPED') NOT NULL DEFAULT 'OPEN',
    `dueDate` DATETIME(3) NULL,
    `assigneeCID` INTEGER NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `myVatsimManualCheck` BOOLEAN NOT NULL DEFAULT false,
    `myVatsimRegistered` BOOLEAN NULL,
    `deadlineNotified` BOOLEAN NOT NULL DEFAULT false,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EventTask_eventId_idx`(`eventId`),
    INDEX `EventTask_assigneeCID_idx`(`assigneeCID`),
    INDEX `EventTask_dueDate_idx`(`dueDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EventTask` ADD CONSTRAINT `EventTask_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventTask` ADD CONSTRAINT `EventTask_assigneeCID_fkey` FOREIGN KEY (`assigneeCID`) REFERENCES `User`(`cid`) ON DELETE SET NULL ON UPDATE CASCADE;
