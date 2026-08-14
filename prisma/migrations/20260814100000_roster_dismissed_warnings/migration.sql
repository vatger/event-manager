-- AlterTable: bewusst ignorierte Planungshinweise. Die Liste hängt am Roster
-- statt am einzelnen Bearbeiter, damit ein einmal geprüfter Hinweis für das
-- ganze Team erledigt ist.
ALTER TABLE `EventRoster`
    ADD COLUMN `dismissedWarnings` JSON NULL;
