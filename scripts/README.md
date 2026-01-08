# Scripts

Dieses Verzeichnis enthält verschiedene Hilfsskripte für das Event Manager System.

## Discord Bot Test Script

**Datei:** `testDiscordBot.ts`

Manuelles Test-Script für die Discord Bot Funktionen. Nur für Entwicklungs- und Testzwecke.

### Verwendung

```bash
# Beide Checks ausführen (Standard)
npx tsx scripts/testDiscordBot.ts

# Nur myVATSIM Check
npx tsx scripts/testDiscordBot.ts myvatsim

# Nur Staffing Check
npx tsx scripts/testDiscordBot.ts staffing
```

### Funktionen

- **myVATSIM Check**: Prüft, ob wöchentliche und unregelmäßige Events in myVATSIM registriert sind
- **Staffing Check**: Prüft die Staffing-Anforderungen für heutige Events

### Ausgabe

Das Script gibt detaillierte JSON-Ergebnisse in der Konsole aus und zeigt:
- Anzahl der geprüften Events
- Anzahl der gesendeten Benachrichtigungen
- Detaillierte Ergebnisse für jedes Event

### Voraussetzungen

- Discord Bot Token in `.env` konfiguriert
- Datenbankverbindung konfiguriert
- Discord Bot Client muss laufen

## Weitere Scripts

- **setMainAdmin.ts**: Setzt einen Benutzer als MAIN_ADMIN
- **testEventReminder.ts**: Testet Event-Erinnerungen
- **setup-sqlite.sh**: Richtet SQLite-Datenbank ein
