-- AlterTable
ALTER TABLE `EventSignup` ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `deletedBy` INTEGER NULL,
    ADD COLUMN `modifiedAfterDeadline` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `changeLog` JSON NULL;
