/**
 * Rechenkern der automatischen Planung.
 *
 * Reines TypeScript ohne Abhängigkeiten: Er läuft im Worker-Thread, notfalls
 * aber auch im Hauptprozess – dann in kurzen Häppchen (`step`), zwischen denen
 * der Server andere Anfragen beantwortet.
 *
 * Vorgehen
 * --------
 * 1. Gierige Konstruktion: Prioritätsstufe für Prioritätsstufe wird die Zeit
 *    von vorn nach hinten über alle Stationen der Stufe hinweg aufgefüllt. An
 *    jeder freien Stelle bekommt die Person den Zuschlag, die dort am besten
 *    passt (Wunsch, Schichtlänge, bisherige Zeit, keine Überqualifikation).
 * 2. Verlängern: Reste, die für eine eigene Schicht zu kurz sind (typisch am
 *    Eventende), werden von benachbarten Schichten übernommen.
 * 3. Large Neighbourhood Search: Bis die Rechenzeit um ist, wird immer wieder
 *    ein Teil des Plans verworfen (Zeitfenster, Stationen oder Personen) und
 *    mit etwas Zufall neu aufgebaut. Ein Ergebnis bleibt, wenn es nicht
 *    schlechter ist.
 *
 * Bewertung (lexikografisch, von vorn nach hinten):
 *   besetzte Slots je Priorität 1 … 5, danach eine weiche Punktzahl aus
 *   Wünschen, Schichtlänge, gleichmäßiger Verteilung und zu langen Pausen.
 * Eine Lücke auf einer höher priorisierten Station wiegt damit schwerer als
 * jede Zahl von Lücken darunter – so wie das Eventteam es einstellt.
 *
 * Harte Grenzen: Eignung (inkl. „will nicht"), Verfügbarkeit, Schichtlänge
 * min/max, Mindestpause, Gesamtzeit. Die längste Pause ist ein Ziel, kein
 * Muss – sonst ließe sich jemand, der früh und spät kann, gar nicht nutzen.
 */

import type { SolverInput } from "./types";

export interface CoreSession {
  station: number;
  ctrl: number;
  start: number;
  end: number;
}

export interface CoreProgress {
  done: boolean;
  /** 0–1 */
  progress: number;
  iterations: number;
}

/**
 * Liefert die Solver-Klasse.
 *
 * Alles steckt in dieser einen Funktion und greift auf nichts außerhalb zu:
 * Der Worker wird aus ihrem Quelltext gestartet (siehe solverRunner.ts), weil
 * der Bundler eine eigene Worker-Datei nicht mitbaut. Deshalb hier keine
 * Imports und keine Bezüge auf Modulvariablen verwenden.
 */
export function createRosterSolverClass() {
  interface Session {
    id: number;
    /** Stationsindex; -1 bei festen Blöcken ohne Station (z. B. „Mentor") */
    station: number;
    ctrl: number;
    start: number;
    end: number;
    fixed: boolean;
    /** Zählt zur Gesamtzeit (feste Controller-Schichten ja, persönliche Blöcke nein) */
    counts: boolean;
    /** Nur feste Blöcke: was zur Gesamtzeit zählt (echte Länge in Slots, ggf. Bruchteil) */
    counted: number;
  }

  const PRIORITY_LEVELS = 5;
  /**
   * Abzug je Ebene Überqualifikation und 30 Minuten: Wer mehr kann, gehört auf
   * höhere Stationen – ein C1 auf einem S1-Tower kostet 2,5 Ebenen. Ein
   * ausdrücklicher Wunsch (Bonus 2–3) wiegt eine Ebene weiterhin auf.
   */
  const OVERQUALIFIED_WEIGHT = 0.6;
  /**
   * Bonus je 30 Minuten, die zwei Partner („gern zusammen mit …“) zugleich auf
   * benachbarten Stationen sitzen – etwas unter dem liebsten Stationswunsch.
   */
  const PAIR_WEIGHT = 2;
  /**
   * Arbeitszeit am Stück: Schichten ohne Lücke dazwischen zählen zusammen,
   * auch über einen Stationswechsel. Jede halbe Stunde über der angestrebten
   * Länge kostet mehr als eine darunter – Ablösen mit Pause schlägt
   * Durcharbeiten, solange jemand frei ist.
   */
  const STRETCH_OVER_WEIGHT = 1.5;
  const STRETCH_UNDER_WEIGHT = 0.5;
  /** Ein Stationswechsel ohne Pause entlastet niemanden und kostet etwas */
  const SWITCH_PENALTY = 1;
  /** Score-Tupel: besetzte Slots je Priorität 1–5, dann die weiche Punktzahl */
  type Score = number[];

  function compareScore(a: Score, b: Score): number {
    for (let i = 0; i < PRIORITY_LEVELS; i++) {
      if (a[i] !== b[i]) return a[i] - b[i];
    }
    const d = a[PRIORITY_LEVELS] - b[PRIORITY_LEVELS];
    return Math.abs(d) < 1e-9 ? 0 : d;
  }

  /**
   * Zuordnung mit größtem Gesamtgewicht (Ungarische Methode, O(n³)).
   * `w[i][j]` ≤ 0 heißt „nicht zuordnen“. Liefert je Zeile die Spalte oder -1.
   */
  function maxWeightAssignment(w: number[][], rows: number, cols: number): number[] {
    const n = Math.max(rows, cols);
    if (n === 0) return [];
    let maxW = 0;
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) if (w[i][j] > maxW) maxW = w[i][j];
    const cost = (i: number, j: number) =>
      i < rows && j < cols && w[i][j] > 0 ? maxW - w[i][j] : maxW;
    // Potentiale, 1-basiert wie im klassischen Verfahren
    const u = new Float64Array(n + 1);
    const v = new Float64Array(n + 1);
    const p = new Int32Array(n + 1);
    const way = new Int32Array(n + 1);
    for (let i = 1; i <= n; i++) {
      p[0] = i;
      let j0 = 0;
      const minv = new Float64Array(n + 1).fill(Infinity);
      const used = new Uint8Array(n + 1);
      do {
        used[j0] = 1;
        const i0 = p[j0];
        let delta = Infinity;
        let j1 = 0;
        for (let j = 1; j <= n; j++) {
          if (used[j]) continue;
          const cur = cost(i0 - 1, j - 1) - u[i0] - v[j];
          if (cur < minv[j]) {
            minv[j] = cur;
            way[j] = j0;
          }
          if (minv[j] < delta) {
            delta = minv[j];
            j1 = j;
          }
        }
        for (let j = 0; j <= n; j++) {
          if (used[j]) {
            u[p[j]] += delta;
            v[j] -= delta;
          } else {
            minv[j] -= delta;
          }
        }
        j0 = j1;
      } while (p[j0] !== 0);
      do {
        const j1 = way[j0];
        p[j0] = p[j1];
        j0 = j1;
      } while (j0);
    }
    const out = new Array(rows).fill(-1);
    for (let j = 1; j <= n; j++) {
      const i = p[j] - 1;
      if (i < rows && j - 1 < cols && w[i][j - 1] > 0) out[i] = j - 1;
    }
    return out;
  }

  /** Kleiner, reproduzierbarer Zufallsgenerator (mulberry32) */
  function makeRng(seed: number): () => number {
    let a = seed >>> 0 || 0x9e3779b9;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const FREE = -1;
  const CLOSED = -2;

  class RosterSolver {
    private readonly S: number;
    private readonly T: number;
    private readonly C: number;
    private readonly rng: () => number;
    /** Gewichte, auf 30-Minuten-Einheiten normiert */
    private readonly u: number;
    private readonly wp: number;
    private readonly wf: number;

    private readonly eligible: Uint8Array; // C*S
    private readonly candidates: number[][]; // je Station die geeigneten Personen
    private readonly wish: Float64Array; // C*S: Wunschbonus je Slot
    private readonly over: Float64Array; // C*S: Abzug für Überqualifikation je Slot
    private readonly adjacent: Uint8Array; // S*S: benachbart für Paarwünsche
    private readonly partners: number[][]; // je Person die Partner (beidseitig)
    private readonly maxTotal: number[]; // je Person, Infinity = keine Grenze
    private readonly tiers: number[][]; // je Priorität 1–5 die Stationsindizes

    // --- Zustand ---
    private occ: Int32Array; // S*T: CLOSED, FREE oder Session-ID
    private sessions = new Map<number, Session>();
    private ctrlSessions: Session[][];
    private ctrlTotal: number[];
    private nextId = 1;
    private readonly fixedSessions: Session[] = [];

    private currentScore: Score = [];
    private best: CoreSession[] = [];
    private bestScore: Score = [];

    private startedAt = 0;
    private initialized = false;
    private finished = false;
    private iterations = 0;
    private lastImprovementIteration = 0;
    private lastImprovementAt = 0;

    constructor(private readonly input: SolverInput) {
      this.S = input.stations.length;
      this.T = input.slotCount;
      this.C = input.controllers.length;
      this.rng = makeRng(input.seed);
      this.u = input.slotMinutes / 30;
      this.wp = input.preferenceWeight / 5;
      this.wf = input.fairnessWeight / 5;

      const { S, T, C } = this;
      this.eligible = new Uint8Array(C * S);
      this.wish = new Float64Array(C * S);
      this.over = new Float64Array(C * S);
      // Benachbart: gleicher Airport und höchstens eine Ebene auseinander
      // (TWR–GND, Director–Low), Center untereinander
      this.adjacent = new Uint8Array(S * S);
      input.stations.forEach((a, i) => {
        input.stations.forEach((b, j) => {
          if (i === j || a.level < 0 || b.level < 0) return;
          const sameAirport = !!a.airport && a.airport === b.airport && Math.abs(a.level - b.level) <= 1;
          const bothCenter = !a.airport && !b.airport && a.level >= 4 && b.level >= 4;
          if (sameAirport || bothCenter) this.adjacent[i * S + j] = 1;
        });
      });
      this.partners = input.controllers.map((c) =>
        (c.partners ?? []).filter((p) => p >= 0 && p < C)
      );
      this.candidates = Array.from({ length: S }, () => []);
      this.maxTotal = [];

      input.controllers.forEach((c, ci) => {
        for (const k of c.eligible) {
          if (k < 0 || k >= S) continue;
          this.eligible[ci * S + k] = 1;
          this.candidates[k].push(ci);
        }
        for (let k = 0; k < S; k++) {
          const rank = c.wishRank[k];
          let bonus = 0;
          if (rank !== undefined) bonus = rank === 0 ? 3 : rank === 1 ? 2 : 1.5;
          else if (c.hasWishes) bonus = -1;
          this.wish[ci * S + k] = bonus;
          const stLevel = input.stations[k].level;
          if (stLevel >= 0 && c.level > stLevel) {
            this.over[ci * S + k] = OVERQUALIFIED_WEIGHT * (c.level - stLevel);
          }
        }
        // Die persönliche Grenze ersetzt die des Plans (auch nach oben);
        // 0 ist eine echte Grenze (unter einem Slot), nicht „keine“
        const limit = c.maxTotalSlots ?? input.maxTotalSlots;
        this.maxTotal.push(typeof limit === "number" && limit >= 0 ? limit : Infinity);
      });

      this.tiers = Array.from({ length: PRIORITY_LEVELS }, () => []);
      input.stations.forEach((st, k) => {
        const p = Math.min(PRIORITY_LEVELS, Math.max(1, Math.round(st.priority)));
        this.tiers[p - 1].push(k);
      });

      this.occ = new Int32Array(S * T);
      this.ctrlSessions = Array.from({ length: C }, () => []);
      this.ctrlTotal = new Array(C).fill(0);

      // Feste Blöcke der Personen: belegen sie, zählen für Pausen und Gesamtzeit
      input.controllers.forEach((c, ci) => {
        for (const f of c.fixed) {
          const start = Math.max(0, f.start);
          const end = Math.min(T, f.end);
          if (end <= start) continue;
          this.fixedSessions.push({
            id: -(this.fixedSessions.length + 1),
            station: f.station ?? -1,
            ctrl: ci,
            start,
            end,
            fixed: true,
            counts: f.counts,
            counted: f.counts ? (f.countedSlots ?? end - start) : 0,
          });
        }
      });

      this.resetState();
    }

    // =====================================================================
    // Öffentliche Schnittstelle
    // =====================================================================

    /** Rechnet höchstens `budgetMs` Millisekunden weiter */
    step(budgetMs: number): CoreProgress {
      const sliceEnd = Date.now() + budgetMs;
      if (!this.initialized) {
        this.startedAt = Date.now();
        this.lastImprovementAt = this.startedAt;
        // Zwei Startpläne, der bessere zählt: Stationsweise ist gut, solange
        // Personen übrig sind – wird es knapp, besetzt die Zuordnung je
        // Halbstunde mehr, weil sie alle Stationen zugleich betrachtet.
        this.repair(0);
        const greedyScore = this.evaluate();
        const greedy = this.snapshot();
        this.resetState();
        this.matchingConstruct(0);
        this.currentScore = this.evaluate();
        if (compareScore(this.currentScore, greedyScore) < 0) {
          this.loadSessions(greedy);
          this.currentScore = greedyScore;
        }
        this.saveBest();
        this.initialized = true;
        if (this.isTriviallyDone()) this.finished = true;
      }

      while (!this.finished && Date.now() < sliceEnd) {
        this.iterate();
        const now = Date.now();
        const elapsed = now - this.startedAt;
        const stale = this.iterations - this.lastImprovementIteration;
        if (elapsed >= this.input.timeLimitMs) this.finished = true;
        // Kommt lange nichts Besseres mehr, ist weiteres Rechnen Zeitverschwendung
        else if (stale > 6000 && now - this.lastImprovementAt > Math.min(15000, this.input.timeLimitMs / 3))
          this.finished = true;
      }

      return {
        done: this.finished,
        progress: this.finished
          ? 1
          : Math.min(0.99, (Date.now() - this.startedAt) / this.input.timeLimitMs),
        iterations: this.iterations,
      };
    }

    /** Bester gefundener Plan (nur neue Schichten) */
    result(): { sessions: CoreSession[]; score: Score; iterations: number } {
      return { sessions: this.best.map((s) => ({ ...s })), score: [...this.bestScore], iterations: this.iterations };
    }

    /** Alles in einem Zug – für Worker und Tests */
    solve(): { sessions: CoreSession[]; score: Score; iterations: number } {
      while (!this.step(250).done) {
        // weiter
      }
      return this.result();
    }

    // =====================================================================
    // Zustand
    // =====================================================================

    private resetState(): void {
      const { S, T } = this;
      for (let k = 0; k < S; k++) {
        const open = this.input.stations[k].open;
        for (let t = 0; t < T; t++) this.occ[k * T + t] = open[t] ? FREE : CLOSED;
      }
      this.sessions.clear();
      this.ctrlSessions = Array.from({ length: this.C }, () => []);
      this.ctrlTotal = new Array(this.C).fill(0);
      for (const f of this.fixedSessions) {
        this.ctrlSessions[f.ctrl].push(f);
        this.ctrlTotal[f.ctrl] += f.counted;
      }
      for (const list of this.ctrlSessions) list.sort((a, b) => a.start - b.start);
    }

    private loadSessions(list: CoreSession[]): void {
      this.resetState();
      for (const s of list) this.place(s.ctrl, s.station, s.start, s.end);
    }

    private snapshot(): CoreSession[] {
      const out: CoreSession[] = [];
      for (const s of this.sessions.values()) {
        out.push({ station: s.station, ctrl: s.ctrl, start: s.start, end: s.end });
      }
      return out;
    }

    private saveBest(): void {
      this.best = this.snapshot();
      this.bestScore = [...this.currentScore];
    }

    private place(ctrl: number, station: number, start: number, end: number): Session {
      const s: Session = {
        id: this.nextId++,
        station,
        ctrl,
        start,
        end,
        fixed: false,
        counts: true,
        counted: end - start,
      };
      this.sessions.set(s.id, s);
      const base = station * this.T;
      for (let t = start; t < end; t++) this.occ[base + t] = s.id;
      const list = this.ctrlSessions[ctrl];
      let i = list.length;
      while (i > 0 && list[i - 1].start > start) i--;
      list.splice(i, 0, s);
      this.ctrlTotal[ctrl] += end - start;
      return s;
    }

    private remove(s: Session): void {
      // Doppelt gezogene Schichten (Zufallsauswahl) nur einmal entfernen
      if (s.fixed || !this.sessions.has(s.id)) return;
      this.sessions.delete(s.id);
      const base = s.station * this.T;
      for (let t = s.start; t < s.end; t++) this.occ[base + t] = FREE;
      const list = this.ctrlSessions[s.ctrl];
      const i = list.indexOf(s);
      if (i >= 0) list.splice(i, 1);
      this.ctrlTotal[s.ctrl] -= s.end - s.start;
    }

    private resize(s: Session, start: number, end: number): void {
      const base = s.station * this.T;
      for (let t = s.start; t < s.end; t++) this.occ[base + t] = FREE;
      this.ctrlTotal[s.ctrl] += end - start - (s.end - s.start);
      s.start = start;
      s.end = end;
      for (let t = start; t < end; t++) this.occ[base + t] = s.id;
    }

    private isTriviallyDone(): boolean {
      // Nichts zu besetzen oder niemand da: weiteres Suchen bringt nichts
      if (this.S === 0 || this.C === 0 || this.T === 0) return true;
      // Ebenso, wenn keine offene Station jemanden hat, der sie besetzen darf
      return this.input.stations.every((st, k) => this.candidates[k].length === 0 || !st.open.some(Boolean));
    }

    // =====================================================================
    // Prüfungen
    // =====================================================================

    /** Längster Lauf verfügbarer Slots ab `start` (höchstens `limit`) */
    private availableRun(ctrl: number, start: number, limit: number): number {
      const avail = this.input.controllers[ctrl].available;
      let n = 0;
      while (n < limit && start + n < this.T && avail[start + n]) n++;
      return n;
    }

    /** Nachbarn einer Person rund um [start, end) – oder null bei Überschneidung */
    private neighbours(
      ctrl: number,
      start: number,
      end: number,
      ignore?: Session
    ): { prev: Session | null; next: Session | null } | null {
      let prev: Session | null = null;
      let next: Session | null = null;
      for (const s of this.ctrlSessions[ctrl]) {
        if (s === ignore) continue;
        if (s.start < end && start < s.end) return null;
        if (s.end <= start) prev = s;
        else if (s.start >= end && !next) next = s;
      }
      return { prev, next };
    }

    /** Abstand zwischen zwei Blöcken reicht als Pause? */
    private gapOk(a: Session | null, station: number, b: { start: number }, aEnd?: number): boolean {
      if (!a) return true;
      const gap = b.start - (aEnd ?? a.end);
      if (gap < this.input.minBreakSlots) return false;
      // Ohne Pause direkt auf derselben Station wäre es eine einzige, zu lange Schicht
      if (gap === 0 && a.station === station) return false;
      return true;
    }

    // =====================================================================
    // Bewertung
    // =====================================================================

    private lengthPenalty(len: number): number {
      return Math.abs(len - this.input.preferredSessionSlots) * this.u;
    }

    /**
     * Kosten der Arbeitszeit am Stück einer Person (Liste nach Beginn
     * sortiert): Abweichung von der angestrebten Länge je Abschnitt ohne
     * Pause und ein Abzug je Wechsel ohne Pause. Persönliche Blöcke (Mentor)
     * zählen nicht als Arbeit, Abschnitte nur aus festen Schichten nicht mit.
     */
    private stretchCost(list: Session[]): number {
      const pref = this.input.preferredSessionSlots;
      let cost = 0;
      let start = -1;
      let end = -1;
      let planned = false;
      const close = () => {
        if (start < 0 || !planned) return;
        const len = end - start;
        cost += (len > pref ? STRETCH_OVER_WEIGHT * (len - pref) : STRETCH_UNDER_WEIGHT * (pref - len)) * this.u;
      };
      for (const s of list) {
        if (s.fixed && !s.counts) continue;
        if (start >= 0 && s.start === end) {
          end = s.end;
          if (!s.fixed) {
            planned = true;
            cost += SWITCH_PENALTY;
          }
          continue;
        }
        close();
        start = s.start;
        end = s.end;
        planned = !s.fixed;
      }
      close();
      return cost;
    }

    /** Beginn der Arbeit am Stück, zu der `s` gehört */
    private stretchStart(s: Session): number {
      let start = s.start;
      const list = this.ctrlSessions[s.ctrl];
      for (let i = list.indexOf(s) - 1; i >= 0; i--) {
        const prev = list[i];
        if (prev.fixed && !prev.counts) continue;
        if (prev.end !== start) break;
        start = prev.start;
      }
      return start;
    }

    private fairnessCost(totalSlots: number): number {
      const units = totalSlots * this.u;
      return 0.15 * this.wf * units * units;
    }

    private breakPenalty(gapSlots: number): number {
      const max = this.input.maxBreakSlots;
      if (max === null || gapSlots <= max) return 0;
      return (gapSlots - max) * this.u * 4;
    }

    /** Slots, die Partner `p` in [start, end) auf einer Nachbarstation von `station` sitzt */
    private partnerOverlap(p: number, station: number, start: number, end: number): number {
      let slots = 0;
      for (const s of this.ctrlSessions[p]) {
        if (s.station < 0 || !this.adjacent[station * this.S + s.station]) continue;
        const o = Math.min(end, s.end) - Math.max(start, s.start);
        if (o > 0) slots += o;
      }
      return slots;
    }

    private evaluate(): Score {
      const score: Score = new Array(PRIORITY_LEVELS + 1).fill(0);
      let soft = 0;
      for (const s of this.sessions.values()) {
        const len = s.end - s.start;
        const p = Math.min(PRIORITY_LEVELS, Math.max(1, Math.round(this.input.stations[s.station].priority)));
        score[p - 1] += len;
        soft += this.wp * this.wish[s.ctrl * this.S + s.station] * len * this.u;
        soft -= this.over[s.ctrl * this.S + s.station] * len * this.u;
      }
      for (let c = 0; c < this.C; c++) {
        const list = this.ctrlSessions[c];
        if (list.length === 0) continue;
        // Fairness nur über die neu geplante Zeit – feste Schichten stehen ohnehin
        let planned = 0;
        for (const s of list) if (!s.fixed) planned += s.end - s.start;
        soft -= this.fairnessCost(planned);
        soft -= this.stretchCost(list);
        // Paarwünsche – jedes Paar einmal
        for (const p of this.partners[c]) {
          if (p < c) continue;
          for (const s of list) {
            if (s.station < 0) continue;
            soft += this.wp * PAIR_WEIGHT * this.partnerOverlap(p, s.station, s.start, s.end) * this.u;
          }
        }
        for (let i = 1; i < list.length; i++) {
          if (list[i].fixed && list[i - 1].fixed) continue;
          soft -= this.breakPenalty(list[i].start - list[i - 1].end);
        }
      }
      score[PRIORITY_LEVELS] = soft;
      return score;
    }

    // =====================================================================
    // Konstruktion
    // =====================================================================

    /** Darf `ctrl` bei `t` auf `station` eine neue Schicht von Mindestlänge beginnen? */
    private canStart(ctrl: number, station: number, t: number): boolean {
      const { T } = this;
      const minS = this.input.minSessionSlots;
      if (!this.eligible[ctrl * this.S + station]) return false;
      if (t + minS > T || this.availableRun(ctrl, t, minS) < minS) return false;
      for (let i = 0; i < minS; i++) if (this.occ[station * T + t + i] !== FREE) return false;
      if (this.ctrlTotal[ctrl] + minS > this.maxTotal[ctrl]) return false;
      const nb = this.neighbours(ctrl, t, t + minS);
      if (!nb || !this.gapOk(nb.prev, station, { start: t })) return false;
      if (nb.next && !this.gapOk({ station, end: t + minS } as Session, nb.next.station, nb.next)) return false;
      return true;
    }

    /** Darf die laufende Schicht `s` den Slot `t` (= s.end) noch dazunehmen? */
    private canContinue(s: Session, t: number): boolean {
      if (t >= this.T || s.end !== t || t + 1 - s.start > this.input.maxSessionSlots) return false;
      if (!this.input.controllers[s.ctrl].available[t]) return false;
      if (this.occ[s.station * this.T + t] !== FREE) return false;
      if (this.ctrlTotal[s.ctrl] + 1 > this.maxTotal[s.ctrl]) return false;
      const nb = this.neighbours(s.ctrl, s.start, t + 1, s);
      if (!nb) return false;
      if (nb.next && !this.gapOk({ station: s.station, end: t + 1 } as Session, nb.next.station, nb.next)) {
        return false;
      }
      return true;
    }

    /**
     * Baut den Plan Halbstunde für Halbstunde: Je Slot werden alle freien
     * Stationen und alle verfügbaren Personen auf einmal bestmöglich
     * zugeordnet. Abdeckung (nach Priorität) wiegt am meisten, dann das
     * Weitermachen auf derselben Station, dann Wünsche, Überqualifikation und
     * Paare. Schichten unter der Mindestlänge laufen zwingend weiter.
     */
    private matchingConstruct(noise: number): void {
      const { T, S, C } = this;
      const minS = this.input.minSessionSlots;
      const prefS = this.input.preferredSessionSlots;
      // Abdeckung lexikographisch nach Priorität: eine Station einer höheren
      // Stufe wiegt mehr als alle Stationen der niedrigeren zusammen
      const base = S + 1;
      const coverWeight = this.input.stations.map((st) => {
        const p = Math.min(PRIORITY_LEVELS, Math.max(1, Math.round(st.priority)));
        return 1000 * Math.pow(base, PRIORITY_LEVELS - p);
      });
      const running: (Session | null)[] = new Array(C).fill(null);

      for (let t = 0; t < T; t++) {
        const busyCtrl = new Uint8Array(C);
        const busySt = new Uint8Array(S);
        const cont: (Session | null)[] = new Array(C).fill(null);
        for (let c = 0; c < C; c++) {
          const s = running[c];
          if (!s || !this.canContinue(s, t)) continue;
          if (t - s.start < minS) {
            // Noch unter der Mindestlänge: muss weiterlaufen
            this.resize(s, s.start, t + 1);
            busyCtrl[c] = 1;
            busySt[s.station] = 1;
          } else {
            cont[c] = s;
          }
        }

        const rows: number[] = [];
        for (let c = 0; c < C; c++) {
          if (!busyCtrl[c] && this.input.controllers[c].available[t]) rows.push(c);
        }
        const cols: number[] = [];
        for (let k = 0; k < S; k++) {
          if (!busySt[k] && this.occ[k * T + t] === FREE) cols.push(k);
        }
        if (rows.length === 0 || cols.length === 0) continue;

        const w = rows.map((c) =>
          cols.map((k) => {
            const s = cont[c];
            const continues = s !== null && s.station === k;
            if (!continues && !this.canStart(c, k, t)) return 0;
            let x = coverWeight[k];
            if (s) {
              // Wer schon die angestrebte Zeit am Stück arbeitet, wird abgelöst,
              // wenn jemand Ausgeruhtes da ist; Wechsel ohne Pause sind nur Notlösung
              const worked = t - this.stretchStart(s);
              if (worked < prefS) x += continues ? 600 : -250;
              else x -= (continues ? 100 : 350) + 50 * (worked - prefS);
            }
            let soft = this.wp * this.wish[c * S + k] - this.over[c * S + k];
            for (const p of this.partners[c]) {
              soft += this.wp * PAIR_WEIGHT * Math.min(1, this.partnerOverlap(p, k, t, t + 1));
            }
            x += 20 * soft;
            if (noise > 0) x += (this.rng() - 0.5) * 40 * noise;
            return Math.max(1, x);
          })
        );
        const pick = maxWeightAssignment(w, rows.length, cols.length);
        pick.forEach((j, i) => {
          if (j < 0) return;
          const c = rows[i];
          const k = cols[j];
          const s = cont[c];
          if (s && s.station === k) {
            this.resize(s, s.start, t + 1);
          } else {
            running[c] = this.place(c, k, t, t + 1);
          }
        });
      }

      // Sicherheitsnetz: zu kurz geratene Schichten entfernen, Reste anhängen
      for (const s of [...this.sessions.values()]) {
        if (s.end - s.start < minS) this.remove(s);
      }
      this.extendAll();
    }

    /**
     * Füllt alle freien Slots, Priorität für Priorität, zeitlich von vorn.
     * `noise` streut die Auswahl, damit die Suche neue Wege probiert.
     */
    private repair(noise: number): void {
      const { T } = this;
      for (const tier of this.tiers) {
        if (tier.length === 0) continue;
        // Knappe Stationen (wenige geeignete Personen) zuerst – bei Gleichstand
        // entscheidet der Zufall, damit die Suche nicht immer gleich anfängt.
        const order = [...tier]
          .map((k) => ({ k, key: this.candidates[k].length + this.rng() * (noise > 0 ? 3 : 0.01) }))
          .sort((a, b) => a.key - b.key)
          .map((x) => x.k);
        const cursor = new Map<number, number>(order.map((k) => [k, 0]));

        for (;;) {
          let station = -1;
          let t = T;
          for (const k of order) {
            let c = cursor.get(k)!;
            while (c < T && this.occ[k * T + c] !== FREE) c++;
            cursor.set(k, c);
            if (c < t) {
              t = c;
              station = k;
            }
          }
          if (station < 0) break;

          let run = 0;
          while (t + run < T && this.occ[station * T + t + run] === FREE) run++;
          if (run < this.input.minSessionSlots) {
            cursor.set(station, t + run);
            continue;
          }

          const pick = this.chooseCandidate(station, t, run, noise);
          if (pick) {
            this.place(pick.ctrl, station, t, t + pick.len);
            cursor.set(station, t + pick.len);
          } else {
            cursor.set(station, t + 1);
          }
        }
      }
      this.extendAll();
    }

    private chooseCandidate(
      station: number,
      t: number,
      run: number,
      noise: number
    ): { ctrl: number; len: number } | null {
      const { minSessionSlots: minS, maxSessionSlots: maxS } = this.input;
      const maxLen = Math.min(maxS, run);
      let best: { ctrl: number; len: number; score: number } | null = null;

      for (const c of this.candidates[station]) {
        if (!this.input.controllers[c].available[t]) continue;
        const nb = this.neighbours(c, t, t + minS);
        if (!nb) continue;
        if (!this.gapOk(nb.prev, station, { start: t })) continue;

        let limit = Math.min(maxLen, this.availableRun(c, t, maxLen));
        const room = this.maxTotal[c] - this.ctrlTotal[c];
        limit = Math.min(limit, room);
        if (nb.next) {
          const sameStation = nb.next.station === station;
          const latestEnd = nb.next.start - Math.max(this.input.minBreakSlots, sameStation ? 1 : 0);
          limit = Math.min(limit, latestEnd - t);
        }
        if (limit < minS) continue;

        // Schichtlänge: nah an der Wunschlänge, ohne einen unbesetzbaren Rest zu lassen
        let bestLen = -1;
        let bestLenScore = -Infinity;
        for (let len = minS; len <= limit; len++) {
          let s = -this.lengthPenalty(len) + 0.05 * len;
          const remnant = run - len;
          if (remnant > 0 && remnant < minS) s -= 6 * this.u;
          if (s > bestLenScore) {
            bestLenScore = s;
            bestLen = len;
          }
        }

        const planned = this.plannedSlots(c);
        let score = bestLenScore;
        score += this.wp * this.wish[c * this.S + station] * bestLen * this.u;
        score -= this.fairnessCost(planned + bestLen) - this.fairnessCost(planned);
        // Überqualifikation: Wer mehr kann, wird für höhere Stationen gebraucht
        score -= this.over[c * this.S + station] * bestLen * this.u;
        // Partner schon nebenan eingeplant?
        for (const p of this.partners[c]) {
          score += this.wp * PAIR_WEIGHT * this.partnerOverlap(p, station, t, t + bestLen) * this.u;
        }
        // Pausen: zu lange Wartezeit zur vorigen Schicht vermeiden
        if (nb.prev) score -= this.breakPenalty(t - nb.prev.end);
        if (nb.next) score -= this.breakPenalty(nb.next.start - (t + bestLen));
        if (noise > 0) score += (this.rng() - 0.5) * noise;

        if (!best || score > best.score) best = { ctrl: c, len: bestLen, score };
      }
      return best ? { ctrl: best.ctrl, len: best.len } : null;
    }

    private plannedSlots(ctrl: number): number {
      let n = 0;
      for (const s of this.ctrlSessions[ctrl]) if (!s.fixed) n += s.end - s.start;
      return n;
    }

    /** Reste, die für eine eigene Schicht zu kurz sind, an Nachbarschichten hängen */
    private extendAll(): void {
      const list = [...this.sessions.values()];
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
      for (const s of list) {
        this.extendEnd(s);
        this.extendStart(s);
      }
    }

    private extendEnd(s: Session): void {
      const { T } = this;
      const maxS = this.input.maxSessionSlots;
      let end = s.end;
      const nb = this.neighbours(s.ctrl, s.start, s.end, s);
      const next = nb?.next ?? null;
      while (
        end < T &&
        end - s.start < maxS &&
        this.occ[s.station * T + end] === FREE &&
        this.input.controllers[s.ctrl].available[end] &&
        this.ctrlTotal[s.ctrl] + (end + 1 - s.end) <= this.maxTotal[s.ctrl] &&
        (!next || this.gapOk(s, next.station, next, end + 1))
      ) {
        end++;
      }
      if (end !== s.end) this.resize(s, s.start, end);
    }

    private extendStart(s: Session): void {
      const { T } = this;
      const maxS = this.input.maxSessionSlots;
      let start = s.start;
      const nb = this.neighbours(s.ctrl, s.start, s.end, s);
      const prev = nb?.prev ?? null;
      while (
        start > 0 &&
        s.end - start < maxS &&
        this.occ[s.station * T + start - 1] === FREE &&
        this.input.controllers[s.ctrl].available[start - 1] &&
        this.ctrlTotal[s.ctrl] + (s.start - (start - 1)) <= this.maxTotal[s.ctrl] &&
        (!prev || this.gapOk(prev, s.station, { start: start - 1 }))
      ) {
        start--;
      }
      if (start !== s.start) this.resize(s, start, s.end);
    }

    // =====================================================================
    // Suche
    // =====================================================================

    private iterate(): void {
      this.iterations++;
      const before = this.snapshot();
      const beforeScore = this.currentScore;

      if (this.rng() < 0.03) {
        // Ganz neu per Zuordnung, mit Streuung – findet andere Grundmuster
        this.resetState();
        this.matchingConstruct(1 + this.rng() * 4);
      } else {
        this.destroy();
        this.repair(1 + this.rng() * 4);
      }
      const score = this.evaluate();

      if (compareScore(score, beforeScore) >= 0) {
        this.currentScore = score;
        if (compareScore(score, this.bestScore) > 0) {
          this.saveBest();
          this.lastImprovementIteration = this.iterations;
          this.lastImprovementAt = Date.now();
        }
      } else {
        this.loadSessions(before);
        this.currentScore = beforeScore;
      }

      // Ab und zu vom besten Stand neu ansetzen, statt auf einem Plateau zu treiben
      if (this.iterations % 500 === 0 && compareScore(this.currentScore, this.bestScore) < 0) {
        this.loadSessions(this.best);
        this.currentScore = [...this.bestScore];
      }
    }

    private destroy(): void {
      const all = [...this.sessions.values()];
      if (all.length === 0) return;
      const r = this.rng();
      const T = this.T;

      if (r < 0.4) {
        // Zeitfenster über einige oder alle Stationen
        const width = Math.max(this.input.maxSessionSlots, Math.floor(T * (0.15 + this.rng() * 0.35)));
        const from = Math.floor(this.rng() * Math.max(1, T - width + 1));
        const to = from + width;
        const allStations = this.rng() < 0.5;
        const pickStations = new Set<number>();
        if (!allStations) {
          const n = 1 + Math.floor(this.rng() * Math.min(4, this.S));
          for (let i = 0; i < n; i++) pickStations.add(Math.floor(this.rng() * this.S));
        }
        for (const s of all) {
          if (s.start < to && from < s.end && (allStations || pickStations.has(s.station))) this.remove(s);
        }
      } else if (r < 0.7) {
        // Alle Schichten einiger Personen
        const n = 1 + Math.floor(this.rng() * Math.min(5, this.C));
        const ctrls = new Set<number>();
        for (let i = 0; i < n; i++) ctrls.add(all[Math.floor(this.rng() * all.length)].ctrl);
        for (const s of all) if (ctrls.has(s.ctrl)) this.remove(s);
      } else if (r < 0.85) {
        // Ganze Stationen
        const n = 1 + Math.floor(this.rng() * Math.min(2, this.S));
        const st = new Set<number>();
        for (let i = 0; i < n; i++) st.add(all[Math.floor(this.rng() * all.length)].station);
        for (const s of all) if (st.has(s.station)) this.remove(s);
      } else {
        // Rund um eine Lücke: die Schichten davor und danach auf derselben Station
        const gaps: { k: number; t: number }[] = [];
        for (let k = 0; k < this.S; k++) {
          for (let t = 0; t < T; t++) if (this.occ[k * T + t] === FREE) gaps.push({ k, t });
        }
        if (gaps.length === 0) {
          // Alles besetzt: zufällige Schichten neu verteilen, um die weichen Ziele zu verbessern
          const n = 1 + Math.floor(this.rng() * Math.min(6, all.length));
          for (let i = 0; i < n; i++) this.remove(all[Math.floor(this.rng() * all.length)]);
          return;
        }
        const g = gaps[Math.floor(this.rng() * gaps.length)];
        const span = this.input.maxSessionSlots * 2;
        for (const s of all) {
          if (s.start < g.t + span && g.t - span < s.end) {
            if (s.station === g.k || this.rng() < 0.3) this.remove(s);
          }
        }
      }
    }
  }

  return RosterSolver;
}

export const RosterSolver = createRosterSolverClass();
export type RosterSolver = InstanceType<typeof RosterSolver>;
