/**
 * In-Memory Event-Bus für Roster-Änderungen und Anwesenheit (Realtime über SSE).
 *
 * Jede erfolgreiche Mutation am Roster ruft broadcastRosterChange() auf;
 * offene SSE-Streams (subscribeRosterEvents) leiten das an die Clients
 * weiter, die daraufhin neu laden. Die sourceClientId erlaubt es Clients,
 * ihre eigenen Änderungen zu ignorieren.
 *
 * Die Anwesenheit hängt an genau denselben Verbindungen: Wer den Editor offen
 * hat, hält einen Stream offen – eine eigene Abmeldung oder ein Heartbeat ist
 * deshalb nicht nötig. Bricht der Browser weg, endet der Stream und die Person
 * verschwindet aus der Liste.
 *
 * Der Bus wird auf globalThis abgelegt, damit er Next.js-HMR und mehrfach
 * evaluierte Module übersteht (eine Server-Instanz vorausgesetzt).
 */

/** Jemand mit geöffnetem Besetzungsplan */
export interface RosterPresenceUser {
  cid: number;
  name: string;
  /** Darf die Person den Plan ändern oder schaut sie nur zu? */
  canEdit: boolean;
  /** Seit wann geöffnet (ms seit Epoch) */
  since: number;
}

export type RosterEvent =
  | { kind: "change"; eventId: number; sourceClientId: string | null; ts: number }
  | { kind: "presence"; eventId: number; users: RosterPresenceUser[]; ts: number };

/** Rückwärtskompatibler Alias für Änderungsereignisse */
export type RosterChangeEvent = Extract<RosterEvent, { kind: "change" }>;

type Listener = (event: RosterEvent) => void;

/** Mehrere Tabs derselben Person zählen als eine Anwesenheit */
interface PresenceEntry extends RosterPresenceUser {
  connections: number;
}

interface RosterEventBus {
  listeners: Map<number, Set<Listener>>;
  presence: Map<number, Map<number, PresenceEntry>>;
}

const globalForBus = globalThis as unknown as { __rosterEventBus?: RosterEventBus };

function getBus(): RosterEventBus {
  if (!globalForBus.__rosterEventBus) {
    globalForBus.__rosterEventBus = { listeners: new Map(), presence: new Map() };
  }
  const bus = globalForBus.__rosterEventBus;
  // Ältere Instanz aus einem HMR-Zyklus nachrüsten
  if (!bus.presence) bus.presence = new Map();
  return bus;
}

function emit(eventId: number, event: RosterEvent): void {
  const set = getBus().listeners.get(eventId);
  if (!set || set.size === 0) return;
  for (const listener of set) {
    try {
      listener(event);
    } catch (err) {
      console.error("[ROSTER SSE] Listener error:", err);
    }
  }
}

export function subscribeRosterEvents(eventId: number, listener: Listener): () => void {
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

/** Alias für bestehende Aufrufer, die nur Änderungen beobachten */
export const subscribeRosterChanges = subscribeRosterEvents;

export function broadcastRosterChange(eventId: number, sourceClientId: string | null): void {
  emit(eventId, { kind: "change", eventId, sourceClientId, ts: Date.now() });
}

export function getRosterPresence(eventId: number): RosterPresenceUser[] {
  const map = getBus().presence.get(eventId);
  if (!map) return [];
  return [...map.values()]
    .map(({ cid, name, canEdit, since }) => ({ cid, name, canEdit, since }))
    .sort((a, b) => a.since - b.since);
}

function broadcastPresence(eventId: number): void {
  emit(eventId, {
    kind: "presence",
    eventId,
    users: getRosterPresence(eventId),
    ts: Date.now(),
  });
}

/**
 * Anwesenheit anmelden. Gibt die Abmeldefunktion zurück, die beim Ende des
 * Streams aufgerufen werden muss.
 */
export function joinRosterPresence(
  eventId: number,
  user: { cid: number; name: string; canEdit: boolean }
): () => void {
  const bus = getBus();
  let map = bus.presence.get(eventId);
  if (!map) {
    map = new Map();
    bus.presence.set(eventId, map);
  }

  const existing = map.get(user.cid);
  if (existing) {
    existing.connections += 1;
    // Rechte können sich zwischen zwei Tabs unterscheiden – das großzügigere gilt
    existing.canEdit = existing.canEdit || user.canEdit;
  } else {
    map.set(user.cid, { ...user, since: Date.now(), connections: 1 });
  }
  broadcastPresence(eventId);

  let left = false;
  return () => {
    if (left) return;
    left = true;
    const current = bus.presence.get(eventId);
    const entry = current?.get(user.cid);
    if (!entry || !current) return;
    entry.connections -= 1;
    if (entry.connections <= 0) {
      current.delete(user.cid);
      if (current.size === 0) bus.presence.delete(eventId);
    }
    broadcastPresence(eventId);
  };
}
