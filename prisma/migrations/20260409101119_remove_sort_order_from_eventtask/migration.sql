/*
  Warnings:

  - You are about to drop the column `sortOrder` on the `eventtask` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `EventTask` DROP COLUMN `sortOrder`;

-- AlterTable
ALTER TABLE `UserComment` MODIFY `comment` VARCHAR(191) NOT NULL;
