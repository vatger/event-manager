-- CreateTable
CREATE TABLE `UserComment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userCID` INTEGER NOT NULL,
    `authorCID` INTEGER NOT NULL,
    `comment` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `UserComment_userCID_idx`(`userCID`),
    INDEX `UserComment_authorCID_idx`(`authorCID`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserComment` ADD CONSTRAINT `UserComment_userCID_fkey` FOREIGN KEY (`userCID`) REFERENCES `User`(`cid`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserComment` ADD CONSTRAINT `UserComment_authorCID_fkey` FOREIGN KEY (`authorCID`) REFERENCES `User`(`cid`) ON DELETE CASCADE ON UPDATE CASCADE;
