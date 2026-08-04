-- AlterTable: keep the published roster separate from the working copy,
-- so the team can keep editing after publishing and release changes explicitly.
ALTER TABLE `EventRoster`
    ADD COLUMN `publishedAt` DATETIME(3) NULL,
    ADD COLUMN `publishedData` JSON NULL;
