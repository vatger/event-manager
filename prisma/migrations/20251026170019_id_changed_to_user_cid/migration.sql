/*
  Warnings:

  - A unique constraint covering the columns `[userCID,groupId]` on the table `UserGroup` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `UserGroup_id_groupId_key` ON `usergroup`;

-- CreateIndex
CREATE UNIQUE INDEX `UserGroup_userCID_groupId_key` ON `UserGroup`(`userCID`, `groupId`);
