-- AlterTable: Interne RMKs lagen in einem VARCHAR(191). Die Anwendung erlaubt
-- bis zu 2000 Zeichen; alles über 191 scheiterte beim Speichern.
ALTER TABLE `UserComment` MODIFY `comment` TEXT NOT NULL;
