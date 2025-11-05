/*
  Warnings:

  - The values [GLOBAL_VATGER_LEITUNG] on the enum `Group_kind` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `group` MODIFY `kind` ENUM('FIR_LEITUNG', 'FIR_TEAM', 'CUSTOM') NOT NULL DEFAULT 'CUSTOM';

-- CreateTable
CREATE TABLE `VATGERLeitung` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userCID` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `VATGERLeitung_userCID_key`(`userCID`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `VATGERLeitung` ADD CONSTRAINT `VATGERLeitung_userCID_fkey` FOREIGN KEY (`userCID`) REFERENCES `User`(`cid`) ON DELETE RESTRICT ON UPDATE CASCADE;
