-- AlterTable: Event.description war auf VARCHAR(191) begrenzt und damit für
-- längere Beschreibungstexte zu knapp bemessen.
ALTER TABLE `Event` MODIFY `description` TEXT NOT NULL;

-- AlterTable: Controller-Briefing am Besetzungsplan – Freitext mit Links
-- (gleiches Format wie Event.description), unabhängig vom Veröffentlichen-
-- Stand der Zuweisungen selbst pflegbar.
ALTER TABLE `EventRoster`
    ADD COLUMN `briefing` TEXT NULL,
    ADD COLUMN `briefingUpdatedAt` DATETIME(3) NULL,
    ADD COLUMN `briefingUpdatedByCID` INTEGER NULL;
