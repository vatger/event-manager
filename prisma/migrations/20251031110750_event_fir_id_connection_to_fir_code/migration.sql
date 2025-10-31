/*
  Warnings:

  - You are about to drop the column `firId` on the `event` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `event` DROP FOREIGN KEY `Event_firId_fkey`;

-- DropIndex
DROP INDEX `Event_firId_fkey` ON `event`;

-- AlterTable
ALTER TABLE `event` DROP COLUMN `firId`,
    ADD COLUMN `firCode` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `Event` ADD CONSTRAINT `Event_firCode_fkey` FOREIGN KEY (`firCode`) REFERENCES `FIR`(`code`) ON DELETE SET NULL ON UPDATE CASCADE;
