-- Neue Berechtigung roster.contact: Wer sie in einer FIR hat, steht neben den
-- Eventverantwortlichen in der vorbereiteten Forum-PN, mit der sich Lotsen
-- nach dem Anmeldeschluss abmelden. Wird bewusst keiner Gruppe automatisch
-- gegeben – die Kontaktpersonen trägt jede FIR selbst ein.
INSERT INTO `Permission` (`key`, `description`)
SELECT 'roster.contact', 'Ansprechpartner für Abmeldungen (Forum-PN)'
WHERE NOT EXISTS (SELECT 1 FROM `Permission` WHERE `key` = 'roster.contact');
