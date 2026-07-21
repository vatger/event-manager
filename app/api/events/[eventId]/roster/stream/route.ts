import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/getSessionUser";
import { canViewEventRoster } from "@/lib/roster/eventRosterService";
import { subscribeRosterChanges } from "@/lib/roster/rosterEvents";

export const dynamic = "force-dynamic";

/**
 * SSE-Stream: benachrichtigt Clients über Roster-Änderungen anderer Nutzer.
 * Events: `change` mit { sourceClientId, ts } – Clients laden daraufhin neu.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { eventId: idParam } = await params;
  const eventId = Number(idParam);
  if (isNaN(eventId)) return new Response("Invalid event id", { status: 400 });

  const cid = Number(user.cid);
  if (!(await canViewEventRoster(cid, eventId))) {
    return new Response("Forbidden", { status: 403 });
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          // Stream bereits geschlossen
        }
      };

      send(`retry: 3000\n\n`);

      unsubscribe = subscribeRosterChanges(eventId, (event) => {
        send(
          `event: change\ndata: ${JSON.stringify({
            sourceClientId: event.sourceClientId,
            ts: event.ts,
          })}\n\n`
        );
      });

      // Heartbeat hält Proxies/Verbindungen offen
      heartbeat = setInterval(() => send(`: ping\n\n`), 25000);

      req.signal.addEventListener("abort", () => {
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe?.();
        try {
          controller.close();
        } catch {
          // bereits geschlossen
        }
      });
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
