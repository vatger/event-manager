/**
 * In-Memory Event-Bus für Roster-Änderungen (Realtime-Sync über SSE).
 *
 * Jede erfolgreiche Mutation am Roster ruft broadcastRosterChange() auf;
 * offene SSE-Streams (subscribeRosterChanges) leiten das an die Clients
 * weiter, die daraufhin neu laden. Die sourceClientId erlaubt es Clients,
 * ihre eigenen Änderungen zu ignorieren.
 *
 * Der Bus wird auf globalThis abgelegt, damit er Next.js-HMR und mehrfach
 * evaluierte Module übersteht (eine Server-Instanz vorausgesetzt).
 */

export interface RosterChangeEvent {
  eventId: number;
  sourceClientId: string | null;
  ts: number;
}

type Listener = (event: RosterChangeEvent) => void;

interface RosterEventBus {
  listeners: Map<number, Set<Listener>>;
}

const globalForBus = globalThis as unknown as { __rosterEventBus?: RosterEventBus };

function getBus(): RosterEventBus {
  if (!globalForBus.__rosterEventBus) {
    globalForBus.__rosterEventBus = { listeners: new Map() };
  }
  return globalForBus.__rosterEventBus;
}

export function subscribeRosterChanges(eventId: number, listener: Listener): () => void {
  const bus = getBus();
  let set = bus.listeners.get(eventId);
  if (!set) {
    set = new Set();
    bus.listeners.set(eventId, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) bus.listeners.delete(eventId);
  };
}

export function broadcastRosterChange(eventId: number, sourceClientId: string | null): void {
  const bus = getBus();
  const set = bus.listeners.get(eventId);
  if (!set || set.size === 0) return;
  const event: RosterChangeEvent = { eventId, sourceClientId, ts: Date.now() };
  for (const listener of set) {
    try {
      listener(event);
    } catch (err) {
      console.error("[ROSTER SSE] Listener error:", err);
    }
  }
}
