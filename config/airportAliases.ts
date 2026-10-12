/**
 * Weitere Namen eines Flughafens, wie sie in Freitext-Wünschen vorkommen.
 *
 * ICAO-Code und deutscher Ortsname kommen schon aus dem Callsign bzw. der
 * Datahub-Beschreibung („München Tower"). Hier stehen nur die Namen, die dort
 * nicht auftauchen: IATA-Codes und englische Schreibweisen.
 */
export const AIRPORT_ALIASES: Record<string, string[]> = {
  EDDB: ["BER"],
  EDDC: ["DRS"],
  EDDE: ["ERF"],
  EDDF: ["FRA"],
  EDDG: ["FMO"],
  EDDH: ["HAM"],
  EDDK: ["CGN", "Cologne"],
  EDDL: ["DUS"],
  EDDM: ["MUC", "Munich"],
  EDDN: ["NUE", "Nuremberg"],
  EDDP: ["LEJ"],
  EDDR: ["SCN"],
  EDDS: ["STR"],
  EDDV: ["HAJ", "Hanover"],
  EDDW: ["BRE"],
  EDFH: ["HHN"],
  EDFM: ["MHG"],
  EDHI: ["XFW"],
  EDHL: ["LBC"],
  EDJA: ["FMM"],
  EDLN: ["MGL"],
  EDLP: ["PAD"],
  EDLV: ["NRN"],
  EDLW: ["DTM"],
  EDMA: ["AGB"],
  EDNY: ["FDH"],
  EDSB: ["FKB"],
  EDXW: ["GWT"],
};
