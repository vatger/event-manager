/**
 * Pausen- und Wechselregeln einer Person – dieselbe Lesart wie
 * `computeWarnings` im Editor:
 *
 * - Zwei Schichten mit Lücke ≤ 0 auf verschiedenen Stationen sind ein
 *   Wechsel ohne Pause.
 * - Lücken unter `minBreak` zählen nicht als Pause; die so verbundenen
 *   Schichten dürfen zusammen höchstens `maxShift` lang sein.
 *
 * Persönliche Blöcke ("Mentor") sind keine Lotsenzeit und gehören nicht in
 * die übergebene Liste.
 */

export interface ShiftLike {
  stationId: number | null;
  start: number;
  end: number;
}

export function breaksShiftRules(
  shifts: ShiftLike[],
  candidate: ShiftLike,
  maxShift: number,
  minBreak: number
): boolean {
  const list = [...shifts, candidate].sort((a, b) => a.start - b.start || a.end - b.end);
  const idx = list.indexOf(candidate);

  const prev = list[idx - 1];
  if (prev && candidate.start - prev.end <= 0 && prev.stationId !== candidate.stationId) {
    return true;
  }
  const next = list[idx + 1];
  if (next && next.start - candidate.end <= 0 && next.stationId !== candidate.stationId) {
    return true;
  }

  // Zusammenhängende Strecke um den Kandidaten bilden
  let stretchStart = list[0].start;
  let stretchEnd = list[0].end;
  let containsCandidate = list[0] === candidate;
  for (let i = 1; i < list.length; i++) {
    const s = list[i];
    if (s.start - stretchEnd < minBreak) {
      stretchEnd = Math.max(stretchEnd, s.end);
    } else {
      if (containsCandidate) break;
      stretchStart = s.start;
      stretchEnd = s.end;
    }
    if (s === candidate) containsCandidate = true;
  }
  return stretchEnd - stretchStart > maxShift;
}
