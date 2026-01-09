/**
 * Discord Bot Configuration
 * 
 * Diese Datei enthält die Konfiguration für den Discord Bot.
 * Hier können Discord Channel IDs, Role IDs und andere Bot-spezifische
 * Einstellungen für Weekly Events konfiguriert werden.
 */

export interface DiscordBotConfig {
  // Standard-Einstellungen
  defaultCheckDaysAhead: number; // Wie viele Tage vor dem Event soll geprüft werden?
  defaultChannelId?: string; // Standard Discord Channel für Benachrichtigungen
  
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
  
  // Optional: Standard-Channel für alle Events
  // defaultChannelId: "1200342520731807786",
  
  // Event-spezifische Konfiguration
  events: {
    // Beispiel: München Mittwoch
    "München Mittwoch": {
      channelId: "1200342520731807786", // Dein Discord Channel
      roleId: "1416563224286990429", // Role für @mentions
      checkDaysAhead: 14,
      requiredStaffing: {
        "EDDM_._TWR": 2,
        "EDDM_._GND": 2,
        "EDDM_[AB]_APP": 1,
        "EDUU_.+_CTR": 1,
      },
    },
    
    // Beispiel: Frankfurt Friday
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
