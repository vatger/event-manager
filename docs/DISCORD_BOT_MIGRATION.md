# Migration von hardcodierter zu datenbankbasierter Discord Bot Konfiguration

## Übersicht

Diese Anleitung erklärt, wie man von der alten hardcodierten Discord Bot Konfiguration (`discord-bot/events/weeklyEvents.ts`) zur neuen datenbankbasierten Konfiguration migriert.

## Vorbereitungen

1. **Datenbank-Migration ausführen**:
   ```bash
   npx prisma migrate deploy
   ```
   
   Dies führt die Migration `20260108165343_add_discord_bot_configuration` aus.

2. **Prisma Client neu generieren**:
   ```bash
   npx prisma generate
   ```

## Migration Schritt für Schritt

### Schritt 1: Alte Konfiguration dokumentieren

Die alte Konfiguration in `discord-bot/events/weeklyEvents.ts` sieht etwa so aus:

```typescript
export const weeklyEvents: IWeeklyEvent[] = [
  {
    weekday: 5,
    label: "Frankfurt Friday",
    requiredStaffing: {
      "ED(?:GG_[GRHDB]|UU_[FSW]).._CTR": 2,
      "EDDF_._APP": 2,
      "EDDF_._TWR": 2,
      "EDDF_._GND": 2,
      "EDDF_DEL": 1,
    },
    channelId: "1200342520731807786",
    pingId: "1416563224286990429",
  },
];
```

### Schritt 2: Admin Panel öffnen

1. Navigiere zu `/admin/discord-bot` im Event Manager
2. Klicke auf "Neues Event"

### Schritt 3: Konfiguration übertragen

Für jedes Event in der alten Konfiguration:

#### Beispiel: Frankfurt Friday

1. **Grundeinstellungen**:
   - Name: `Frankfurt Friday`
   - Wochentag: `Freitag` (5)
   - Wochen aktiv: `1` (jede Woche)
   - Wochen Pause: `0` (keine Pause)
   - Startdatum: Wähle ein passendes Startdatum (z.B. den nächsten Freitag)

2. **Discord-Einstellungen**:
   - Discord Channel ID: `1200342520731807786`
   - Discord Role ID: `1416563224286990429`

3. **Prüfungseinstellungen**:
   - Prüfung Tage vorher: `14` (Standard)

4. **Staffing-Anforderungen** (JSON):
   ```json
   {
     "ED(?:GG_[GRHDB]|UU_[FSW]).._CTR": 2,
     "EDDF_._APP": 2,
     "EDDF_._TWR": 2,
     "EDDF_._GND": 2,
     "EDDF_DEL": 1
   }
   ```

5. Klicke auf "Speichern"

#### Beispiel: München Mittwoch (2 Wochen aktiv, 1 Woche Pause)

Falls du einen "München Mittwoch" mit dem Muster "2 Wochen aktiv, 1 Woche Pause" hast:

1. **Grundeinstellungen**:
   - Name: `München Mittwoch`
   - Wochentag: `Mittwoch` (3)
   - Wochen aktiv: `2`
   - Wochen Pause: `1`
   - Startdatum: Erster Mittwoch des Musters

2. **Discord-Einstellungen**:
   - Discord Channel ID: [Deine Channel ID]
   - Discord Role ID: [Deine Role ID]

3. **Staffing-Anforderungen**:
   ```json
   {
     "EDDM_._TWR": 2,
     "EDDM_._GND": 2,
     "EDDM_[AB]_APP": 1,
     "EDUU_.+_CTR": 1
   }
   ```

### Schritt 4: Verifikation

1. Nach dem Speichern sollten die generierten Termine unter dem Event angezeigt werden
2. Prüfe, ob die Termine dem erwarteten Muster entsprechen
3. Für komplexe Muster (z.B. 2 Wochen on, 1 Woche off): Vergleiche die generierten Termine mit dem erwarteten Kalender

### Schritt 5: Testen

1. **Entwicklungsumgebung**: 
   - Teste die myVATSIM-Prüfung manuell
   - Teste die Staffing-Prüfung manuell

2. **Produktionsumgebung**:
   - Aktiviere zunächst nur ein Event
   - Warte auf die erste automatische Prüfung (9:00 Uhr für myVATSIM, 10:00 Uhr für Staffing)
   - Verifiziere die Discord-Benachrichtigungen

### Schritt 6: Alte Konfiguration deaktivieren

Sobald die neue Konfiguration erfolgreich getestet wurde:

1. Die alte `runWeeklyStaffingCheck()` Funktion läuft noch parallel zur neuen
2. Du kannst sie deaktivieren, indem du diese Zeile aus `discord-bot/scheduler.ts` entfernst:
   ```typescript
   const ONE_DAY = 1000 * 60 * 60 * 24;
   setInterval(runWeeklyStaffingCheck, ONE_DAY);
   ```

3. Optional: Entferne die alte Konfigurationsdatei:
   - `discord-bot/events/weeklyEvents.ts`
   - `discord-bot/events/event.types.ts`
   - `discord-bot/jobs/weeklyStaffing.job.ts`

## Fehlerbehebung

### Problem: Termine werden nicht generiert

**Lösung**: 
- Prüfe das Startdatum - es sollte in der Vergangenheit oder heute sein
- Prüfe die Wochentag-Konfiguration (0 = Sonntag, 6 = Samstag)

### Problem: Falsche Termine

**Lösung**:
- Für komplexe Muster: Stelle sicher, dass das Startdatum auf dem richtigen Wochentag liegt
- Prüfe weeksOn/weeksOff Werte
- Bei Bedarf: Event löschen und mit korrigierter Konfiguration neu erstellen

### Problem: Discord-Benachrichtigungen werden nicht gesendet

**Lösung**:
- Prüfe Discord Channel ID und Role ID
- Stelle sicher, dass der Bot Zugriff auf den Channel hat
- Prüfe Bot-Token in der `.env`-Datei

### Problem: Keine Berechtigung zum Erstellen/Bearbeiten

**Lösung**:
- Nur MAIN_ADMIN und VATGER Leitung können Discord Bot Konfigurationen verwalten
- Kontaktiere einen Admin für Berechtigungen

## Support

Bei Fragen oder Problemen:
- Dokumentation: `/docs/DISCORD_BOT_CONFIGURATION.md`
- Issue tracker: GitHub Issues
- Kontakt: VATGER Technik-Team
