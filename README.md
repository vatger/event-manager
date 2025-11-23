
# Eventmanager

Der **Eventmanager** ist eine zentrale Plattform zur Verwaltung von **Controlleranmeldungen** und zur Erstellung sowie Veröffentlichung von **Besetzungsplänen** an die angemeldeten Controller.

Er vereinfacht interne Abläufe im Zusammenhang mit Events, automatisiert viele organisatorische Schritte, wie export der Anmeldungen in das Google Sheets, in dem der Besetzungsplan erstellt dann werden kann.

## Features

- **Multi-FIR Support**: Unterstützt mehrere FIR-Teams (EDMM, EDGG, EDWW) mit individuellen Export-Layouts
- **FIR-spezifische Google Sheets**: Jede FIR kann ihre Signups in ein eigenes Google Sheet exportieren
- **Konfigurierbare Export-Layouts**: Anpassbare Layouts für verschiedene Event-Teams
- **Automatisierter Export**: Direkte Synchronisation von Anmeldungen zu Google Sheets


## Running the Application

Development:

1. Run `npm install`
2. Copy the `.env.example` to `.env`
3. Edit the values stored in the `.env` file
   - Configure Google Sheets credentials
   - (Optional) Set FIR-specific sheet IDs: `GOOGLE_SHEET_ID_EDMM`, `GOOGLE_SHEET_ID_EDGG`, `GOOGLE_SHEET_ID_EDWW`
4. Initialize the Database `npx prisma migrate dev`
4. Run `npm run dev`

Alternatively, you can build the project using Docker and the `docker-compose.yml`. 
Note that you will be required to add the environment variables to your development environment.

## Features

### Automatische Training-Daten Cache-Aktualisierung

Der Eventmanager aktualisiert automatisch die Trainingsdaten (Endorsements, Solos, Familiarisierungen) mindestens einmal täglich über einen integrierten Cron-Job.

- **Standard-Zeitplan**: Täglich um 3:00 Uhr UTC
- **Konfigurierbar**: Via `TRAINING_CACHE_REFRESH_CRON` Umgebungsvariable
- **Dokumentation**: Siehe [TRAINING_CACHE_CRON.md](docs/TRAINING_CACHE_CRON.md)

## Contact

- Yannik Schäffler (1649341)
- [@yschaffler](https://github.com/yschaffler)

