-- Event-Rechte aufgeteilt
--
-- event.edit heißt jetzt „Stammdaten bearbeiten“ und schließt nichts anderes
-- mehr ein. Bisher deckte es in den Prüfungen zusätzlich Banner, Anmeldephase,
-- Besetzungsplan bearbeiten und veröffentlichen sowie Anmeldungen verwalten
-- ab. Damit niemand etwas verliert, bekommen alle Gruppen mit event.edit diese
-- Rechte hier ausdrücklich dazu. Die Leitungsgruppen haben ohnehin alle Rechte.

-- 1) Neues Recht „Anmeldephase steuern“
INSERT IGNORE INTO `Permission` (`key`, `description`) VALUES
    ('signups.phase', 'Anmeldephase steuern'),
    ('event.banner', 'Banner verwalten'),
    ('roster.edit', 'Besetzungsplan bearbeiten'),
    ('roster.publish', 'Besetzungsplan veröffentlichen'),
    ('signups.manage', 'Anmeldungen verwalten');

UPDATE `Permission` SET `description` = 'Stammdaten bearbeiten' WHERE `key` = 'event.edit';

-- 2) Bisher in event.edit enthaltene Rechte ausdrücklich vergeben
INSERT IGNORE INTO `GroupPermission` (`groupId`, `permissionId`)
SELECT gp.`groupId`, extra.`id`
FROM `GroupPermission` gp
JOIN `Permission` edit ON edit.`id` = gp.`permissionId` AND edit.`key` = 'event.edit'
JOIN `Permission` extra ON extra.`key` IN (
    'event.banner', 'signups.phase', 'roster.edit', 'roster.publish', 'signups.manage'
);
