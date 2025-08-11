type Rating = "S1" | "S2" | "S3" | "C1" | "C2" | "C3" | "I1" | "I2" | "SUP" | "ADM";
type Position = "DEL" | "GND" | "TWR" | "APP" | "CTR";

interface User {
  rating: Rating;
  endorsements: Array<{
    code: string;         // z.B. "EDDN_TWR", "EDDP_APP_SOLO"
    type?: "solo" | "endorsement" | "waiver";
    validUntil?: string;  // ISO; optional
  }>;
}

interface PositionRule {
  minRating?: Rating;
  endorsements?: string[]; // Liste von Codes, die die Position freischalten
}

interface AirportRule {
  tier: "T1" | "UNR" | "T2";
  positions: Partial<Record<Position, PositionRule>>;
}

interface Config {
  defaults: {
    minRatingByPosition: Record<Position, Rating>;
    endorsementPolicyByTier: Record<AirportRule["tier"], "required" | "bypassIfPresent">;
    endorsementLogic: "any" | "all";
  };
  airports: Record<string, AirportRule>;
}

const ratingOrder: Rating[] = ["S1","S2","S3","C1","C2","C3","I1","I2","SUP","ADM"];
const ratingRank = (r: Rating) => ratingOrder.indexOf(r);

const isEndorsementValid = (uEndo: User["endorsements"][number]) => {
  if (!uEndo.validUntil) return true;
  return new Date(uEndo.validUntil).getTime() >= Date.now();
};

const userHasPositionEndorsement = (
  user: User,
  needed: string[] | undefined,
  logic: "any" | "all"
) => {
  if (!needed || needed.length === 0) return false;
  const owned = new Set(
    user.endorsements.filter(isEndorsementValid).map(e => e.code)
  );
  if (logic === "all") return needed.every(code => owned.has(code));
  return needed.some(code => owned.has(code));
};

export function canUserStaff(
  icao: string,
  position: Position,
  user: User
): { eligible: boolean; reasons: string[]; missing?: { rating?: Rating; endorsements?: string[] } } {
  const cfg: Config = require('./airport_rules.json');
  const airport = cfg.airports[icao];
  const reasons: string[] = [];
  const missing: { rating?: Rating; endorsements?: string[] } = {};
  if (!airport) return { eligible: false, reasons: [`Keine Regeln für ${icao} vorhanden.`] };

  const posRule = airport.positions[position] || {};
  const minRating = posRule.minRating ?? cfg.defaults.minRatingByPosition[position];
  const policy = cfg.defaults.endorsementPolicyByTier[airport.tier] ?? "bypassIfPresent";

  const hasEndo = userHasPositionEndorsement(user, posRule.endorsements, cfg.defaults.endorsementLogic);

  // 1) Endorsement-/Solo-Regel
  if (hasEndo) {
    return { eligible: true, reasons: [`Gültiges Endorsement/Solo für ${icao}_${position}.`] };
  }

  // 2) Policy "required" verlangt Endorsement/Solo
  if (policy === "required") {
    missing.endorsements = posRule.endorsements ?? [];
    reasons.push(`Endorsement/Solo erforderlich für ${icao}_${position}.`);
    return { eligible: false, reasons, missing };
  }

  // 3) Policy "bypassIfPresent": ohne Endorsement greift Rating-Check
  if (ratingRank(user.rating) < ratingRank(minRating)) {
    missing.rating = minRating;
    reasons.push(`Rating zu niedrig: benötigt ${minRating}, hat ${user.rating}.`);
    return { eligible: false, reasons, missing };
  }

  return { eligible: true, reasons: [`Rating ${user.rating} erfüllt die Anforderung ${minRating}.`] };
}
