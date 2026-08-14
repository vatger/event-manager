import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/getSessionUser";
import { canEditEventRoster, canViewEventRoster } from "@/lib/roster/eventRosterService";
import {
  getRosterPresence,
  joinRosterPresence,
  subscribeRosterEvents,
} from "@/lib/roster/rosterEvents";

export const dynamic = "force-dynamic";

/**
 * SSE-Stream: benachrichtigt Clients über Roster-Änderungen anderer Nutzer und
 * darüber, wer den Plan gerade offen hat.
 *
 * Events:
 *  - `change`   { sourceClientId, ts } – Clients laden daraufhin neu
 *  - `presence` { users }              – wer gerade mit am Plan sitzt
 *
 * Die offene Verbindung ist zugleich die Anwesenheit: Sie endet, sobald der
 * Editor geschlossen wird oder der Browser wegbricht.
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
  const canEdit = await canEditEventRoster(cid, eventId);
  const presenceUser = { cid, name: user.name ?? `CID ${cid}`, canEdit };

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let leavePresence: (() => void) | null = null;
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

      unsubscribe = subscribeRosterEvents(eventId, (event) => {
        if (event.kind === "change") {
          send(
            `event: change\ndata: ${JSON.stringify({
              sourceClientId: event.sourceClientId,
              ts: event.ts,
            })}\n\n`
          );
        } else {
          send(`event: presence\ndata: ${JSON.stringify({ users: event.users })}\n\n`);
        }
      });

      // Anwesenheit anmelden (löst zugleich das Presence-Event für alle aus)
      // und diesem Client den aktuellen Stand direkt mitgeben.
      leavePresence = joinRosterPresence(eventId, presenceUser);
      send(
        `event: presence\ndata: ${JSON.stringify({ users: getRosterPresence(eventId) })}\n\n`
      );

      // Heartbeat hält Proxies/Verbindungen offen
      heartbeat = setInterval(() => send(`: ping\n\n`), 25000);

      req.signal.addEventListener("abort", () => {
        if (heartbeat) clearInterval(heartbeat);
        leavePresence?.();
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
      leavePresence?.();
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
