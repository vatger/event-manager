# Scripts

Dieses Verzeichnis enthält verschiedene Hilfsskripte für das Event Manager System.

## Discord Bot Test Script

**Datei:** `testDiscordBot.ts`

Manuelles Test-Script für die Discord Bot Funktionen. Nur für Entwicklungs- und Testzwecke.

### Voraussetzungen

Das Script benötigt eine konfigurierte `.env`-Datei mit den folgenden Variablen:

**Für SQLite (Entwicklung):**
```env
USE_TEST_DB=true
DATABASE_URL=file:./dev.db
DISCORD_BOT_TOKEN=your_token_here
```

**Für MySQL/MariaDB (Produktion):**
```env
USE_TEST_DB=false
DATABASE_URL=mysql://user:password@host:3306/database
DB_HOST=localhost
DB_PORT=3306
DB_USER=user
DB_PASSWORD=password
DB_NAME=eventmanager
DISCORD_BOT_TOKEN=your_token_here
```

**Hinweis:** Das Script lädt automatisch die Umgebungsvariablen aus der `.env`-Datei.

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

## Weitere Scripts

- **setMainAdmin.ts**: Setzt einen Benutzer als MAIN_ADMIN
- **testEventReminder.ts**: Testet Event-Erinnerungen
- **setup-sqlite.sh**: Richtet SQLite-Datenbank ein
