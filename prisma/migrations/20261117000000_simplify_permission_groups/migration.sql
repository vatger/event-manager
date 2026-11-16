-- Berechtigungssystem vereinfacht
--
--  * Je FIR genau eine Leitungsgruppe (FIR_LEITUNG). Der Typ FIR_TEAM entfällt,
--    alle übrigen Gruppen sind gleichartige Untergruppen (CUSTOM).
--  * Die Leitungsgruppe hat fest alle FIR-Rechte – ihre Rechte-Zeilen entfallen.
--  * Der Scope entfällt: Gruppenrechte gelten immer für die eigene FIR,
--    FIR-übergreifend arbeitet nur die VATGER-Eventleitung.
--  * Der Rechtekatalog (lib/acl/catalog.ts) wird in die Tabelle übernommen.
--  * roster.contact bleibt ausdrücklich vergeben (siehe Schritt 4).
--  * Gruppen löschen räumt Mitgliedschaften und Rechte mit ab (CASCADE).
--
-- Erst die Daten, dann die Struktur: MariaDB rollt DDL nicht zurück, die
-- Datenschritte sind deshalb so geschrieben, dass sie wiederholbar sind.

-- 1) Mehrere Leitungsgruppen in einer FIR: Die älteste bleibt, die Mitglieder
--    der übrigen werden in sie übernommen.
INSERT IGNORE INTO `UserGroup` (`userCID`, `groupId`)
SELECT ug.`userCID`, keep.`keepId`
FROM `UserGroup` ug
JOIN `Group` g ON g.`id` = ug.`groupId`
JOIN (
    SELECT `firId`, MIN(`id`) AS `keepId`
    FROM `Group`
    WHERE `kind` = 'FIR_LEITUNG' AND `firId` IS NOT NULL
    GROUP BY `firId`
) keep ON keep.`firId` = g.`firId`
WHERE g.`kind` = 'FIR_LEITUNG' AND g.`id` <> keep.`keepId`;

-- 2) Überzählige Leitungsgruppen und alle Team-Gruppen werden normale Untergruppen.
UPDATE `Group` g
JOIN (
    SELECT `firId`, MIN(`id`) AS `keepId`
    FROM `Group`
    WHERE `kind` = 'FIR_LEITUNG' AND `firId` IS NOT NULL
    GROUP BY `firId`
) keep ON keep.`firId` = g.`firId`
SET g.`kind` = 'CUSTOM'
WHERE g.`kind` = 'FIR_LEITUNG' AND g.`id` <> keep.`keepId`;

UPDATE `Group` SET `kind` = 'CUSTOM' WHERE `kind` = 'FIR_LEITUNG' AND `firId` IS NULL;
UPDATE `Group` SET `kind` = 'CUSTOM' WHERE `kind` = 'FIR_TEAM';

-- 3) FIR ohne Leitungsgruppe bekommt eine leere.
INSERT INTO `Group` (`name`, `description`, `kind`, `firId`, `createdAt`, `updatedAt`)
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1 FROM `Group` x
            WHERE x.`firId` = f.`id` AND x.`name` = CONCAT(f.`code`, ' Eventleitung')
        ) THEN CONCAT(f.`code`, ' Eventleitung (Leitung)')
        ELSE CONCAT(f.`code`, ' Eventleitung')
    END,
    CONCAT('Eventleitung der FIR ', f.`code`),
    'FIR_LEITUNG',
    f.`id`,
    CURRENT_TIMESTAMP(3),
    CURRENT_TIMESTAMP(3)
FROM `FIR` f
WHERE NOT EXISTS (
    SELECT 1 FROM `Group` g WHERE g.`firId` = f.`id` AND g.`kind` = 'FIR_LEITUNG'
);

-- 4) Die Leitungsgruppe hat ihre Rechte künftig fest – gespeicherte Zeilen entfallen.
--    Ausnahme roster.contact: Es wird nur ausdrücklich vergeben und ist nicht
--    Teil der festen Leitungsrechte. Hatte eine Leitung es, übernimmt eine neue
--    Untergruppe „<FIR> Ansprechpartner Abmeldungen“ ihre Mitglieder und das Recht.
INSERT INTO `Group` (`name`, `description`, `kind`, `firId`, `createdAt`, `updatedAt`)
SELECT DISTINCT
    CONCAT(f.`code`, ' Ansprechpartner Abmeldungen'),
    'Aus der Leitung übernommen: Ansprechpartner für Abmeldungen',
    'CUSTOM',
    g.`firId`,
    CURRENT_TIMESTAMP(3),
    CURRENT_TIMESTAMP(3)
FROM `GroupPermission` gp
JOIN `Permission` p ON p.`id` = gp.`permissionId` AND p.`key` = 'roster.contact'
JOIN `Group` g ON g.`id` = gp.`groupId` AND g.`kind` = 'FIR_LEITUNG'
JOIN `FIR` f ON f.`id` = g.`firId`
WHERE NOT EXISTS (
    SELECT 1 FROM `Group` x
    WHERE x.`firId` = g.`firId` AND x.`name` = CONCAT(f.`code`, ' Ansprechpartner Abmeldungen')
);

INSERT IGNORE INTO `UserGroup` (`userCID`, `groupId`)
SELECT ug.`userCID`, n.`id`
FROM `UserGroup` ug
JOIN `Group` g ON g.`id` = ug.`groupId` AND g.`kind` = 'FIR_LEITUNG'
JOIN `GroupPermission` gp ON gp.`groupId` = g.`id`
JOIN `Permission` p ON p.`id` = gp.`permissionId` AND p.`key` = 'roster.contact'
JOIN `FIR` f ON f.`id` = g.`firId`
JOIN `Group` n ON n.`firId` = g.`firId` AND n.`name` = CONCAT(f.`code`, ' Ansprechpartner Abmeldungen');

INSERT IGNORE INTO `GroupPermission` (`groupId`, `permissionId`, `scope`)
SELECT DISTINCT n.`id`, p.`id`, 'OWN_FIR'
FROM `GroupPermission` gp
JOIN `Permission` p ON p.`id` = gp.`permissionId` AND p.`key` = 'roster.contact'
JOIN `Group` g ON g.`id` = gp.`groupId` AND g.`kind` = 'FIR_LEITUNG'
JOIN `FIR` f ON f.`id` = g.`firId`
JOIN `Group` n ON n.`firId` = g.`firId` AND n.`name` = CONCAT(f.`code`, ' Ansprechpartner Abmeldungen');

DELETE gp FROM `GroupPermission` gp
JOIN `Group` g ON g.`id` = gp.`groupId`
WHERE g.`kind` = 'FIR_LEITUNG';

-- 5) Ohne Scope darf ein Recht je Gruppe nur einmal vorkommen.
DELETE gp1 FROM `GroupPermission` gp1
JOIN `GroupPermission` gp2
    ON gp1.`groupId` = gp2.`groupId`
   AND gp1.`permissionId` = gp2.`permissionId`
   AND gp1.`id` > gp2.`id`;

-- 6) Struktur: Typ-Enum, Scope-Spalte, eindeutiger Index, kaskadierende Fremdschlüssel.
ALTER TABLE `Group` MODIFY `kind` ENUM('FIR_LEITUNG', 'CUSTOM') NOT NULL DEFAULT 'CUSTOM';

CREATE UNIQUE INDEX `GroupPermission_groupId_permissionId_key` ON `GroupPermission`(`groupId`, `permissionId`);
DROP INDEX `GroupPermission_groupId_permissionId_scope_key` ON `GroupPermission`;
ALTER TABLE `GroupPermission` DROP COLUMN `scope`;

ALTER TABLE `GroupPermission` DROP FOREIGN KEY `GroupPermission_groupId_fkey`;
ALTER TABLE `GroupPermission` DROP FOREIGN KEY `GroupPermission_permissionId_fkey`;
ALTER TABLE `UserGroup` DROP FOREIGN KEY `UserGroup_groupId_fkey`;

ALTER TABLE `GroupPermission` ADD CONSTRAINT `GroupPermission_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `Group`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `GroupPermission` ADD CONSTRAINT `GroupPermission_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `Permission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `UserGroup` ADD CONSTRAINT `UserGroup_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `Group`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- 7) Rechtekatalog übernehmen (Schlüssel wie in lib/acl/catalog.ts).
INSERT IGNORE INTO `Permission` (`key`, `description`) VALUES
    ('event.create', 'Events erstellen'),
    ('event.edit', 'Events bearbeiten'),
    ('event.delete', 'Events löschen'),
    ('event.banner', 'Banner verwalten'),
    ('roster.edit', 'Besetzungsplan bearbeiten'),
    ('roster.publish', 'Besetzungsplan veröffentlichen'),
    ('signups.manage', 'Anmeldungen verwalten'),
    ('event.export', 'Anmeldungen exportieren'),
    ('user.notif', 'Controller benachrichtigen'),
    ('roster.contact', 'Ansprechpartner für Abmeldungen');

-- Das nie vergebbare "event.manage" wurde wie "event.edit" geprüft: Vergaben umhängen.
INSERT IGNORE INTO `GroupPermission` (`groupId`, `permissionId`)
SELECT gp.`groupId`, target.`id`
FROM `GroupPermission` gp
JOIN `Permission` legacy ON legacy.`id` = gp.`permissionId` AND legacy.`key` = 'event.manage'
JOIN `Permission` target ON target.`key` = 'event.edit';

-- Rechte außerhalb des Katalogs entfernen (ihre Vergaben fallen per CASCADE weg).
DELETE FROM `Permission` WHERE `key` NOT IN (
    'event.create', 'event.edit', 'event.delete', 'event.banner',
    'roster.edit', 'roster.publish', 'signups.manage', 'event.export', 'user.notif',
    'roster.contact'
);
