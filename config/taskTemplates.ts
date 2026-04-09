/**
 * Task template definitions for default event tasks.
 *
 * Default deadlines:
 *  - CREATE_BANNER:     35 days before event start (5 days before clearing)
 *  - CREATE_TEXT:       35 days before event start (5 days before clearing)
 *  - SUBMIT_CLEARING:   30 days before event start
 *  - REGISTER_MYVATSIM:  7 days before event start
 *
 * FIR-specific overrides can be added in FIR_TASK_TEMPLATES below.
 * Each FIR entry is a complete list of templates that replaces the default list.
 * If a FIR has no entry here, DEFAULT_TASK_TEMPLATES are used.
 */

export interface TaskTemplate {
  type: "CREATE_BANNER" | "CREATE_TEXT" | "SUBMIT_CLEARING" | "REGISTER_MYVATSIM" | "CUSTOM";
  title: string;
  description: string;
  /** Days before event start for the deadline (positive number). */
  deadlineDaysBefore: number;
}

/** Default templates applied to all FIRs unless overridden below. */
export const DEFAULT_TASK_TEMPLATES: TaskTemplate[] = [
  {
    type: "CREATE_BANNER",
    title: "Banner erstellen",
    description:
      "Erstelle einen Banner für das Event. Nach Fertigstellung kann die Banner-URL hinterlegt werden. Der Banner darf erst veröffentlicht werden, nachdem er im Clearing approved wurde.",
    deadlineDaysBefore: 33,
  },
  {
    type: "CREATE_TEXT",
    title: "Bewerbungstext erstellen",
    description:
      "Schreibe einen Bewerbungstext für das Event. Der Text wird im internen Forum gepostet und ist anschließend fürs Clearing erforderlich.",
    deadlineDaysBefore: 33,
  },
  {
    type: "SUBMIT_CLEARING",
    title: "Clearingstelle einreichen",
    description:
      "Reiche das Event mit fertigem Banner und Text in der Clearingstelle (Forum) ein. Erst nach Freigabe darf das Event öffentlich beworben werden.",
    deadlineDaysBefore: 30,
  },
  {
    type: "REGISTER_MYVATSIM",
    title: "In myVATSIM eintragen",
    description:
      "Trage das Event im myVATSIM Admin Panel ein, damit es öffentlich sichtbar wird. Nach dem Eintragen muss myVATSIM das Event noch genehmigen.",
    deadlineDaysBefore: 8,
  },
  {
    type: "CUSTOM",
    title: "Controller Briefing",
    description:
      "Erstelle ein Controller Briefing mit allen wichtigen Informationen für die Controller, z.B. besondere Ereignisse, erwartete Verkehrslage, Slotbelegung, etc.",
    deadlineDaysBefore: 2,
  },
];

/**
 * Per-FIR task template overrides.
 *
 * Add an entry keyed by FIR code (e.g. "EDGG", "EDWW") to customise which
 * standard tasks are created for events in that FIR.  The list completely
 * replaces DEFAULT_TASK_TEMPLATES for that FIR — include every task you want.
 *
 * Example (uncomment and adapt):
 *
 * "EDGG": [
 *   {
 *     type: "CREATE_BANNER",
 *     title: "Banner erstellen",
 *     description: "FIR-spezifische Beschreibung …",
 *     deadlineDaysBefore: 40,
 *   },
 *   // …weitere Aufgaben
 * ],
 */
export const FIR_TASK_TEMPLATES: Record<string, TaskTemplate[]> = {
  // Add FIR-specific overrides here, e.g.:
  // "EDGG": [ ... ],
  // "EDWW": [ ... ],
};

/**
 * Returns the task templates to use for a given FIR code.
 * Falls back to DEFAULT_TASK_TEMPLATES if no FIR-specific override is defined.
 */
export function getTaskTemplatesForFir(firCode: string | null | undefined): TaskTemplate[] {
  if (firCode && FIR_TASK_TEMPLATES[firCode]) {
    return FIR_TASK_TEMPLATES[firCode];
  }
  return DEFAULT_TASK_TEMPLATES;
}

/**
 * Calculate task deadline from event start time.
 */
export function calculateDeadline(
  eventStartTime: Date,
  daysBefore: number,
): Date {
  const deadline = new Date(eventStartTime);
  deadline.setDate(deadline.getDate() - daysBefore);
  // Set to 23:59 UTC on that day
  deadline.setUTCHours(23, 59, 59, 999);
  return deadline;
}
