/**
 * Absolute Links für API-Antworten – nur aus der Konfiguration, nie aus dem
 * Host-Header der Anfrage (der ließe sich von außen fälschen). Ohne
 * Konfiguration bleibt der Pfad relativ.
 */
export function publicUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "").replace(/\/+$/, "");
  return `${base}${path}`;
}
