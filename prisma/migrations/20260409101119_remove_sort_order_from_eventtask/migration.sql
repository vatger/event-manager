/*
  Warnings:

  - You are about to drop the column `sortOrder` on the `eventtask` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `eventtask` DROP COLUMN `sortOrder`;

-- AlterTable
ALTER TABLE `usercomment` MODIFY `comment` VARCHAR(191) NOT NULL;
