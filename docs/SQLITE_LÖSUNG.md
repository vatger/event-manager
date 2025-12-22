# SQLite Test-Datenbank Lösung

## Problem

Das Projekt nutzt Prisma 7 mit MySQL/MariaDB in Production. Entwickler sollten eine einfache Möglichkeit haben, eine Test-Datenbank für Dev-Zwecke zu nutzen, ohne MySQL auf ihrem Rechner installieren zu müssen. Gleichzeitig müssen Migrationen weiterhin mit MySQL erstellt werden können und auf Production (MariaDB) funktionieren.

## Lösung

Die Implementierung nutzt Prismas Adapter-System um intelligent zwischen SQLite (Development) und MariaDB (Production) zu wechseln, basierend auf einer Umgebungsvariable.

### Kernkomponenten

1. **Adapter-basiertes Switching** (`lib/db-adapter.ts`)
   - Dynamische Auswahl zwischen `@prisma/adapter-libsql` (SQLite) und `@prisma/adapter-mariadb` 
   - Gesteuert durch `USE_TEST_DB` Umgebungsvariable
   - Validation der erforderlichen Umgebungsvariablen mit klaren Fehlermeldungen

2. **Dual-Schema Ansatz**
   - `prisma/schema.prisma` - MySQL Schema (Haupt-Version, für Migrations)
   - `prisma/schema.sqlite.prisma` - SQLite Schema (identisch, nur `provider` unterschiedlich)
   - Beide Schemas nutzen identische Typen (inkl. `Json`) für TypeScript-Kompatibilität

3. **Aktualisierte Scripts**
   - Alle Datenbank-Scripts nutzen nun `createDatabaseAdapter()`
   - `dotenv/config` Import in allen Scripts für Umgebungsvariablen
   - Funktioniert sowohl mit SQLite als auch MySQL

4. **Dokumentation & Helper**
   - Umfassende Anleitung in `docs/SQLITE_TEST_DATABASE.md`
   - Setup-Script `scripts/setup-sqlite.sh` für schnelle SQLite-Einrichtung
   - Aktualisierte README mit beiden Workflows

## Verwendung

### SQLite für lokale Entwicklung

```bash
# .env konfigurieren
USE_TEST_DB=true
DATABASE_URL=file:./dev.db

# Schnell-Setup mit Helper-Script
./scripts/setup-sqlite.sh

# Oder manuell:
npx prisma generate --schema=prisma/schema.sqlite.prisma
npx prisma db push --schema=prisma/schema.sqlite.prisma
npx tsx prisma/seed.ts
npm run dev
```

### MySQL/MariaDB für Production

```bash
# .env konfigurieren
USE_TEST_DB=false
DATABASE_URL=mysql://user:pass@host:3306/db
DB_HOST=host
DB_USER=user
DB_PASSWORD=pass
DB_NAME=db

# Normale Migration
npx prisma migrate dev
npm run dev
```

## Migration-Workflow

### Neue Migration erstellen

1. **BEIDE Schema-Dateien aktualisieren**
   ```bash
   # Änderungen in prisma/schema.prisma machen
   # GLEICHE Änderungen in prisma/schema.sqlite.prisma übernehmen
   ```

2. **Migration mit MySQL erstellen**
   ```bash
   # Temporär zu MySQL wechseln
   USE_TEST_DB=false
   npx prisma migrate dev --name deine_migration
   ```

3. **Auf SQLite anwenden**
   ```bash
   # Zurück zu SQLite
   USE_TEST_DB=true
   npx prisma db push --schema=prisma/schema.sqlite.prisma
   npx prisma generate --schema=prisma/schema.sqlite.prisma
   ```

### Warum dieser Ansatz?

- ✅ **Migrations bleiben MySQL-kompatibel** für Production
- ✅ **SQLite-Entwickler nutzen `db push`** statt Migrations
- ✅ **Keine MySQL-Installation nötig** für lokale Entwicklung
- ✅ **TypeScript-Typen bleiben kompatibel** zwischen beiden DBs
- ✅ **Production-Sicherheit** - Migrations-Dateien sind immer MySQL-Format

## Intelligente Features

1. **Automatische Adapter-Auswahl**: Runtime-Code wählt automatisch den richtigen Adapter
2. **Validation**: Klare Fehlermeldungen bei fehlenden MySQL-Variablen
3. **Type-Safety**: Identische Prisma Client Typen für beide Datenbanken
4. **Einfaches Setup**: Ein Befehl für komplette SQLite-Einrichtung

## Bekannte Einschränkungen von SQLite

- `skipDuplicates` wird nicht unterstützt (TypeScript-Warnungen möglich)
- Keine native JSON-Validierung (als TEXT gespeichert)
- Datums-Handling unterscheidet sich leicht
- Datei-basiertes Locking (nicht für Production geeignet)

Diese Einschränkungen sind der Grund, warum Production immer MySQL/MariaDB nutzt.

## Sicherheit

- ✅ Keine neuen Sicherheitslücken eingeführt (CodeQL geprüft)
- ✅ Adapter-Packages bleiben in `dependencies` (nicht `devDependencies`), da Code sie immer importiert
- ✅ Validation verhindert Runtime-Fehler bei fehlender Konfiguration

## Zusammenfassung

Die Lösung erfüllt alle Anforderungen:

1. ✅ **SQLite als Test-DB**: Entwickler können lokal ohne MySQL arbeiten
2. ✅ **Migrations bleiben MySQL**: Production nutzt weiterhin MariaDB mit Migrations
3. ✅ **Intelligente Lösung**: Adapter-basiertes Switching ohne Code-Duplizierung
4. ✅ **Production-Safe**: Keine Gefahr, SQLite-spezifischen Code in Production zu deployen
5. ✅ **Gut dokumentiert**: Klare Anleitungen und Helper-Scripts

Die Implementation nutzt Prisma 7's moderne Adapter-Features optimal aus und ermöglicht eine flexible, sichere Entwicklungsumgebung.
