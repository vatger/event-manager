-- AlterTable: Ampel-Markierung ("green" | "amber" | "red") zu den internen
-- Planungsnotizen. Notiz und Markierung teilen sich denselben Datensatz, weil
-- beides dieselbe Frage beantwortet: Was muss das Team zu dieser Person wissen?
ALTER TABLE `EventRosterNote`
    ADD COLUMN `flag` VARCHAR(16) NULL;
