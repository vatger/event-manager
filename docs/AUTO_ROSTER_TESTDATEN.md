# Testdaten für Besetzungsplan und Auto-Roster

`prisma/seedRosterTest.ts` legt eine Testumgebung an, mit der sich Besetzungsplan,
Auto-Roster und Machbarkeitsprüfung realistisch ausprobieren lassen. Die Freigaben
liegen im Trainings-Cache (Endorsements, Solos, Familiarisierungen). Die
Eignungs-Engine wertet sie also genauso aus wie im Betrieb: Rating, Tier-1-Endorsements,
Solos, S1-TWR, Familiarisierungen und Tier-1-Center.

## Einrichten (SQLite)

```bash
# .env
USE_TEST_DB=true
DATABASE_URL=file:./dev.db
MAIN_ADMIN_CIDS=<deine CID>     # damit du alles bearbeiten darfst

npx prisma generate --schema=prisma/schema.sqlite.prisma
npx prisma db push --schema=prisma/schema.sqlite.prisma
npm run seed:roster-test
npm run dev
```

Der Seed läuft nur mit `USE_TEST_DB=true`. Gegen eine andere Datenbank nur bewusst mit
`npm run seed:roster-test -- --force`.

Er lässt sich beliebig oft ausführen. Jeder Lauf entfernt zuerst alles, was ein früherer
Lauf angelegt hat: Events mit `[Test]` im Namen und Nutzer im CID-Bereich
9000001–9000999. Der Basis-Seed (`prisma/seed.ts`) ist nicht nötig. Die FIR EDMM wird
bei Bedarf angelegt.

> Der Datahub (Stationen) muss erreichbar sein. Ist für die Trainings-API ein echtes
> Token gesetzt (`TRAINING_API_*`), ersetzt der nächtliche Cache-Abgleich die
> Testfreigaben. Dann den Seed einfach erneut laufen lassen.

## Was angelegt wird

### „[Test] München Overload" (Roster angelegt)

- EDDM (Tier 1 ab DEL) und EDDN (S1-TWR), dazu die Sektoren EDMM_ZUG_CTR
  (Tier-1-Center, braucht die Positionsfreigabe und die FAMs STA+WLD), EDMM_WLD_CTR und
  EDMM_STA_CTR.
- 14 Stationen, Samstag in rund drei Wochen, 16:00–22:00z, 55 Anmeldungen.
- Verfügbarkeiten: ganzer Abend, kommt später, geht früher, erste oder zweite Hälfte,
  Pause in der Mitte, nur Kernzeit.
- Dazu:
  - 3 zurückgezogene Anmeldungen
  - 2 nach Anmeldeschluss
  - Abwahlen einzelner Airports
  - Wunschstationen als Freitext, wie sie in Anmeldungen wirklich stehen: „ne Runde
    APN", „TWR N/S", „1. APP 2. TWR", „Walda oder Starnberg", „GND, kein DEL"
  - Bemerkungen
  - Ampel-Markierungen: 3 grün, 2 orange, 2 rot
- Im Plan steht schon einiges von Hand:
  - ZUG 16:00–18:00
  - ein Custom-Block „Combined (NH)" auf EDDM_ND_APP
  - ein „Mentor"-Block für den C3 von 18:00–20:00
- Gedacht für: „Lücken füllen", „Neu planen", Stationen abwählen und die Deutung der
  Wunschstationen. Wie ein Wunsch verstanden wurde, steht in der Seitenleiste des
  Editors unter „Wunschstationen". Wer trotz „kein …" auf einer solchen Station landet,
  ist danach orange markiert und hat eine Notiz dazu.

### „[Test] Nürnberg Engpass" (ohne Roster)

- Nur EDDN, 4 Stunden, zwei Approach-Stationen, aber nur zwei Lotsen mit APP. Einer
  davon ist nur die erste Hälfte da.
- Die Anmeldungsseite meldet schon vor dem Anlegen des Plans: „Geht nicht auf".

### Profile (Name enthält das Kürzel, z. B. „Anna [C1 ZUG]")

| Kürzel | Anzahl | EDDM | EDDN | Besonderheit |
|---|---|---|---|---|
| C1 ZUG | 3 | DEL–APP, CTR | alles | Freigabe EDMM_ZUG_CTR, FAMs STA/WLD/HOF |
| C1 WLD+STA | 4 | DEL–APP, CTR | alles | darf WLD und STA, nicht ZUG |
| C1 WLD | 2 | nur APP, CTR | alles | „WLD only", an EDDM kein TWR/GND/DEL |
| C1 ohne FAM | 1 | DEL–APP | DEL–APP | Center gesperrt |
| S3 Solo STA | 1 | DEL–APP, CTR | alles | Center-Solo: nur EDMM_STA_CTR |
| C3 Mentor | 1 | DEL–APP, CTR | alles | hat im Plan einen Mentor-Block |
| S3 EDDM | 7 | DEL–APP | DEL–APP | |
| S3 nur APP | 1 | DEL, GND, APP | DEL–APP | APP ohne TWR-Endorsement |
| S3 EDDN | 4 | – | DEL–APP | keine Tier-1-Endorsements |
| S2 Solo APP | 1 | DEL–APP | DEL–TWR | APP an EDDM per Solo |
| S2 EDDM | 8 | DEL–TWR | DEL–TWR | |
| S2 GNDDEL | 3 | DEL, GND | DEL–TWR | kein TWR-Endorsement |
| S2 EDDN | 4 | – | DEL–TWR | |
| S1 EDDM | 9 | DEL, GND | DEL–TWR | EDDN_TWR über S1-TWR |
| S1 EDDN | 5 | – | DEL–TWR | |
| S1 Solo TWR | 1 | DEL–TWR | DEL–TWR | TWR an EDDM per Solo |

## Anmelden

- **Mit eigenem Account:** die eigene CID in `MAIN_ADMIN_CIDS` eintragen. Der Nutzer
  entsteht beim ersten Login.
- **Lokal ohne VATGER-Zugang:** mit `DEV_MODE=true` und den
  `VATSIM_SANDBOX_*`-Variablen über VATSIM Connect Sandbox anmelden und die Sandbox-CID in
  `MAIN_ADMIN_CIDS` eintragen.
