/**
 * Discord Bot Configuration
 * 
 * Diese Datei enthält die Konfiguration für den Discord Bot.
 * Hier können Discord Channel IDs, Role IDs und andere Bot-spezifische
 * Einstellungen für Weekly Events konfiguriert werden.
 */

export interface EmbedConfig {
  color?: number; // Hex-Farbe (z.B. 0xff0000 für Rot)
  title?: string; // Titel des Embeds (Variablen: {eventName}, {date}, {daysUntil})
  description?: string; // Beschreibung (Variablen: {eventName}, {date}, {daysUntil})
  footer?: string; // Footer-Text
}

export interface CPTEmbedConfig {
  color?: number;
  title?: string; // Variablen: {examiner}, {trainee}, {position}, {time}, {date}, {daysUntil}
  description?: string;
  footer?: string;
}

export interface DiscordBotConfig {
  // Standard-Einstellungen
  defaultCheckDaysAhead: number; // Wie viele Tage vor dem Event soll geprüft werden?
  defaultChannelId?: string; // Standard Discord Channel für Benachrichtigungen
  
  // Konfiguration für irregular events (aus Event Manager)
  defaultIrregularEventConfig?: {
    channelId: string; // Discord Channel für Event Manager Events
    roleId?: string; // Optional: Discord Role für Pings
  };
  
  // Embed-Konfiguration
  embeds?: {
    myVatsimMissing?: EmbedConfig; // Embed für fehlende myVATSIM-Einträge
    staffingInsufficient?: EmbedConfig; // Embed für unzureichende Besetzung
    staffingSufficient?: EmbedConfig; // Embed für ausreichende Besetzung (optional)
  };
  
  // CPT Benachrichtigungen (NEU!)
  cptNotifications?: {
    channelId: string; // Discord Channel für CPT-Benachrichtigungen
    roleId?: string; // Discord Role für Pings bei CPTs heute
    
    // Position-Filter (Regex-Muster)
    // Nur CPTs für diese Positionen werden gemeldet
    // Beispiel: ["EDDM_.*", "EDUU_.*"]
    positionFilters?: string[];
    
    // Vorwarnung (Info-Ping X Tage vorher)
    advanceWarning?: {
      enabled: boolean;
      daysAhead: number; // Standard: 3 Tage vorher
      roleId?: string; // Optional: andere Role für Vorwarnung
    };
    
    // Embed-Konfiguration für CPTs
    embeds?: {
      today?: CPTEmbedConfig; // CPT ist heute
      upcoming?: CPTEmbedConfig; // CPT in X Tagen (Vorwarnung)
    };
  };
  
  // Event-spezifische Konfiguration
  events: {
    [eventName: string]: {
      // Discord Einstellungen
      channelId?: string; // Discord Channel für dieses Event
      roleId?: string; // Discord Role für Pings
      
      // myVATSIM Check Einstellungen
      checkDaysAhead?: number; // Überschreibt defaultCheckDaysAhead
      
      // Staffing-Anforderungen
      // Regex-Muster als Schlüssel, benötigte Anzahl als Wert
      // Beispiel: { "EDDM_._TWR": 2, "EDDM_._GND": 2 }
      requiredStaffing?: Record<string, number>;
      
      // Event-spezifische Embed-Überschreibungen
      embeds?: {
        myVatsimMissing?: EmbedConfig;
        staffingInsufficient?: EmbedConfig;
        staffingSufficient?: EmbedConfig;
      };
    };
  };
}

/**
 * Discord Bot Konfiguration
 * 
 * Passe diese Konfiguration für deine Weekly Events an.
 */
export const discordBotConfig: DiscordBotConfig = {
  // Standard: 14 Tage vor dem Event prüfen
  defaultCheckDaysAhead: 14,
  defaultChannelId: "1459577819871842354",
  
  // Konfiguration für irregular events (Events aus dem Event Manager)
  defaultIrregularEventConfig: {
    channelId: "1459577819871842354", // EDMM Events Channel
    roleId: "1459578289478959115", // Optional: EDMM Eventleiter Role
  },
  
  // Standard-Embeds für alle Events
  embeds: {
    myVatsimMissing: {
      color: 0xff0000, // Rot
      title: "❌ Event nicht in myVATSIM eingetragen",
      description: "**{eventName}** ist noch nicht für den {date} in myVATSIM eingetragen.",
    },
    staffingInsufficient: {
      color: 0xff9900, // Orange
      title: "⚠️ Mindestbesetzung nicht erreicht",
      description: "**{eventName}** – {date}",
    },
    staffingSufficient: {
      color: 0x00ff00, // Grün
      title: "✅ Staffing ausreichend",
      description: "**{eventName}** – {date}",
    },
  },
  
  // CPT Benachrichtigungen (optional)
  // Kommentiere diesen Block ein und passe ihn an, um CPT-Benachrichtigungen zu aktivieren
  cptNotifications: {
    channelId: "1459577819871842354", // Discord Channel für CPT-Benachrichtigungen
    roleId: "1459566928648736952", // Role für @mentions bei CPTs heute
    
    // Nur CPTs für diese Positionen werden gemeldet (Regex-Muster)
    positionFilters: [
      "EDDM_.*", // Alle München Positionen
      "EDDN_.*", // Alle Nürnberg Positionen
      "EDDP_.*", // Alle Leipzig Positionen
      "EDMM_.*", // Alle München Radar Positionen
    ],
    
    // Vorwarnung 2 Tage vorher
    advanceWarning: {
      enabled: true,
      daysAhead: 2,
      roleId: "1459566928648736952", // Optional: andere Role für Vorwarnung
    },
    
    // Embeds für CPT-Benachrichtigungen
    embeds: {
      today: {
        color: 0xff0000, // Rot für heute
        title: "{trainee} CPT - Heute!",
        description: "**{trainee}** hat heute um {time} Uhr sein CPT auf **{position}**.",
      },
      upcoming: {
        color: 0x0099ff, // Blau für Vorwarnung
        title: "CPT in {daysUntil} Tagen",
        description: "**{trainee}** hat am {date} um {time} Uhr sein CPT auf **{position}**.",
      },
    },
  },
  
  // Event-spezifische Konfiguration
  events: {
    // Beispiel: München Mittwoch
    "EDDM - München Mittwoch": {
      channelId: "1459577819871842354", // Dein Discord Channel
      roleId: "1459567190897594562", // Role für @mentions //1459567190897594562
      checkDaysAhead: 14,
      requiredStaffing: {
        "EDDM_DEL": 1,
        "EDDM_._TWR": 2,
        "EDDM_[123]_GND": 2,
        "EDDM_[NS]_GND": 1,
        "EDDM_._APP": 3,
        "EDMM_.+_CTR": 2,
      },
      // Optional: Überschreibe Standard-Embeds für dieses Event
      // embeds: {
      //   myVatsimMissing: {
      //     color: 0xff0000,
      //     title: "🔔 München Mittwoch: myVATSIM-Eintrag fehlt!",
      //     description: "Der **München Mittwoch** am {date} ist noch nicht in myVATSIM eingetragen.",
      //   },
      // },
    },
    
    // Beispiel: Frankfurt Friday
    "EDDN – Nürnberg Montag": {
      channelId: "1459577819871842354",
      roleId: "1459567321809948672",
      checkDaysAhead: 14,
      requiredStaffing: {
        "EDDN_GND": 1,
        "EDDN_TWR": 1,
        "EDDN_._APP": 1,
        "EDMM_.+_CTR": 1,
      },
    },
    
    // Weitere Events hier hinzufügen...
  },
};

/**
 * Hilfsfunktion: Hole Konfiguration für ein bestimmtes Event
 */
export function getEventConfig(eventName: string) {
  return discordBotConfig.events[eventName] || {};
}

/**
 * Hilfsfunktion: Hole checkDaysAhead für ein Event
 */
export function getCheckDaysAhead(eventName: string): number {
  const eventConfig = getEventConfig(eventName);
  return eventConfig.checkDaysAhead ?? discordBotConfig.defaultCheckDaysAhead;
}

/**
 * Hilfsfunktion: Hole Discord Channel ID für ein Event
 */
export function getDiscordChannelId(eventName: string): string | undefined {
  const eventConfig = getEventConfig(eventName);
  return eventConfig.channelId ?? discordBotConfig.defaultChannelId;
}

/**
 * Hilfsfunktion: Hole Discord Role ID für ein Event
 */
export function getDiscordRoleId(eventName: string): string | undefined {
  const eventConfig = getEventConfig(eventName);
  return eventConfig.roleId;
}

/**
 * Hilfsfunktion: Hole Staffing-Anforderungen für ein Event
 */
export function getRequiredStaffing(eventName: string): Record<string, number> {
  const eventConfig = getEventConfig(eventName);
  return eventConfig.requiredStaffing ?? {};
}

/**
 * Hilfsfunktion: Hole Embed-Konfiguration für ein Event und Typ
 */
export function getEmbedConfig(
  eventName: string,
  embedType: 'myVatsimMissing' | 'staffingInsufficient' | 'staffingSufficient'
): EmbedConfig {
  const eventConfig = getEventConfig(eventName);
  const eventEmbed = eventConfig.embeds?.[embedType];
  const globalEmbed = discordBotConfig.embeds?.[embedType];
  
  // Event-spezifisches Embed überschreibt globales Embed
  return {
    color: eventEmbed?.color ?? globalEmbed?.color,
    title: eventEmbed?.title ?? globalEmbed?.title,
    description: eventEmbed?.description ?? globalEmbed?.description,
    footer: eventEmbed?.footer ?? globalEmbed?.footer,
  };
}

/**
 * Hilfsfunktion: Ersetze Variablen in Embed-Texten
 */
export function replaceEmbedVariables(
  text: string | undefined,
  variables: {
    eventName?: string;
    date?: string;
    daysUntil?: number;
  }
): string {
  if (!text) return '';
  
  return text
    .replace(/{eventName}/g, variables.eventName || '')
    .replace(/{date}/g, variables.date || '')
    .replace(/{daysUntil}/g, variables.daysUntil?.toString() || '');
}

