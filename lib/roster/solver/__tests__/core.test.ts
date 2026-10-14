import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RosterSolver } from "../core";
import type { SolverInput } from "../types";
import { controller, coverage, hardViolations, input, randomInput, slotsExcept, station } from "./helpers";

function solve(inp: SolverInput) {
  const res = new RosterSolver(inp).solve();
  assert.deepEqual(hardViolations(inp, res.sessions), [], "harte Grenzen verletzt");
  return res;
}

describe("Rechenkern: Grundfälle", () => {
  it("besetzt eine Station mit einer Person vollständig", () => {
    // 2 h, Schicht max. 2 h
    const inp = input(4, [station("EDDF_TWR", 4)], [controller(1, 4, { eligible: [0] })]);
    const { sessions } = solve(inp);
    assert.deepEqual(coverage(inp, sessions), [4]);
    assert.equal(sessions.length, 1);
  });

  it("liefert ohne Stationen oder Personen sofort ein leeres Ergebnis", () => {
    for (const inp of [
      input(4, [], [controller(1, 4)]),
      input(4, [station("EDDF_TWR", 4)], []),
    ]) {
      const solver = new RosterSolver(inp);
      assert.equal(solver.step(1000).done, true);
      assert.deepEqual(solver.result().sessions, []);
    }
  });

  it("hört sofort auf, wenn niemand eine offene Station besetzen darf", () => {
    const inp = input(8, [station("EDDF_TWR", 8)], [controller(1, 8, { eligible: [] })], {
      timeLimitMs: 5000,
    });
    const solver = new RosterSolver(inp);
    assert.equal(solver.step(1000).done, true);
    assert.equal(solver.result().iterations, 0);
  });

  it("plant niemanden auf Stationen, für die er nicht geeignet ist", () => {
    const inp = input(
      4,
      [station("EDDF_TWR", 4), station("EDDF_APP", 4)],
      [controller(1, 4, { eligible: [0] }), controller(2, 4, { eligible: [0] })]
    );
    const { sessions } = solve(inp);
    assert.equal(coverage(inp, sessions)[1], 0);
    assert.equal(coverage(inp, sessions)[0], 4);
  });

  it("hält sich an die Verfügbarkeit", () => {
    // Person kann erst ab Stunde 1
    const inp = input(6, [station("EDDF_TWR", 6)], [
      controller(1, 6, { eligible: [0], available: slotsExcept(6, [0, 2]) }),
    ]);
    const { sessions } = solve(inp);
    assert.ok(sessions.every((s) => s.start >= 2));
    assert.equal(coverage(inp, sessions)[0], 4);
  });

  it("setzt keine Schicht in Lücken, die kürzer als die Mindestlänge sind", () => {
    // Nur Slot 2 ist offen (30 min) – Mindestschicht 60 min
    const inp = input(4, [station("EDDF_TWR", 4, { open: slotsExcept(4, [0, 2], [3, 4]) })], [
      controller(1, 4, { eligible: [0] }),
    ]);
    const { sessions } = solve(inp);
    assert.deepEqual(sessions, []);
  });

  it("besetzt Custom-Blöcke nicht", () => {
    const open = slotsExcept(8, [2, 4]);
    const inp = input(8, [station("EDDF_TWR", 8, { open })], [
      controller(1, 8, { eligible: [0] }),
      controller(2, 8, { eligible: [0] }),
    ]);
    const { sessions } = solve(inp);
    assert.ok(sessions.every((s) => s.end <= 2 || s.start >= 4));
    assert.equal(coverage(inp, sessions)[0], 6);
  });
});

describe("Rechenkern: Schichten und Pausen", () => {
  it("teilt lange Zeiträume in Schichten bis zur Höchstlänge mit Mindestpause", () => {
    // 4 h, eine Person, max. 2 h am Stück, 30 min Pause → höchstens 3,5 h
    const inp = input(8, [station("EDDF_TWR", 8)], [controller(1, 8, { eligible: [0] })]);
    const { sessions } = solve(inp);
    assert.ok(sessions.length >= 2);
    assert.ok(coverage(inp, sessions)[0] <= 7);
  });

  it("verteilt ein langes Event auf mehrere Personen ohne Lücke", () => {
    const inp = input(8, [station("EDDF_TWR", 8)], [
      controller(1, 8, { eligible: [0] }),
      controller(2, 8, { eligible: [0] }),
    ]);
    const { sessions } = solve(inp);
    assert.equal(coverage(inp, sessions)[0], 8);
    assert.ok(sessions.every((s) => s.end - s.start <= 4));
  });

  it("hält eine längere Mindestpause ein", () => {
    const inp = input(
      12,
      [station("EDDF_TWR", 12), station("EDDF_GND", 12)],
      [controller(1, 12, { eligible: [0, 1] }), controller(2, 12, { eligible: [0, 1] })],
      { minBreakSlots: 3 }
    );
    solve(inp);
  });

  it("überschreitet die Gesamtzeit des Plans nicht", () => {
    const inp = input(16, [station("EDDF_TWR", 16)], [controller(1, 16, { eligible: [0] })], {
      maxTotalSlots: 4,
    });
    const { sessions } = solve(inp);
    assert.equal(coverage(inp, sessions)[0], 4);
  });

  it("behandelt eine Obergrenze unter einem Slot als 0, nicht als „keine Grenze“", () => {
    // 15–29 min im 30-Minuten-Raster ergeben 0 Slots
    const inp = input(8, [station("EDDF_TWR", 8)], [
      controller(1, 8, { eligible: [0], maxTotalSlots: 0 }),
    ]);
    const { sessions } = solve(inp);
    assert.deepEqual(sessions, []);
  });

  it("lässt die persönliche Obergrenze die des Plans auch nach oben ersetzen", () => {
    // Plan: 2 h, Person: 3,5 h – eine Station über 4 h, nur diese Person
    const inp = input(8, [station("EDDF_TWR", 8)], [controller(1, 8, { eligible: [0], maxTotalSlots: 7 })], {
      maxTotalSlots: 4,
    });
    const { sessions } = solve(inp);
    assert.ok(coverage(inp, sessions)[0] > 4, "Person bleibt nicht bei der Plangrenze stehen");
  });

  it("rechnet feste Schichten mit ihrer echten Länge an, nicht mit der gerundeten", () => {
    // Fester Block belegt 2 Slots, dauert aber nur 1,5 (45 min im 30-Minuten-Raster)
    const inp = input(
      12,
      [station("EDDF_TWR", 12)],
      [
        controller(1, 12, {
          eligible: [0],
          fixed: [{ start: 0, end: 2, station: null, counts: true, countedSlots: 1.5 }],
        }),
      ],
      { maxTotalSlots: 5.5 }
    );
    const { sessions } = solve(inp);
    // 5,5 - 1,5 = 4 Slots bleiben – mit gerundeter Zählung wären es nur 3
    assert.equal(coverage(inp, sessions)[0], 4);
  });

  it("überschreitet die persönliche Obergrenze nicht", () => {
    const inp = input(8, [station("EDDF_TWR", 8)], [
      controller(1, 8, { eligible: [0], maxTotalSlots: 2 }),
      controller(2, 8, { eligible: [0] }),
    ]);
    const { sessions } = solve(inp);
    const total = sessions.filter((s) => s.ctrl === 0).reduce((n, s) => n + s.end - s.start, 0);
    assert.ok(total <= 2);
  });
});

describe("Rechenkern: feste Blöcke", () => {
  it("plant nicht über bestehende Blöcke und hält die Pause dazu ein", () => {
    // Person hat schon 0–60 min auf einer nicht mitgeplanten Station
    const inp = input(8, [station("EDDF_TWR", 8)], [
      controller(1, 8, { eligible: [0], fixed: [{ start: 0, end: 2, station: null, counts: true }] }),
    ]);
    const { sessions } = solve(inp);
    assert.ok(sessions.every((s) => s.start >= 3));
  });

  it("rechnet zählende feste Schichten auf die Gesamtzeit an", () => {
    const inp = input(
      12,
      [station("EDDF_TWR", 12)],
      [controller(1, 12, { eligible: [0], fixed: [{ start: 0, end: 4, station: null, counts: true }] })],
      { maxTotalSlots: 6 }
    );
    const { sessions } = solve(inp);
    assert.ok(coverage(inp, sessions)[0] <= 2);
  });

  it("rechnet persönliche Blöcke (Mentor) nicht auf die Gesamtzeit an", () => {
    const inp = input(
      12,
      [station("EDDF_TWR", 12)],
      [controller(1, 12, { eligible: [0], fixed: [{ start: 0, end: 4, station: null, counts: false }] })],
      { maxTotalSlots: 6 }
    );
    const { sessions } = solve(inp);
    assert.ok(coverage(inp, sessions)[0] > 2);
  });
});

describe("Rechenkern: Prioritäten und Wünsche", () => {
  it("besetzt höher priorisierte Stationen zuerst", () => {
    // Eine Person, 2 h Gesamtzeit: reicht nur für eine Station
    const inp = input(
      4,
      [station("EDDF_GND", 4, { priority: 3 }), station("EDDF_TWR", 4, { priority: 1 })],
      [controller(1, 4, { eligible: [0, 1] })],
      { maxTotalSlots: 4 }
    );
    const { sessions } = solve(inp);
    assert.deepEqual(coverage(inp, sessions), [0, 4]);
  });

  it("nimmt für eine höhere Priorität eine Lücke auf vielen niedrigeren in Kauf", () => {
    // Person 1 kann P1 und P5; Person 2 nur P5. P1 muss Person 1 bekommen.
    const inp = input(
      4,
      [station("EDDF_TWR", 4, { priority: 1 }), station("EDDF_DEL", 4, { priority: 5 })],
      [controller(1, 4, { eligible: [0, 1] }), controller(2, 4, { eligible: [1] })]
    );
    const { sessions } = solve(inp);
    assert.deepEqual(coverage(inp, sessions), [4, 4]);
    assert.ok(sessions.filter((s) => s.station === 0).every((s) => s.ctrl === 0));
  });

  it("erfüllt Wünsche, wenn es die Abdeckung nicht kostet", () => {
    const inp = input(
      4,
      [station("EDDF_TWR", 4), station("EDDF_GND", 4)],
      [
        controller(1, 4, { eligible: [0, 1], wishRank: { 1: 0 } }),
        controller(2, 4, { eligible: [0, 1], wishRank: { 0: 0 } }),
      ]
    );
    const { sessions } = solve(inp);
    assert.deepEqual(coverage(inp, sessions), [4, 4]);
    for (const s of sessions) assert.equal(s.station, s.ctrl === 0 ? 1 : 0);
  });

  it("setzt Wünsche nicht über die Abdeckung", () => {
    // Beide wollen TWR, aber GND muss auch besetzt werden
    const inp = input(
      4,
      [station("EDDF_TWR", 4), station("EDDF_GND", 4)],
      [
        controller(1, 4, { eligible: [0, 1], wishRank: { 0: 0 } }),
        controller(2, 4, { eligible: [0, 1], wishRank: { 0: 0 } }),
      ]
    );
    const { sessions } = solve(inp);
    assert.deepEqual(coverage(inp, sessions), [4, 4]);
  });
});

describe("Rechenkern: Ablauf", () => {
  it("rechnet in kurzen Häppchen und meldet Fortschritt", () => {
    const inp = randomInput(7, { slotMinutes: 15, hours: 6, stations: 20, controllers: 50 });
    inp.timeLimitMs = 1500;
    const solver = new RosterSolver(inp);
    let last = -1;
    let maxSlice = 0;
    for (;;) {
      const t0 = Date.now();
      const p = solver.step(20);
      // Die erste Konstruktion darf länger dauern, danach bleibt jedes Häppchen kurz
      if (last >= 0) maxSlice = Math.max(maxSlice, Date.now() - t0);
      assert.ok(p.progress >= last, "Fortschritt geht nicht zurück");
      last = p.progress;
      if (p.done) break;
    }
    assert.equal(last, 1);
    assert.ok(maxSlice < 250, `Häppchen dauerte ${maxSlice} ms`);
  });

  it("ist bei gleichem Seed in der Konstruktion reproduzierbar", () => {
    const inp = randomInput(3, { slotMinutes: 30, hours: 5, stations: 10, controllers: 25 });
    const a = new RosterSolver(inp);
    const b = new RosterSolver(inp);
    a.step(0);
    b.step(0);
    assert.deepEqual(a.result().sessions, b.result().sessions);
  });

  it("wird durch die Suche nicht schlechter als die Konstruktion", () => {
    const inp = randomInput(11, { slotMinutes: 15, hours: 6, stations: 20, controllers: 30 });
    const solver = new RosterSolver(inp);
    solver.step(0);
    const initial = solver.result().score;
    while (!solver.step(50).done) {
      // weiter
    }
    const final = solver.result().score;
    for (let i = 0; i < 5; i++) {
      if (final[i] !== initial[i]) {
        assert.ok(final[i] > initial[i], `Priorität ${i + 1} schlechter geworden`);
        return;
      }
    }
    assert.ok(final[5] >= initial[5] - 1e-9);
  });
});

describe("Rechenkern: zufällige Pläne", () => {
  const cases = [
    { seed: 1, slotMinutes: 30, hours: 4, stations: 8, controllers: 20 },
    { seed: 2, slotMinutes: 15, hours: 6, stations: 25, controllers: 60 },
    { seed: 3, slotMinutes: 15, hours: 6, stations: 25, controllers: 25 },
    { seed: 4, slotMinutes: 10, hours: 3, stations: 6, controllers: 4 },
    { seed: 5, slotMinutes: 30, hours: 8, stations: 12, controllers: 40 },
    { seed: 6, slotMinutes: 15, hours: 5, stations: 15, controllers: 10 },
  ];
  for (const { seed, ...opts } of cases) {
    it(`hält alle harten Grenzen ein (Seed ${seed}, ${opts.stations} Stationen, ${opts.controllers} Personen)`, () => {
      solve(randomInput(seed, opts));
    });
  }
});
