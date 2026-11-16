-- Remarks einer Anmeldung waren VARCHAR(191); längere Bemerkungen scheiterten
-- beim Speichern. Grenze jetzt 1000 Zeichen (lib/signups/signupLimits.ts).
ALTER TABLE `EventSignup` MODIFY `remarks` TEXT NULL;
