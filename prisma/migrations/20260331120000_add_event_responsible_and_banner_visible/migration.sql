-- AlterTable: Add responsibleCID and bannerVisible to Event
ALTER TABLE `Event` ADD COLUMN `responsibleCID` INTEGER NULL;
ALTER TABLE `Event` ADD COLUMN `bannerVisible` BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE `Event` ADD CONSTRAINT `Event_responsibleCID_fkey` FOREIGN KEY (`responsibleCID`) REFERENCES `User`(`cid`) ON DELETE SET NULL ON UPDATE CASCADE;
