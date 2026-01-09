# Discord Bot - Event Reminder System (EDMM)

## Übersicht

Das Discord Bot Event Reminder System ermöglicht automatische Benachrichtigungen für FIR EDMM:
- **Fehlende myVATSIM-Einträge**: Erinnerungen, wenn wöchentliche oder unregelmäßige Events nicht in myVATSIM eingetragen sind
- **Staffing-Probleme**: Warnungen, wenn die Mindestbesetzung für Events nicht erreicht wird

**Hinweis:** Diese Funktion ist aktuell speziell für FIR EDMM konfiguriert.

## Architektur

### 1. Weekly Events Management (Eventleiter)
Über das Admin-Panel (`/admin/edmm/weeklys`) können Eventleiter wöchentliche Events erstellen und verwalten:
- Event-Name
- Wochentag (Montag - Sonntag)
- Rhythmus (z.B. 2 Wochen aktiv, 1 Woche Pause)
- Startdatum
- Aktiviert/Deaktiviert

### 2. Öffentliche Termin-Ansicht (Für alle)
Unter `/weeklys` können alle Benutzer die nächsten geplanten Weekly Events sehen:
- Übersicht für die nächsten 3 Monate
- Gruppiert nach Event-Name
- Status-Badges (Heute, Bevorstehend, Vergangen)

### 3. Discord Bot Konfiguration (Datei-basiert)
Die Discord-spezifischen Einstellungen werden in einer Konfigurationsdatei verwaltet (`discord-bot/config/weeklyEvents.config.ts`):
- Discord Channel IDs
- Discord Role IDs für @mentions
- Staffing-Anforderungen (Regex-Muster)
- Check-Deadlines (Tage vorher)

## Features

### Konfigurierbare wöchentliche Events

- **Einfache Wiederholung**: Jeden Mittwoch, jeden Freitag, etc.
- **Komplexe Muster**: z.B. "München Mittwoch" - 2 Wochen aktiv, 1 Woche Pause, 2 Wochen aktiv, 1 Woche Pause...

#### Beispiel-Konfiguration

**Weekly Event (in Event Manager erstellt):**
- Name: "München Mittwoch"
- Wochentag: Mittwoch
- Wochen aktiv: 2
- Wochen Pause: 1
- Startdatum: 15.01.2026

**Discord Bot Config (`discord-bot/config/weeklyEvents.config.ts`):**
```typescript
"München Mittwoch": {
  channelId: "1200342520731807786",
  roleId: "1416563224286990429",
  checkDaysAhead: 14,
  requiredStaffing: {
    "EDDM_._TWR": 2,
    "EDDM_._GND": 2,
    "EDDM_._APP": 1
  }
}
```

### Automatische Prüfungen

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

### Event-Termine Generierung

Das System generiert automatisch Termine für die nächsten 6 Monate basierend auf:
- Konfiguriertem Wochentag
- Aktivem/Pause-Muster (weeksOn/weeksOff)
- Startdatum

Termine werden in der Datenbank gespeichert und können in beiden Interfaces eingesehen werden.

## Bot starten

Der Discord Bot muss separat vom Next.js Server gestartet werden:

```bash
# Terminal 1: Next.js Server
npm run dev

# Terminal 2: Discord Bot
npm run discord-bot
```

**Wichtig:** 
- Der Bot benötigt die `.env`-Datei mit `DISCORD_BOT_TOKEN`
- Der Bot muss laufen, damit die automatischen Checks (9:00 und 10:00 Uhr) funktionieren
- In Production sollte der Bot mit einem Process Manager (z.B. PM2) laufen

## Verwendung

### Schritt 1: Weekly Event erstellen

1. Gehe zu `/admin/edmm/weeklys` (EDMM Intern Bereich)
2. Klicke auf "Neues Weekly Event"
3. Fülle das Formular aus:
   - Name: z.B. "München Mittwoch"
   - Wochentag: Mittwoch
   - Wochen aktiv: 2
   - Wochen Pause: 1
   - Startdatum: Wähle ein passendes Datum
4. Speichern

Das System generiert automatisch alle Termine für die nächsten 6 Monate.

### Schritt 2: Discord Bot konfigurieren

1. Öffne `discord-bot/config/weeklyEvents.config.ts`
2. Füge einen neuen Eintrag hinzu (verwende **exakt denselben Namen** wie im Event Manager!):

```typescript
"München Mittwoch": {
  channelId: "DEINE_CHANNEL_ID",
  roleId: "DEINE_ROLE_ID",
  checkDaysAhead: 14,
  requiredStaffing: {
    "EDDM_._TWR": 2,
    "EDDM_._GND": 2,
    "EDDM_[AB]_APP": 1,
    "EDUU_.+_CTR": 1
  },
  // Optional: Eigene Embed-Designs
  embeds: {
    myVatsimMissing: {
      color: 0x0099ff,  // Hex-Farbe
      title: "🔔 {eventName}: myVATSIM fehlt!",
      description: "**{eventName}** am {date} ist nicht eingetragen.",
      footer: "EDMM Event Team"
    }
  }
}
```

3. Speichere die Datei
4. Committe sie ins Git-Repository (optional, aber empfohlen)

### Schritt 2b: Embed-Designs anpassen (Optional)

Du kannst die Embed-Designs (Farbe, Titel, Beschreibung) pro Event individuell anpassen.

**Standard-Embeds** (gelten für alle Events):
```typescript
embeds: {
  myVatsimMissing: {
    color: 0xff0000,  // Rot
    title: "❌ Event nicht in myVATSIM eingetragen",
    description: "**{eventName}** ist noch nicht für den {date} in myVATSIM eingetragen.",
  },
  staffingInsufficient: {
    color: 0xff9900,  // Orange
    title: "⚠️ Mindestbesetzung nicht erreicht",
    description: "**{eventName}** – {date}",
  },
}
```

**Verfügbare Variablen:**
- `{eventName}` - Name des Events
- `{date}` - Formatiertes Datum
- `{daysUntil}` - Tage bis zum Event (nur bei myVatsimMissing)

**Farben:**
- Rot: `0xff0000`
- Orange: `0xff9900`
- Gelb: `0xffff00`
- Grün: `0x00ff00`
- Blau: `0x0099ff`
- Lila: `0x9900ff`

Siehe `discord-bot/config/README.md` für mehr Details.

3. Speichere die Datei
4. Committe sie ins Git-Repository (optional, aber empfohlen)

### Schritt 3: Discord Channel und Role IDs finden

1. Aktiviere Developer Mode in Discord (Einstellungen → Erweitert → Developer Mode)
2. Rechtsklick auf Channel → "ID kopieren"
3. Rechtsklick auf Rolle → "ID kopieren"

### Schritt 4: Termine ansehen

**Als Eventleiter:**
- Gehe zu `/admin/edmm/weeklys`
- Siehst die nächsten 5 Termine pro Event

**Als Nicht-Admin:**
- Gehe zu `/weeklys`
- Siehst alle kommenden Termine für die nächsten 3 Monate

## Test-Script (Entwicklungsphase)

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
Speichert die Konfiguration für wöchentliche Events (Name, Rhythmus, Wochentag).

#### WeeklyEventOccurrence
Generierte Termine mit Status-Tracking für Prüfungen.

### Services

#### `weeklyEventConfigService`
CRUD-Operationen für Event-Konfigurationen und Termin-Generierung.

#### `myVatsimEventChecker`
Prüft myVATSIM-API auf registrierte Events (verwendet Config-Datei für checkDaysAhead).

#### `staffingChecker`
Prüft VATSIM ATC-Buchungen gegen konfigurierte Anforderungen (verwendet Config-Datei für Staffing).

### Discord Bot Jobs

#### `runMyVatsimEventCheck()`
- Läuft täglich um 9:00 Uhr
- Prüft wöchentliche und unregelmäßige Events
- Sendet Benachrichtigungen für fehlende Einträge (Channel/Role IDs aus Config-Datei)

#### `runStaffingCheck()`
- Läuft täglich um 10:00 Uhr
- Prüft Staffing für heutige Events
- Sendet Warnungen bei unzureichender Besetzung (Channel/Role IDs aus Config-Datei)

## Konfiguration

### Umgebungsvariablen

Keine zusätzlichen Umgebungsvariablen erforderlich. Die Discord Bot Token-Konfiguration wird aus der bestehenden `.env` übernommen.

### Discord Bot Config

Siehe `discord-bot/config/README.md` für ausführliche Dokumentation zur Konfigurationsdatei.

## Wartung

### Weekly Event ändern

1. Gehe zu `/admin/edmm/weeklys`
2. Klicke auf "Bearbeiten" beim entsprechenden Event
3. Ändere die Werte
4. Speichern → Zukünftige Termine werden automatisch neu generiert

### Discord-Einstellungen ändern

1. Öffne `discord-bot/config/weeklyEvents.config.ts`
2. Ändere die entsprechenden Werte
3. Speichern
4. Änderungen werden beim nächsten Job-Durchlauf aktiv

### Termine aktualisieren

Das System generiert Termine automatisch für 6 Monate. Bei Änderungen am Muster werden zukünftige Termine neu generiert.

## Fehlerbehebung

### Event wird nicht geprüft

**Problem**: Weekly Event existiert, aber keine Discord-Benachrichtigungen

**Lösung**:
1. Prüfe, ob der Event-Name in Event Manager und Config-Datei **exakt** übereinstimmt
2. Prüfe, ob das Event aktiviert ist
3. Prüfe, ob Discord Channel ID konfiguriert ist

### Regex-Fehler bei Staffing

**Problem**: Bot wirft Fehler bei Staffing-Check

**Lösung**:
1. Prüfe Regex-Muster in Config-Datei
2. Teste Regex-Muster online (z.B. regex101.com)
3. Escape Sonderzeichen korrekt

### Termine fehlen

**Problem**: Keine Termine angezeigt

**Lösung**:
1. Event neu speichern (triggert Neuberechnung)
2. Prüfe Startdatum (muss in Vergangenheit oder heute sein)
3. Prüfe weeksOn/weeksOff Werte

## Support

Bei Fragen oder Problemen:
- Dokumentation: `/docs/DISCORD_BOT_CONFIGURATION.md`
- Config-Datei Doku: `discord-bot/config/README.md`
- Issue tracker: GitHub Issues
- Kontakt: VATGER Technik-Team

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
