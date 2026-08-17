# VATGER Stationsbuchungen

Der Eventmanager kann die Stationen eines Events auf der VATGER Homepage als
**vatger Event Buchung** blocken. Damit muss niemand mehr die Positionen eines
Events von Hand im Buchungssystem eintragen.

Eine solche Buchung hat auf der Homepage Vorrang: reguläre Buchungen derselben
Station, die im Weg stehen, werden entfernt und die betroffenen Lotsen
benachrichtigt.

## Zwei Wege

| Eventtyp             | Auslöser                                         | Gebucht wird auf                                                       |
| -------------------- | ------------------------------------------------ | ---------------------------------------------------------------------- |
| Weekly               | automatisch, weit im Voraus                      | die Event-Kennung, nach Roster-Veröffentlichung die eingeteilten Lotsen |
| Unregelmäßiges Event | Knopf "Stationen blocken" in der Eventverwaltung  | die Event-Kennung aus `VATGER_EVENT_BOOKING_CID`                       |

### Weeklys

Geblockt wird, sobald ein Termin im Zeitfenster des Cronjobs liegt – also
lange bevor überhaupt ein Roster existiert. Bis dahin laufen die Buchungen auf
die Event-Kennung, damit die Stationen niemand anders wegbucht.

Sobald das Roster veröffentlicht ist, wandert jede eingeteilte Station auf die
VATSIM ID des eingeteilten Lotsen. Stationen, für die noch niemand eingeteilt
ist, bleiben auf der Event-Kennung geblockt. Änderungen an der Einteilung und
das Zurückziehen des Rosters ziehen sofort nach.

Der Cronjob `weekly_booking_sync` (Standard stündlich) läuft über alle Termine
aktiver Weeklys der nächsten 60 Tage. Er blockt neu dazugekommene Termine und
korrigiert, was zwischendurch auseinander gelaufen ist – etwa weil die
Homepage kurzzeitig nicht erreichbar war oder eine Buchung von Hand entfernt
wurde. Termine deaktivierter Weeklys werden freigegeben.

### Unregelmäßige Events

Hier steht zum Zeitpunkt des Blockens meist noch keine Einteilung fest.
Geblockt werden deshalb die im Event als **zu besetzen** eingetragenen
Stationen (`staffedStations`), und zwar für die gesamte Eventdauer auf die
konfigurierte Event-Kennung. Sind im Event keine Stationen hinterlegt, greifen
die im Roster bestätigten Stationen.

## Konfiguration

```env
VATGER_BOOKING_API=https://vatsim-germany.org/api/booking/event
VATGER_BOOKING_API_TOKEN=
VATGER_EVENT_BOOKING_CID=
WEEKLY_BOOKING_SYNC_CRON=0 * * * *
WEEKLY_BOOKING_SYNC_HORIZON_DAYS=60
```

- `VATGER_BOOKING_API` – der Endpoint der Homepage. Ist er nicht gesetzt,
  werden keine Buchungen versucht: der Knopf wird ausgeblendet, der Cronjob
  beendet sich sofort und alle übrigen Funktionen laufen unverändert weiter.
- `VATGER_BOOKING_API_TOKEN` – ein API-Token der Homepage mit den Route-IDs
  `booking.event.index`, `booking.event.create` und `booking.event.delete`.
  Ohne eigenen Wert wird `VATGER_API_TOKEN` verwendet.
- `VATGER_EVENT_BOOKING_CID` – die VATSIM ID, auf die alle Blockbuchungen
  laufen, solange keine Einteilung feststeht. Ohne diesen Wert lassen sich nur
  bereits eingeteilte Stationen veröffentlichter Weekly-Roster buchen; alles
  andere wird übersprungen und im Ergebnis gemeldet.
- `WEEKLY_BOOKING_SYNC_HORIZON_DAYS` – wie weit im Voraus geblockt wird. Die
  Voreinstellung von 60 Tagen entspricht dem Zeitraum, in dem sich Stationen
  auf der Homepage auch von Hand buchen lassen.

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

## Löschen und Absagen

Buchungen auf der Homepage überleben das Event im Eventmanager – sie
verschwinden nicht von selbst, wenn ein Event gelöscht oder abgesagt wird.
Deshalb fragt in diesen Fällen ein Dialog nach, ob die zugehörigen Stationen
mit zurückgezogen werden sollen (Voreinstellung: ja):

- Event löschen (Übersicht und Bearbeitungsmaske)
- Event auf **Abgesagt** setzen
- Weekly Event löschen
- Einzelnen Weekly-Termin löschen

Technisch hängt die Entscheidung als `?releaseBookings=true` an der
`DELETE`-Anfrage bzw. als `releaseBookings: true` am Update. Beim Löschen
läuft die Freigabe **vor** dem Löschen: mit dem Datensatz verschwindet die
Referenz, über die die Buchungen wiedergefunden werden. Schlägt sie fehl, wird
nicht gelöscht – sonst bliebe eine verwaiste Buchung zurück, die niemand mehr
zuordnen kann.

## Grenzen

- Eine Station, die im gewählten Zeitraum bereits durch eine andere
  Event-Buchung belegt ist, wird als `conflict` gemeldet und **nicht**
  überschrieben.
- Buchungen, die die Homepage nicht mit VATSIM synchronisieren konnte, werden
  dort wieder entfernt und hier als `failed` gemeldet.
- Vergangene Events und Weekly-Instanzen werden nicht mehr angefasst.
