# Lokaler Testmodus

Startet den Eventmanager komplett lokal – ohne VATGER Connect, Training-API,
Datahub, S1-Anmeldung, Benachrichtigungen, Discord oder Buchungen.

```bash
npm run dev:local            # Datenbank behalten
npm run dev:local -- --reset # Datenbank neu anlegen und Testdaten einspielen
```

Danach `http://localhost:3000/auth/signin` öffnen und einen Testnutzer
auswählen. Läuft der Server auf einem anderen Rechner, per SSH-Tunnel:
`ssh -L 3000:localhost:3000 <host>`.

## Was der Modus macht

| Bereich | Im Testmodus |
|---|---|
| Datenbank | SQLite in `local-test.db` (wird von git ignoriert) |
| Anmeldung | Auswahl eines vorhandenen Nutzers ohne Passwort (Provider `local-test`); VATGER Connect ist abgeschaltet |
| Hauptadmin | CID 1000001 (`MAIN_ADMIN_CIDS`) |
| Datahub-Stationen | Snapshot in `fixtures/local-test/stations.json` |
| Pflichtkurse | keine |
| Theory Roster | CIDs aus `lib/localTest/fixtures.ts` |
| Endorsements, Solos | vom Seed in die Trainings-Cache-Tabellen geschrieben; die Training-API wird nie abgefragt |
| Benachrichtigungen, Discord | werden angenommen und nur geloggt |
| Alle anderen externen Adressen | blockiert (HTTP 503, Log `[LOCAL TEST] Externe Anfrage blockiert`) |

Externe Anfragen fängt `lib/localTest/offlineFetch.ts` zentral ab: Beim Start
ersetzt `instrumentation.ts` das serverseitige `fetch`. Anfragen an
`localhost` laufen normal.

## Testdaten

`scripts/local-test/seed.ts` legt nach `prisma/seed.ts` (Berechtigungen,
FIRs, Gruppen) an:

- 21 Nutzer (CIDs 1000001–1000032) mit S1 bis C3, darunter die Eventleitung
  EDWW (1000002) und zwei Controller auf dem Theory Roster
- T1-Endorsements für Hamburg, CTR-Endorsements für EDWW, eine Solo-Freigabe
- „Bremen & Hamburg Overload (Test)“: Anmeldung geschlossen, 17 Anmeldungen
  mit Wünschen und Abwesenheiten, Besetzungsplan mit 8 Stationen – zum
  Ausprobieren der automatischen Planung
- „Hamburg Night (Test)“: Anmeldung offen, noch kein Besetzungsplan
- „München Local (Test)“: in Planung

Die Termine liegen relativ zum Zeitpunkt des Seeds in der Zukunft.

## Sicherheit

Weil sich jeder als jeder anmelden kann, greift der Modus nur, wenn
`LOCAL_TEST_MODE=true` **und** `USE_TEST_DB=true` gesetzt sind und kein
Produktions-Build läuft (`NODE_ENV !== "production"`). Der Server lauscht nur
auf `127.0.0.1`.

## Hinweis zum Prisma-Client

`dev:local` erzeugt den Prisma-Client aus `prisma/schema.sqlite.prisma`. Für
die normale Entwicklung mit MySQL danach wieder:

```bash
npx prisma generate --schema=prisma/schema.prisma
```
