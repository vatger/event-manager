-- CreateTable: EventRosterNote (internal planning notes per controller and roster)
CREATE TABLE `EventRosterNote` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rosterId` INTEGER NOT NULL,
    `userCID` INTEGER NOT NULL,
    `note` TEXT NOT NULL,
    `authorCID` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EventRosterNote_rosterId_userCID_key`(`rosterId`, `userCID`),
    INDEX `EventRosterNote_rosterId_idx`(`rosterId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EventRosterNote` ADD CONSTRAINT `EventRosterNote_rosterId_fkey` FOREIGN KEY (`rosterId`) REFERENCES `EventRoster`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
