-- AlterTable: EventRosterAssignment supports custom (label) blocks; userCID becomes nullable
ALTER TABLE `EventRosterAssignment`
    ADD COLUMN `type` VARCHAR(191) NOT NULL DEFAULT 'controller',
    ADD COLUMN `label` VARCHAR(191) NULL,
    ADD COLUMN `color` VARCHAR(191) NULL,
    MODIFY COLUMN `userCID` INTEGER NULL;

-- CreateTable: EventRosterEditor (explicitly authorized roster editors)
CREATE TABLE `EventRosterEditor` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rosterId` INTEGER NOT NULL,
    `userCID` INTEGER NOT NULL,
    `addedByCID` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `EventRosterEditor_rosterId_userCID_key`(`rosterId`, `userCID`),
    INDEX `EventRosterEditor_rosterId_idx`(`rosterId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: EventRosterSnapshot (saved roster states to revert to)
CREATE TABLE `EventRosterSnapshot` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rosterId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `data` JSON NOT NULL,
    `createdByCID` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EventRosterSnapshot_rosterId_idx`(`rosterId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EventRosterEditor` ADD CONSTRAINT `EventRosterEditor_rosterId_fkey` FOREIGN KEY (`rosterId`) REFERENCES `EventRoster`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `EventRosterSnapshot` ADD CONSTRAINT `EventRosterSnapshot_rosterId_fkey` FOREIGN KEY (`rosterId`) REFERENCES `EventRoster`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed permission: roster.edit and grant it to all FIR leadership groups (OWN_FIR scope)
INSERT INTO `Permission` (`key`, `description`)
SELECT 'roster.edit', 'Besetzungsplan bearbeiten'
WHERE NOT EXISTS (SELECT 1 FROM `Permission` WHERE `key` = 'roster.edit');

INSERT INTO `GroupPermission` (`groupId`, `permissionId`, `scope`)
SELECT g.`id`, p.`id`, 'OWN_FIR'
FROM `Group` g
CROSS JOIN `Permission` p
WHERE p.`key` = 'roster.edit'
  AND g.`kind` = 'FIR_LEITUNG'
  AND NOT EXISTS (
    SELECT 1 FROM `GroupPermission` gp
    WHERE gp.`groupId` = g.`id` AND gp.`permissionId` = p.`id` AND gp.`scope` = 'OWN_FIR'
  );
