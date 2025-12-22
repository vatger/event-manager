
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
4. **Choose your database:**
   - **Option A (Easy - SQLite):** No MySQL installation required!
     ```bash
     # In .env, set:
     USE_TEST_DB=true
     DATABASE_URL=file:./dev.db
     
     # Then run:
     npx prisma generate --schema=prisma/schema.sqlite.prisma
     npx prisma db push --schema=prisma/schema.sqlite.prisma
     npx tsx prisma/seed.ts  # Optional: add initial data
     ```
   - **Option B (MySQL/MariaDB):**
     ```bash
     # In .env, configure:
     USE_TEST_DB=false
     DATABASE_URL=mysql://user:password@localhost:3306/dbname
     DB_HOST=localhost
     DB_PORT=3306
     DB_USER=user
     DB_PASSWORD=password
     DB_NAME=dbname
     
     # Then run:
     npx prisma migrate dev
     ```
   - See [SQLite Test Database Guide](docs/SQLITE_TEST_DATABASE.md) for more details
5. Run `npm run dev`

Alternatively, you can build the project using Docker and the `docker-compose.yml`. 
Note that you will be required to add the environment variables to your development environment.

## Contact

- Yannik Schäffler (1649341)
- [@yschaffler](https://github.com/yschaffler)

