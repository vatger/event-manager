# Externe API (`/api/v1`)

Lesender Zugriff auf Events und Besetzungspläne, z. B. für ATCISS oder Bots.

## Anmeldung

Jede Anfrage braucht **entweder**

- eine gültige Session (angemeldet im Eventmanager, Cookie), **oder**
- ein API-Token im Header:

  ```
  Authorization: Bearer emk_…
  ```

API-Tokens vergeben und widerrufen nur Main Admins unter
**Admin → System Einstellungen → API-Tokens**. Ein Token kann auf eine FIR
beschränkt sein, ein Ablaufdatum haben und optional **Entwürfe einschließen**. Es wird nur einmal beim Anlegen
angezeigt; gespeichert ist nur sein SHA-256-Hash.

- Tokens werden **nur im Header** angenommen, nie als URL-Parameter.
- Ist ein `Authorization`-Header gesetzt, zählt nur das Token – auch wenn
  zusätzlich eine Session besteht.
- Pro Token bzw. Nutzer sind 120 Anfragen pro Minute erlaubt (danach `429`).
- Antworten werden nicht zwischengespeichert (`Cache-Control: no-store`).

## Endpunkte

### `GET /api/v1/firs/{code}/events`

Alle Events einer FIR, nach Beginn sortiert, höchstens 500.

Entwürfe (`status: "DRAFT"`) sind nur enthalten für
- Tokens mit „Entwürfe einschließen“ (und passender FIR),
- angemeldete Nutzer, die für die FIR zuständig sind: Main Admin,
  VATGER-Eventleitung, FIR-Leitung/-Team der FIR oder `event.create` /
  `event.edit` in der FIR.

`includesDrafts` in der Antwort sagt, ob Entwürfe mitgeliefert wurden.

Optionale Filter (ISO-8601): `from` – Events, die danach enden; `to` –
Events, die davor beginnen.

```json
{
  "fir": { "code": "EDMM", "name": "München" },
  "includesDrafts": false,
  "events": [
    {
      "id": 12,
      "name": "Munich Overload",
      "description": "…",
      "status": "ROSTER_PUBLISHED",
      "startTime": "2026-12-05T17:00:00.000Z",
      "endTime": "2026-12-05T21:00:00.000Z",
      "signupDeadline": "2026-12-01T00:00:00.000Z",
      "airports": ["EDDM"],
      "stations": ["EDDM_TWR", "EDDM_GND"],
      "signupCount": 23,
      "rosterPublished": true,
      "url": "https://…/events/12",
      "rosterApiUrl": "https://…/api/v1/events/12/roster"
    }
  ]
}
```

### `GET /api/v1/events/{id}/roster`

Der komplette Besetzungsplan: Stationen in der Reihenfolge des Editors und
alle Schichten mit Station, Lotse (CID, Name) und Zeiten, dazu Custom-Blöcke
(`type: "custom"`, ohne CID) und persönliche Blöcke wie „Mentor"
(`type: "personal"`, ohne Station).

Ausgeliefert wird die **veröffentlichte** Fassung. Ist noch nichts
veröffentlicht, ist `published` `false` und `shifts` leer.
`?version=live` liefert den Arbeitsstand – nur mit Session und Zugriff auf
den Plan im Editor, nie mit einem Token.

Für Entwürfe gelten dieselben Rechte wie in der Eventliste; ohne sie
antwortet der Endpunkt mit `404`.

Nie enthalten: interne Notizen, Markierungen, Bemerkungen und
Nichtverfügbarkeiten der Lotsen.

```json
{
  "event": { "id": 12, "name": "Munich Overload", "firCode": "EDMM", "status": "ROSTER_PUBLISHED",
             "startTime": "…", "endTime": "…" },
  "version": "published",
  "published": true,
  "publishedAt": "2026-12-03T18:00:00.000Z",
  "briefing": "…",
  "slotMinutes": 30,
  "stations": [{ "callsign": "EDDM_TWR", "order": 0 }],
  "shifts": [
    { "station": "EDDM_TWR", "type": "controller", "cid": 1234567, "name": "Anna Lotse",
      "label": null, "start": "2026-12-05T17:00:00.000Z", "end": "2026-12-05T19:00:00.000Z" }
  ]
}
```

## Fehler

| Status | Bedeutung |
|---|---|
| 400 | Ungültige Parameter (FIR-Code, ID, Datum, `version`) |
| 401 | Keine Session und kein gültiges Token (unbekannt, widerrufen oder abgelaufen) |
| 403 | Token gilt nicht für diese FIR; Live-Fassung ohne Berechtigung |
| 404 | FIR/Event nicht gefunden – auch Entwürfe ohne Berechtigung und Events außerhalb der FIR eines Tokens |
| 429 | Zu viele Anfragen, nach `Retry-After` Sekunden erneut versuchen |
