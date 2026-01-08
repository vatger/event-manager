# Discord Bot - Event Reminder System (EDMM)

## Übersicht

Das Discord Bot Event Reminder System ermöglicht automatische Benachrichtigungen für FIR EDMM:
- **Fehlende myVATSIM-Einträge**: Erinnerungen, wenn wöchentliche oder unregelmäßige Events nicht in myVATSIM eingetragen sind
- **Staffing-Probleme**: Warnungen, wenn die Mindestbesetzung für Events nicht erreicht wird

**Hinweis:** Diese Funktion ist aktuell speziell für FIR EDMM konfiguriert und im EDMM Intern-Bereich verfügbar.

## Features

### 1. Konfigurierbare wöchentliche Events

Über das Admin-Panel (`/admin/edmm/discord-bot`) können wöchentliche Events mit flexiblen Mustern konfiguriert werden:

- **Einfache Wiederholung**: Jeden Mittwoch, jeden Freitag, etc.
- **Komplexe Muster**: z.B. "München Mittwoch" - 2 Wochen aktiv, 1 Woche Pause, 2 Wochen aktiv, 1 Woche Pause...

#### Beispiel-Konfiguration

```json
{
  "name": "München Mittwoch",
  "weekday": 3,           // Mittwoch (0 = Sonntag, 3 = Mittwoch)
  "weeksOn": 2,           // 2 Wochen aktiv
  "weeksOff": 1,          // 1 Woche Pause
  "startDate": "2026-01-15",
  "checkDaysAhead": 14,   // 14 Tage vorher prüfen
  "discordChannelId": "1200342520731807786",
  "discordRoleId": "1416563224286990429",
  "requiredStaffing": {
    "EDDM_._TWR": 2,
    "EDDM_._GND": 2,
    "EDDM_._APP": 1
  }
}
```

### 2. Automatische Prüfungen

#### myVATSIM Event Check (täglich 9:00 Uhr)

Prüft für:
- **Wöchentliche Events**: Basierend auf den konfigurierten Event-Mustern
- **Unregelmäßige Events**: Aus dem Event Manager (14 Tage vorher)

Sendet Discord-Benachrichtigung wenn:
- Event nicht in myVATSIM eingetragen ist
- Die konfigurierte Deadline erreicht ist (z.B. 14 Tage vorher)

#### Staffing Check (täglich 10:00 Uhr)

Prüft für heutige Events:
- ATC-Buchungen über die VATSIM API
- Vergleich mit konfigurierten Mindestanforderungen
- Unterstützt Regex-Muster für Callsigns

Sendet Discord-Benachrichtigung wenn:
- Mindestbesetzung nicht erreicht ist
- Benachrichtigung enthält Details zu fehlenden Positionen

### 3. Event-Termine Generierung

Das System generiert automatisch Termine für die nächsten 6 Monate basierend auf:
- Konfiguriertem Wochentag
- Aktivem/Pause-Muster (weeksOn/weeksOff)
- Startdatum

Termine werden in der Datenbank gespeichert und können im Admin-Panel eingesehen werden.

## Admin Panel

### Zugriff

Navigate zu `/admin/edmm/discord-bot` im Event Manager (EDMM Intern Bereich).

### Funktionen

1. **Event erstellen/bearbeiten**
   - Name und Beschreibung
   - Wochentag auswählen
   - Wiederholungsmuster konfigurieren
   - Discord-Einstellungen (Channel ID, Role ID)
   - Staffing-Anforderungen definieren

2. **Event-Termine anzeigen**
   - Nächste 10 generierte Termine
   - Status-Indikatoren für myVATSIM-Prüfung
   - Status-Indikatoren für Staffing-Prüfung

3. **Events aktivieren/deaktivieren**
   - Temporär deaktivieren ohne zu löschen
   - Nützlich für Pausen oder Änderungen

### Test-Script (Entwicklungsphase)

Für Tests während der Entwicklung steht ein Konsolen-Script zur Verfügung:

```bash
# Beide Checks ausführen
npx tsx scripts/testDiscordBot.ts

# Nur myVATSIM Check
npx tsx scripts/testDiscordBot.ts myvatsim

# Nur Staffing Check
npx tsx scripts/testDiscordBot.ts staffing
```

Das Script führt die Discord Bot Checks manuell aus und zeigt detaillierte Ergebnisse in der Konsole an.

**Wichtig:** Das Script benötigt eine `.env`-Datei mit Datenbank- und Discord-Konfiguration. 
Siehe `scripts/README.md` für Details zur Konfiguration.

## Technische Details

### Datenbank-Modelle

#### WeeklyEventConfiguration
Speichert die Konfiguration für wöchentliche Events.

#### WeeklyEventOccurrence
Generierte Termine mit Status-Tracking für Prüfungen.

#### DiscordBotConfiguration
FIR-spezifische Discord-Einstellungen (optional).

### Services

#### `weeklyEventConfigService`
CRUD-Operationen für Event-Konfigurationen und Termin-Generierung.

#### `myVatsimEventChecker`
Prüft myVATSIM-API auf registrierte Events.

#### `staffingChecker`
Prüft VATSIM ATC-Buchungen gegen konfigurierte Anforderungen.

### Discord Bot Jobs

#### `runMyVatsimEventCheck()`
- Läuft täglich um 9:00 Uhr
- Prüft wöchentliche und unregelmäßige Events
- Sendet Benachrichtigungen für fehlende Einträge

#### `runStaffingCheck()`
- Läuft täglich um 10:00 Uhr
- Prüft Staffing für heutige Events
- Sendet Warnungen bei unzureichender Besetzung

## Konfiguration

### Umgebungsvariablen

Keine zusätzlichen Umgebungsvariablen erforderlich. Die Discord Bot Token-Konfiguration wird aus der bestehenden `.env` übernommen.

### Discord-Einstellungen

Für jedes Event:
- **Channel ID**: Discord Channel für Benachrichtigungen
- **Role ID** (optional): Rolle zum Ping/Erwähnen

So findest du IDs in Discord:
1. Aktiviere Developer Mode in Discord (Einstellungen → Erweitert)
2. Rechtsklick auf Channel/Rolle → "ID kopieren"

## Beispiel: München Mittwoch Setup

1. **Admin Panel öffnen**: `/admin/discord-bot`

2. **"Neues Event" klicken**

3. **Konfiguration ausfüllen**:
   ```
   Name: München Mittwoch
   Wochentag: Mittwoch
   Wochen aktiv: 2
   Wochen Pause: 1
   Startdatum: 2026-01-15
   Prüfung Tage vorher: 14
   Discord Channel ID: [Deine Channel ID]
   Discord Role ID: [Deine Role ID]
   ```

4. **Staffing-Anforderungen** (JSON):
   ```json
   {
     "EDDM_._TWR": 2,
     "EDDM_._GND": 2,
     "EDDM_[ABCD]_APP": 1,
     "EDUU_.+_CTR": 1
   }
   ```

5. **Speichern** - Das System generiert automatisch alle Termine für die nächsten 6 Monate

## Wartung

### Termine aktualisieren

Das System generiert Termine automatisch für 6 Monate. Bei Änderungen am Muster werden zukünftige Termine neu generiert.

### Logs überprüfen

Discord Bot Logs enthalten:
- Erfolgreiche/fehlgeschlagene Prüfungen
- Gesendete Benachrichtigungen
- Fehler bei API-Aufrufen

## Migration

Wenn du von der alten hartcodierten Konfiguration migrierst:

1. Alte Konfiguration aus `discord-bot/events/weeklyEvents.ts` kopieren
2. Im Admin Panel neue Konfiguration erstellen
3. Alte Konfiguration kann nach Verifizierung entfernt werden

Die alte `runWeeklyStaffingCheck()` Job bleibt vorläufig aktiv für Backward Compatibility.
