/**
 * Helper functions for determining effective signup status for weekly event occurrences
 */

export interface SignupStatusResult {
  isOpen: boolean;
  reason: "manually_opened" | "manually_closed" | "open" | "not_yet_open" | "deadline_passed" | "no_roster";
  opensAt?: Date;
}

/**
 * Calculate the effective signup status for a weekly event occurrence
 * 
 * @param occurrence - The occurrence with date, signupDeadline, and signupStatus
 * @param config - The weekly event configuration
 * @returns SignupStatusResult with isOpen status and reason
 */
export function getEffectiveSignupStatus(
  occurrence: {
    date: Date;
    signupDeadline: Date | null;
    signupStatus: string;
  },
  config: {
    requiresRoster: boolean;
  }
): SignupStatusResult {
  // Manual override takes priority
  if (occurrence.signupStatus === "open") {
    return { isOpen: true, reason: "manually_opened" };
  }
  
  if (occurrence.signupStatus === "closed") {
    return { isOpen: false, reason: "manually_closed" };
  }
  
  // Auto mode - calculate based on rules
  const now = new Date();
  
  // Not open if roster is not required
  if (!config.requiresRoster) {
    return { isOpen: false, reason: "no_roster" };
  }
  
  // Check if signup deadline has passed
  if (occurrence.signupDeadline && now >= occurrence.signupDeadline) {
    return { isOpen: false, reason: "deadline_passed" };
  }
  
  // Calculate when signups should open (2 weeks before)
  const twoWeeksBefore = new Date(occurrence.date);
  twoWeeksBefore.setDate(twoWeeksBefore.getDate() - 14);
  
  // Check if we're within the 2-week window
  if (now < twoWeeksBefore) {
    return { 
      isOpen: false, 
      reason: "not_yet_open",
      opensAt: twoWeeksBefore 
    };
  }
  
  // All conditions met - signups are open
  return { isOpen: true, reason: "open" };
}

/**
 * Get a human-readable description of the signup status
 */
export function getSignupStatusDescription(result: SignupStatusResult, locale: string = "de"): string {
  if (locale === "de") {
    switch (result.reason) {
      case "manually_opened":
        return "Manuell geöffnet";
      case "manually_closed":
        return "Manuell geschlossen";
      case "open":
        return "Offen";
      case "not_yet_open":
        if (result.opensAt) {
          return `Öffnet am ${result.opensAt.toLocaleDateString("de-DE")}`;
        }
        return "Noch nicht geöffnet";
      case "deadline_passed":
        return "Anmeldeschluss überschritten";
      case "no_roster":
        return "Kein Roster vorgesehen";
    }
  }
  
  // English fallback
  switch (result.reason) {
    case "manually_opened":
      return "Manually opened";
    case "manually_closed":
      return "Manually closed";
    case "open":
      return "Open";
    case "not_yet_open":
      if (result.opensAt) {
        return `Opens on ${result.opensAt.toLocaleDateString("en-US")}`;
      }
      return "Not yet open";
    case "deadline_passed":
      return "Deadline passed";
    case "no_roster":
      return "No roster planned";
  }
}
