-- Blöcke in der Zeile eines Controllers (z. B. "Mentor", "Pause") hängen an
-- keiner Station. stationId wird dafür optional; bestehende Zeilen behalten
-- ihren Wert.
ALTER TABLE `EventRosterAssignment` MODIFY `stationId` INTEGER NULL;
