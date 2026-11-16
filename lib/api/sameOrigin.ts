/**
 * Kommt eine verändernde Anfrage von dieser Seite?
 *
 * Für die eingebettete ATCISS-Ansicht können die Session-Cookies auch
 * seitenübergreifend gesendet werden (EMBED_CROSS_SITE_COOKIES). Damit eine
 * fremde Seite nicht im Namen eines angemeldeten Admins schreiben kann,
 * müssen schreibende Admin-Anfragen JSON sein und – sofern der Browser einen
 * Origin mitschickt – von diesem Host stammen.
 */
export function isSameOriginJsonRequest(req: Request): boolean {
  const type = req.headers.get("content-type") ?? "";
  if (req.method !== "DELETE" && !type.toLowerCase().startsWith("application/json")) return false;
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return !!host && new URL(origin).host === host;
  } catch {
    return false;
  }
}
