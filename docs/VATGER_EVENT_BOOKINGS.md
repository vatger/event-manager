# VATGER Stationsbuchungen

Der Eventmanager kann die Stationen eines Events auf der VATGER Homepage als
**vatger Event Buchung** blocken. Damit muss niemand mehr die Positionen eines
Events von Hand im Buchungssystem eintragen.

Eine solche Buchung hat auf der Homepage Vorrang: reguläre Buchungen derselben
Station, die im Weg stehen, werden entfernt und die betroffenen Lotsen
benachrichtigt.

## Zwei Wege

| Eventtyp                     | Auslöser                                              | Gebucht wird auf                                       |
| ---------------------------- | ----------------------------------------------------- | ------------------------------------------------------ |
| Weekly mit Roster            | automatisch, sobald das Roster veröffentlicht ist      | die im Roster eingeteilte VATSIM ID je Station          |
| Unregelmäßiges Event         | Knopf "Stationen blocken" in der Eventverwaltung       | die Event-Kennung aus `VATGER_EVENT_BOOKING_CID`        |

Bei Weeklys zieht der Abgleich mit: wird eine Einteilung geändert oder
entfernt, oder das Roster wieder zurückgezogen, werden die Buchungen
entsprechend angepasst bzw. freigegeben. Zusätzlich läuft der Cronjob
`weekly_booking_sync` (Standard alle 30 Minuten) über die veröffentlichten
Roster der nächsten 14 Tage und korrigiert, was zwischendurch auseinander
gelaufen ist – etwa weil die Homepage kurzzeitig nicht erreichbar war.

Bei unregelmäßigen Events steht zum Zeitpunkt des Blockens meist noch keine
Einteilung fest. Geblockt werden deshalb die im Event als **zu besetzen**
eingetragenen Stationen (`staffedStations`), und zwar für die gesamte
Eventdauer auf die konfigurierte Event-Kennung. Sind im Event keine Stationen
hinterlegt, greifen die im Roster bestätigten Stationen.

## Konfiguration

```env
VATGER_BOOKING_API=https://vatsim-germany.org/api/booking/event
VATGER_BOOKING_API_TOKEN=
VATGER_EVENT_BOOKING_CID=
WEEKLY_BOOKING_SYNC_CRON=*/30 * * * *
WEEKLY_BOOKING_SYNC_HORIZON_DAYS=14
```

- `VATGER_BOOKING_API` – der Endpoint der Homepage. Ist er nicht gesetzt,
  werden keine Buchungen versucht: der Knopf wird ausgeblendet, der Cronjob
  beendet sich sofort und alle übrigen Funktionen laufen unverändert weiter.
- `VATGER_BOOKING_API_TOKEN` – ein API-Token der Homepage mit den Route-IDs
  `booking.event.index`, `booking.event.create` und `booking.event.delete`.
  Ohne eigenen Wert wird `VATGER_API_TOKEN` verwendet.
- `VATGER_EVENT_BOOKING_CID` – die VATSIM ID, auf die die Blockbuchungen
  unregelmäßiger Events laufen. Ohne diesen Wert meldet der Knopf, dass keine
  Kennung hinterlegt ist; Weeklys sind davon nicht betroffen.

## Referenzen

Jede Buchung wird auf der Homepage mit einer Referenz gespeichert:

- `eventmanager:event:<eventId>` für unregelmäßige Events
- `eventmanager:weekly:<occurrenceId>` für Weekly-Instanzen

Der Eventmanager arbeitet ausschließlich über diese Referenz. Er sieht damit
immer nur seine eigenen Buchungen, räumt beim Abgleich genau die weg, die
nicht mehr zur Planung passen, und fasst Buchungen anderer nie an.

## Endpunkte im Eventmanager

| Methode  | Pfad                                                              | Wirkung                                  |
| -------- | ----------------------------------------------------------------- | ---------------------------------------- |
| `GET`    | `/api/events/[eventId]/bookings`                                  | aktuelle Buchungen des Events            |
| `POST`   | `/api/events/[eventId]/bookings`                                  | Stationen des Events blocken             |
| `DELETE` | `/api/events/[eventId]/bookings`                                  | Stationen des Events freigeben           |
| `GET`    | `/api/admin/weeklys/[id]/occurrences/[occurrenceId]/bookings`     | aktuelle Buchungen der Weekly-Instanz    |
| `POST`   | `/api/admin/weeklys/[id]/occurrences/[occurrenceId]/bookings`     | Abgleich der Weekly-Instanz anstoßen     |
| `DELETE` | `/api/admin/weeklys/[id]/occurrences/[occurrenceId]/bookings`     | Stationen der Weekly-Instanz freigeben   |

Für Events braucht es `event.edit` oder `roster.publish` auf dem Event, für
Weeklys die üblichen Weekly-Rechte (`userCanManageWeekly`).

## Zeitzonen

Weeklys speichern das Datum als UTC-Mitternacht und die Uhrzeiten als `HH:mm`
in Ortszeit (Europe/Berlin). Für die Buchung wird daraus ein UTC-Zeitpunkt
berechnet – inklusive Sommerzeit und Events über Mitternacht. Unregelmäßige
Events tragen bereits vollständige Zeitstempel und werden unverändert
übernommen.

## Grenzen

- Eine Station, die im gewählten Zeitraum bereits durch eine andere
  Event-Buchung belegt ist, wird als `conflict` gemeldet und **nicht**
  überschrieben.
- Buchungen, die die Homepage nicht mit VATSIM synchronisieren konnte, werden
  dort wieder entfernt und hier als `failed` gemeldet.
- Vergangene Events und Weekly-Instanzen werden nicht mehr angefasst.
