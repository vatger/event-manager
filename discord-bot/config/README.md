# Discord Bot Konfiguration

## Übersicht

Die Discord Bot Konfiguration erfolgt über die Datei `weeklyEvents.config.ts`.
Hier werden Discord Channel IDs, Role IDs, Staffing-Anforderungen und **Embed-Designs** für die Weekly Events konfiguriert.

## Bot starten

Der Discord Bot muss separat vom Next.js Server gestartet werden:

```bash
# Terminal 1: Next.js Server
npm run dev

# Terminal 2: Discord Bot
npm run discord-bot
```

**Wichtig:** Der Bot benötigt die `.env`-Datei mit `DISCORD_BOT_TOKEN`.

## Konfigurationsdatei

**Pfad:** `discord-bot/config/weeklyEvents.config.ts`

### Struktur

```typescript
export const discordBotConfig = {
  // Standard-Einstellungen
  defaultCheckDaysAhead: 14, // Wie viele Tage vor dem Event prüfen?
  defaultChannelId: "...",    // Optional: Standard-Channel für alle Events
  
  // Standard-Embeds für alle Events
  embeds: {
    myVatsimMissing: {
      color: 0xff0000,
      title: "❌ Event nicht in myVATSIM eingetragen",
      description: "**{eventName}** ist noch nicht für den {date} in myVATSIM eingetragen.",
    },
    staffingInsufficient: {
      color: 0xff9900,
      title: "⚠️ Mindestbesetzung nicht erreicht",
      description: "**{eventName}** – {date}",
    },
  },
  
  // Event-spezifische Konfiguration
  events: {
    "Event Name": {
      channelId: "...",          // Discord Channel für Benachrichtigungen
      roleId: "...",             // Discord Role für @mentions
      checkDaysAhead: 14,        // Überschreibt defaultCheckDaysAhead
      requiredStaffing: {        // Staffing-Anforderungen
        "REGEX_PATTERN": Anzahl
      },
      embeds: {                  // Optional: Event-spezifische Embeds
        myVatsimMissing: { ... }
      }
    }
  }
}
```

## Embed-Konfiguration

### Verfügbare Embed-Typen

1. **myVatsimMissing** - Wenn Event nicht in myVATSIM eingetragen
2. **staffingInsufficient** - Wenn Mindestbesetzung nicht erreicht
3. **staffingSufficient** - Wenn Besetzung ausreichend (optional)

### Embed-Eigenschaften

```typescript
{
  color: 0xff0000,        // Hex-Farbe (z.B. 0xff0000 = Rot)
  title: "Titel",         // Titel des Embeds (mit Variablen)
  description: "Text",    // Beschreibung (mit Variablen)
  footer: "Footer-Text",  // Optional: Footer
}
```

### Variablen in Embeds

Du kannst folgende Variablen in `title` und `description` verwenden:

- `{eventName}` - Name des Events (z.B. "München Mittwoch")
- `{date}` - Formatiertes Datum (z.B. "15.01.2026")
- `{daysUntil}` - Tage bis zum Event (nur bei myVatsimMissing)

**Beispiel:**
```typescript
title: "🔔 {eventName}: myVATSIM-Eintrag fehlt!"
description: "Der **{eventName}** am {date} ist noch nicht eingetragen (in {daysUntil} Tagen)."
```

### Beispiel-Konfiguration mit Embeds

```typescript
export const discordBotConfig: DiscordBotConfig = {
  defaultCheckDaysAhead: 14,
  
  // Standard-Embeds für alle Events
  embeds: {
    myVatsimMissing: {
      color: 0xff0000,
      title: "❌ Event nicht in myVATSIM eingetragen",
      description: "**{eventName}** ist noch nicht für den {date} in myVATSIM eingetragen.",
    },
    staffingInsufficient: {
      color: 0xff9900,
      title: "⚠️ Mindestbesetzung nicht erreicht",
      description: "**{eventName}** – {date}",
    },
  },
  
  events: {
    // München Mittwoch mit custom Embed
    "München Mittwoch": {
      channelId: "1200342520731807786",
      roleId: "1416563224286990429",
      checkDaysAhead: 14,
      requiredStaffing: {
        "EDDM_._TWR": 2,        // 2x TWR benötigt
        "EDDM_._GND": 2,        // 2x GND benötigt
        "EDDM_[AB]_APP": 1,     // 1x APP (A oder B)
        "EDUU_.+_CTR": 1,       // 1x CTR (beliebig)
      },
      // Event-spezifisches Embed (überschreibt Standard)
      embeds: {
        myVatsimMissing: {
          color: 0x0099ff,
          title: "🔔 München Mittwoch: myVATSIM-Eintrag fehlt!",
          description: "Der **München Mittwoch** am {date} ist noch nicht in myVATSIM eingetragen. Bitte baldmöglichst nachtragen!",
          footer: "EDMM Event Team",
        },
      },
    },
    
    // Frankfurt Friday mit Standard-Embeds
    "Frankfurt Friday": {
      channelId: "1200342520731807786",
      roleId: "1416563224286990429",
      checkDaysAhead: 14,
      requiredStaffing: {
        "ED(?:GG_[GRHDB]|UU_[FSW]).._CTR": 2,
        "EDDF_._APP": 2,
        "EDDF_._TWR": 2,
        "EDDF_._GND": 2,
        "EDDF_DEL": 1,
      },
    },
  },
};
```

## Discord Channel und Role IDs finden

1. Aktiviere den Discord Developer Mode (Einstellungen → Erweitert → Developer Mode)
2. Rechtsklick auf einen Channel → "ID kopieren"
3. Rechtsklick auf eine Rolle → "ID kopieren"

## Staffing-Anforderungen (Regex)

Die Staffing-Anforderungen verwenden Regex-Muster für Callsigns:

### Einfache Muster
- `EDDM_TWR` - Genau dieser Callsign
- `EDDM_._TWR` - Beliebiges Zeichen zwischen EDDM_ und _TWR (z.B. EDDM_A_TWR, EDDM_B_TWR)
- `EDDM_[AB]_TWR` - Nur A oder B (EDDM_A_TWR oder EDDM_B_TWR)

### Erweiterte Muster
- `EDUU_.+_CTR` - Beliebige Zeichen zwischen EDUU_ und _CTR (z.B. EDUU_W_CTR, EDUU_FSW_CTR)
- `ED(?:GG|UU)_._CTR` - EDGG oder EDUU, dann beliebiges Zeichen, dann _CTR

### Anzahl
Die Zahl gibt an, wie viele Controller mit diesem Muster benötigt werden.

## Workflow

### 1. Weekly Event im Event Manager erstellen
- Gehe zu `/admin/edmm/weeklys`
- Erstelle ein neues Weekly Event (Name, Wochentag, Rhythmus)
- Das System generiert automatisch die Termine

### 2. Discord Bot konfigurieren
- Öffne `discord-bot/config/weeklyEvents.config.ts`
- Füge einen Eintrag für das Event hinzu (verwende exakt denselben Namen!)
- Konfiguriere Channel ID, Role ID und Staffing

### 3. Bot startet automatisch
- MyVATSIM Check: Täglich 9:00 Uhr
- Staffing Check: Täglich 10:00 Uhr

## Hilfsfunktionen

Die Konfigurationsdatei bietet Hilfsfunktionen:

```typescript
import { 
  getCheckDaysAhead,
  getDiscordChannelId,
  getDiscordRoleId,
  getRequiredStaffing 
} from "@/discord-bot/config/weeklyEvents.config";

// Verwende in Discord Bot Jobs
const channelId = getDiscordChannelId("München Mittwoch");
const roleId = getDiscordRoleId("München Mittwoch");
const staffing = getRequiredStaffing("München Mittwoch");
```

## Fehlerbehandlung

### Event nicht konfiguriert
Wenn ein Weekly Event im Event Manager existiert, aber nicht in der Config-Datei, werden keine Discord-Benachrichtigungen versendet.

### Ungültige Channel/Role ID
Der Bot loggt einen Fehler und überspringt die Benachrichtigung.

### Regex-Fehler
Bei ungültigen Regex-Mustern wirft der Bot einen Fehler. Teste Regex-Muster vorher!

## Best Practices

1. **Konsistente Namen**: Verwende exakt dieselben Namen in Event Manager und Config
2. **Teste zuerst**: Teste neue Events mit dem Test-Script
3. **Kommentare**: Füge Kommentare zu komplexen Regex-Mustern hinzu
4. **Versionskontrolle**: Committed die Config-Datei ins Git-Repository
5. **Backup**: Mache Backups vor größeren Änderungen
