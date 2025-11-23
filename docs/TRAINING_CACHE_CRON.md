# Automatische Training-Daten Cache-Aktualisierung

## Übersicht

Der Eventmanager aktualisiert automatisch die Trainingsdaten (Endorsements, Solos und Familiarisierungen) mindestens einmal täglich über einen integrierten Cron-Job.

## Funktionsweise

### Standard-Verhalten
- **Zeitplan**: Täglich um 3:00 Uhr UTC (standardmäßig)
- **Daten**: Endorsements, Solo-Freigaben und Sektoren-Familiarisierungen
- **Quelle**: VATSIM Germany Training API
- **Automatisch**: Der Cron-Job startet beim Start des Docker-Containers

### Konfiguration

Der Zeitplan für die automatische Aktualisierung kann über die Umgebungsvariable `TRAINING_CACHE_REFRESH_CRON` angepasst werden.

#### Standard-Konfiguration (3:00 Uhr UTC täglich)
```bash
TRAINING_CACHE_REFRESH_CRON="0 3 * * *"
```

#### Beispiele für andere Zeitpläne

**Alle 6 Stunden:**
```bash
TRAINING_CACHE_REFRESH_CRON="0 */6 * * *"
```

**Zweimal täglich (3:00 und 15:00 UTC):**
```bash
# Hinweis: Für mehrere Zeitpunkte sollte der Code angepasst werden
TRAINING_CACHE_REFRESH_CRON="0 3,15 * * *"
```

**Jede Stunde:**
```bash
TRAINING_CACHE_REFRESH_CRON="0 * * * *"
```

#### Cron-Syntax

Die Cron-Syntax folgt dem Standard-Format:
```
┌────────────── Minute (0 - 59)
│ ┌──────────── Stunde (0 - 23)
│ │ ┌────────── Tag des Monats (1 - 31)
│ │ │ ┌──────── Monat (1 - 12)
│ │ │ │ ┌────── Wochentag (0 - 7, wobei 0 und 7 Sonntag sind)
│ │ │ │ │
* * * * *
```

Weitere Informationen zur Syntax: [node-cron Dokumentation](https://www.npmjs.com/package/node-cron)

## Implementierung

### Technische Details

1. **Cron-Service**: `lib/cron/cronService.ts`
   - Initialisiert alle geplanten Aufgaben
   - Wird beim Serverstart automatisch gestartet

2. **Instrumentation**: `instrumentation.ts`
   - Next.js Instrumentation Hook
   - Startet den Cron-Service beim Server-Start

3. **Cache-Service**: `lib/training/cacheService.ts`
   - Enthält die Logik zum Aktualisieren der Trainingsdaten
   - Wird vom Cron-Job aufgerufen

### Logging

Der Cron-Job protokolliert seine Aktivitäten in den Server-Logs:

```
[Cron] Initializing scheduled jobs...
[Cron] All cron jobs initialized successfully
[Cron] - Training cache refresh: Schedule = 0 3 * * *
[Cron] Starting scheduled training data cache refresh...
[Cron] Training cache refreshed successfully: { solos: 150, endorsements: 300, familiarizations: 200 }
```

Bei Fehlern wird ebenfalls protokolliert:
```
[Cron] Training cache refresh failed: Error: API connection failed
```

## Manuelle Aktualisierung

Zusätzlich zur automatischen Aktualisierung kann der Cache auch manuell aktualisiert werden:

### API-Endpunkt
```
GET /api/endorsements/refresh
```

Dieser Endpunkt kann verwendet werden, um eine sofortige Aktualisierung auszulösen, z.B. nach einer Änderung im Trainings-System.

## Docker-Integration

Der Cron-Job läuft automatisch im Docker-Container. Keine zusätzlichen Konfigurationen erforderlich.

### Standalone-Modus
Da die Anwendung im `standalone`-Modus gebaut wird, sind alle notwendigen Dateien (inkl. `instrumentation.ts` und `node-cron`) im Docker-Image enthalten.

## Troubleshooting

### Cron-Job startet nicht
1. Überprüfen Sie die Server-Logs auf Fehlermeldungen
2. Stellen Sie sicher, dass die `instrumentation.ts` Datei im Build enthalten ist
3. Prüfen Sie, ob die Umgebungsvariablen korrekt gesetzt sind

### Daten werden nicht aktualisiert
1. Überprüfen Sie die API-Token und URLs in den Umgebungsvariablen
2. Prüfen Sie die Logs auf API-Fehler
3. Testen Sie die manuelle Aktualisierung über `/api/endorsements/refresh`

### Zeitplan funktioniert nicht wie erwartet
1. Überprüfen Sie die Cron-Syntax
2. Beachten Sie, dass die Zeiten in UTC angegeben werden
3. Verwenden Sie einen [Cron-Expression-Generator](https://crontab.guru/) zur Validierung

## Wartung

### Updates des Cron-Zeitplans
Um den Zeitplan zu ändern:
1. Setzen Sie die Umgebungsvariable `TRAINING_CACHE_REFRESH_CRON` auf den gewünschten Wert
2. Starten Sie den Container neu

### Deaktivierung
Falls die automatische Aktualisierung vorübergehend deaktiviert werden soll, kann ein ungültiger Cron-Ausdruck verwendet werden. Besser ist es jedoch, den relevanten Code in `lib/cron/cronService.ts` zu kommentieren.
