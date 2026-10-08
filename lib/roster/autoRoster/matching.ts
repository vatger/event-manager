/**
 * Paarungen Station ↔ Lotse innerhalb eines Zeitslots.
 *
 * Beide Verfahren arbeiten auf Zeilen (Stationen) und Spalten (Personen) und
 * sind für die hier üblichen Größen (einige Dutzend Stationen, bis zu ein paar
 * hundert Anmeldungen) mehr als schnell genug.
 */

/**
 * Maximale Paarung mit Vorrang der Zeilen in ihrer Reihenfolge.
 *
 * Die Zeilen werden nacheinander über augmentierende Pfade angebunden; eine
 * einmal gepaarte Zeile verliert ihre Paarung dabei nie wieder. Weil die
 * paarbaren Zeilenmengen ein Matroid bilden, ist das gleichzeitig die
 * größtmögliche Paarung und unter allen größten die, die die vorderen Zeilen
 * bevorzugt – genau „von oben nach unten besetzen".
 *
 * @returns je Zeile die Spalte oder -1
 */
export function priorityMatching(adj: number[][], colCount: number): Int32Array {
  const matchCol = new Int32Array(colCount).fill(-1);
  const matchRow = new Int32Array(adj.length).fill(-1);
  const seen = new Int32Array(colCount).fill(-1);

  const tryRow = (row: number, stamp: number): boolean => {
    for (const col of adj[row]) {
      if (seen[col] === stamp) continue;
      seen[col] = stamp;
      if (matchCol[col] < 0 || tryRow(matchCol[col], stamp)) {
        matchCol[col] = row;
        matchRow[row] = col;
        return true;
      }
    }
    return false;
  };

  for (let row = 0; row < adj.length; row++) tryRow(row, row);
  return matchRow;
}

/**
 * Zuordnung mit minimalen Kosten (Ungarische Methode mit Potentialen).
 *
 * Jede Zeile bekommt genau eine Spalte; es muss deshalb mindestens so viele
 * Spalten wie Zeilen geben. Nicht erlaubte Paare tragen sehr hohe Kosten.
 *
 * @returns je Zeile die zugeordnete Spalte
 */
export function minCostAssignment(cost: number[][], colCount: number): Int32Array {
  const n = cost.length;
  const m = colCount;
  if (n > m) throw new Error("minCostAssignment: mehr Zeilen als Spalten");

  const u = new Float64Array(n + 1);
  const v = new Float64Array(m + 1);
  const p = new Int32Array(m + 1); // Spalte → Zeile (1-basiert, 0 = frei)
  const way = new Int32Array(m + 1);

  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Float64Array(m + 1).fill(Infinity);
    const used = new Uint8Array(m + 1);
    do {
      used[j0] = 1;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= m; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= m; j++) {
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
    } while (j0 !== 0);
  }

  const rowToCol = new Int32Array(n).fill(-1);
  for (let j = 1; j <= m; j++) {
    if (p[j] > 0) rowToCol[p[j] - 1] = j - 1;
  }
  return rowToCol;
}
