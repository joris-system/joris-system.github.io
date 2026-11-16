/* ═══════════════════════════════════════════════════════════════════════
   JORIS — the costing calculator
   One standard way to cost a tour (the meeting: "costing sheets vary from
   one account manager to the next, and the expenses figure isn't shown
   anywhere"). Lines are priced per person, per group or per single room;
   the sell price is worked out for each group size quoted, with the free
   places, the mark-up and the rounding. Extras are options with their own
   per-person price, never in the base. Pure sums: the page shows them as
   you type, the server saves the same result.
   ═══════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const KINDS = { hotel: 'Hotels', visit: 'Visits', meal: 'Meals', coach: 'Coach', guide: 'Guide', expense: 'Expenses', extra: 'Extras', other: 'Other' };
  const BASES = { pp: 'per person', group: 'per group', single: 'single supplement' };

  const r2 = x => Math.round((+x || 0) * 100) / 100;
  const r1 = x => Math.round((+x || 0) * 10) / 10;
  /* Up to the next step (e.g. €5), never down — rounding is where margin leaks. */
  const roundUp = (x, step) => step > 0 ? Math.ceil(r2(x) / step - 1e-9) * step : r2(x);
  const lineCost = l => r2((+l.unit || 0) * (+l.qty || 0));
  const sum = (list, f) => list.reduce((a, l) => a + f(l), 0);

  function calc(c) {
    c = c || {};
    const bands = (c.bands || []).map(Number).filter(n => n > 0).sort((a, b) => a - b);
    const foc = Math.max(0, +c.foc || 0), markup = +c.markup || 0, step = +c.round || 0;
    const lines = (c.lines || []).filter(l => l && l.label !== undefined);
    const base = lines.filter(l => !l.option), opts = lines.filter(l => l.option);
    const pp = sum(base.filter(l => l.basis === 'pp'), lineCost);
    const group = sum(base.filter(l => l.basis === 'group'), lineCost);
    const single = sum(base.filter(l => l.basis === 'single'), lineCost);
    const kinds = {};
    base.forEach(l => {
      const k = kinds[l.kind || 'other'] || (kinds[l.kind || 'other'] = { pp: 0, group: 0, single: 0 });
      k[l.basis || 'pp'] = r2(k[l.basis || 'pp'] + lineCost(l));
    });
    const out = bands.map(n => {
      const paying = Math.max(1, n - foc);
      const total = pp * n + group;                 // free places use the services too
      const costPP = total / paying;
      const sellPP = roundUp(costPP * (1 + markup / 100), step);
      return { pax: n, paying: paying, total: r2(total), costPP: r2(costPP), sellPP: sellPP, profitPP: r2(sellPP - costPP),
        totalSell: r2(sellPP * paying), totalProfit: r2((sellPP - costPP) * paying), margin: sellPP ? r1(100 * (sellPP - costPP) / sellPP) : 0 };
    });
    const ref = bands.length ? Math.max(1, bands[0] - foc) : 1;
    return {
      bands: out, pp: r2(pp), group: r2(group), kinds: kinds,
      single: { cost: r2(single), sell: roundUp(single * (1 + markup / 100), step) },
      options: opts.map(l => {
        const per = l.basis === 'group' ? lineCost(l) / ref : lineCost(l);
        return { id: l.id, label: l.label, cost: r2(per), sell: roundUp(per * (1 + markup / 100), step) };
      }),
      /* MICE is costed service by service: each line's own sell price. */
      items: base.map(l => ({ id: l.id, label: l.label, kind: l.kind, basis: l.basis, cost: lineCost(l), sell: r2(lineCost(l) * (1 + markup / 100)) }))
    };
  }

  root.JOR_COSTING = { KINDS: KINDS, BASES: BASES, calc: calc, lineCost: lineCost, roundUp: roundUp };
})(typeof window !== 'undefined' ? window : globalThis);
