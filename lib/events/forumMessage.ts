/**
 * Vorbereitete Forum-PN an das Eventteam (board.vatsim-germany.org).
 *
 * Das Forum öffnet unter direct-messages/add eine neue Nachricht; Empfänger
 * (Forennamen = Namen im Eventmanager, kommagetrennt) und Betreff lassen sich
 * über die URL vorbelegen.
 */
export const FORUM_DIRECT_MESSAGE_URL = "https://board.vatsim-germany.org/direct-messages/add";

export function forumMessageUrl(recipients: string[], title: string): string {
  const params = new URLSearchParams();
  const names = [...new Set(recipients.map((n) => n.trim()).filter(Boolean))];
  if (names.length > 0) params.set("to", names.join(", "));
  params.set("title", title);
  return `${FORUM_DIRECT_MESSAGE_URL}?${params.toString()}`;
}

/** Betreff der Abmelde-PN: „Eventname - Name des Lotsen" */
export function withdrawalTitle(eventName: string, controllerName: string): string {
  return `${eventName} - ${controllerName}`;
}
