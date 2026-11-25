/* ═══════════════════════════════════════════════════════════════════════
   JOR Workflow — dates
   Every date the process can work out for itself: Irish public holidays,
   working days, the office-hours rule for anything that arrives late, and
   the timing rules on each step ("5 working days after the proposal").
   No drawing and no storage here, so the same file runs in Node tests.
   Dates are 'YYYY-MM-DD' strings in Irish local time; times are 'HH:MM'.
   ═══════════════════════════════════════════════════════════════════════ */

(function (root) {
  'use strict';

  const pad = n => String(n).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  /* Noon keeps the clock-change weekends from moving a date by a day. */
  const parse = s => { const p = String(s).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2], 12); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const addMonths = (s, n) => {
    const d = parse(s), day = d.getDate();
    d.setDate(1); d.setMonth(d.getMonth() + n);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0, 12).getDate();
    d.setDate(Math.min(day, last));
    return iso(d);
  };
  const dow = s => parse(s).getDay();
  const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);

  /* Easter Sunday, the anonymous Gregorian method. */
  function easter(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return iso(new Date(y, month - 1, day, 12));
  }

  /* First Monday of a month (m is 1-12), or the last one when last is true. */
  function monday(y, m, last) {
    if (last) {
      const d = new Date(y, m, 0, 12);
      while (d.getDay() !== 1) d.setDate(d.getDate() - 1);
      return iso(d);
    }
    const d = new Date(y, m - 1, 1, 12);
    while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
    return iso(d);
  }

  /* The ten Irish public holidays. When one of the fixed dates lands on a
     weekend the office takes the next weekday instead, the way the banks
     do; that day is listed as "in lieu". */
  const holCache = {};
  function holidays(y) {
    if (holCache[y]) return holCache[y];
    const feb1 = y + '-02-01';
    const list = [
      { date: y + '-01-01', name: "New Year's Day", fixed: true },
      { date: dow(feb1) === 5 ? feb1 : monday(y, 2), name: "St Brigid's Day" },
      { date: y + '-03-17', name: "St Patrick's Day", fixed: true },
      { date: addDays(easter(y), 1), name: 'Easter Monday' },
      { date: monday(y, 5), name: 'May bank holiday' },
      { date: monday(y, 6), name: 'June bank holiday' },
      { date: monday(y, 8), name: 'August bank holiday' },
      { date: monday(y, 10, true), name: 'October bank holiday' },
      { date: y + '-12-25', name: 'Christmas Day', fixed: true },
      { date: y + '-12-26', name: "St Stephen's Day", fixed: true }
    ];
    const taken = new Set(list.map(h => h.date));
    list.filter(h => h.fixed && (dow(h.date) === 0 || dow(h.date) === 6)).forEach(h => {
      let d = addDays(h.date, 1);
      while (dow(d) === 0 || dow(d) === 6 || taken.has(d)) d = addDays(d, 1);
      taken.add(d);
      list.push({ date: d, name: h.name + ' (in lieu)', lieu: true });
    });
    list.sort((a, b) => a.date < b.date ? -1 : 1);
    return (holCache[y] = list);
  }

  function holidayOn(s) {
    const y = +String(s).slice(0, 4);
    return holidays(y).find(h => h.date === s) || null;
  }

  /* cfg.closed: extra days the office is shut, as dates or {date, name}. */
  function closedOn(s, cfg) {
    const c = (cfg && cfg.closed) || [];
    for (const x of c) {
      const d = typeof x === 'string' ? x : x.date;
      if (d === s) return typeof x === 'string' ? { date: s, name: 'Office closed' } : x;
    }
    return null;
  }

  function whyNot(s, cfg) {
    const w = dow(s);
    if (w === 0 || w === 6) return w === 0 ? 'Sunday' : 'Saturday';
    const h = holidayOn(s);
    if (h) return h.name;
    const c = closedOn(s, cfg);
    if (c) return c.name || 'Office closed';
    return '';
  }
  const isWorking = (s, cfg) => !whyNot(s, cfg);

  function nextWorking(s, cfg) { let d = s; let g = 0; while (!isWorking(d, cfg) && g++ < 40) d = addDays(d, 1); return d; }
  function prevWorking(s, cfg) { let d = s; let g = 0; while (!isWorking(d, cfg) && g++ < 40) d = addDays(d, -1); return d; }

  /* n working days on from s. Zero means "that day, or the next working one". */
  function addWorking(s, n, cfg) {
    let d = s, left = Math.abs(n), step = n < 0 ? -1 : 1, g = 0;
    if (!n) return nextWorking(s, cfg);
    while (left > 0 && g++ < 5000) { d = addDays(d, step); if (isWorking(d, cfg)) left--; }
    return d;
  }

  function workingBetween(a, b, cfg) {
    if (a === b) return 0;
    const sign = a < b ? 1 : -1;
    let d = a, n = 0, g = 0;
    while (d !== b && g++ < 5000) { d = addDays(d, sign); if (isWorking(d, cfg)) n += sign; }
    return n;
  }

  const toMin = t => { const m = /^(\d{1,2}):(\d{2})/.exec(String(t || '')); return m ? (+m[1]) * 60 + (+m[2]) : null; };

  /* When something that arrived at date+time counts as received. An email
     after closing time, at the weekend or on a holiday counts from the
     start of the next working day. */
  function received(date, time, cfg) {
    const open = (cfg && cfg.open) || '09:00', close = (cfg && cfg.close) || '17:30';
    const t = toMin(time);
    if (!isWorking(date, cfg)) {
      return { date: nextWorking(date, cfg), time: open, moved: true, why: whyNot(date, cfg) };
    }
    if (t != null && t >= toMin(close)) {
      return { date: addWorking(date, 1, cfg), time: open, moved: true, why: 'after ' + close };
    }
    if (t != null && t < toMin(open)) {
      return { date: date, time: open, moved: true, why: 'before ' + open };
    }
    return { date: date, time: time || '', moved: false, why: '' };
  }

  /* ── Timing rules ────────────────────────────────────────────────────
     A rule reads: n units after/before an anchor.
       unit  'wd' working days · 'd' days · 'w' weeks · 'm' months
       dir   1 after · -1 before
       from  'enquiry' | 'arrival' | 'departure' | 'step:<id>'
     A calendar-day rule that lands on a day the office is shut moves to
     the working day before it when it counts back to a deadline, and the
     one after when it counts forward.                                     */
  const UNITS = { wd: ['working day', 'working days'], d: ['day', 'days'], w: ['week', 'weeks'], m: ['month', 'months'] };

  function applyRule(anchorDate, rule, cfg) {
    const n = Math.max(0, Math.round(+rule.n || 0)), dir = rule.dir < 0 ? -1 : 1;
    let d, rolled = '';
    if (rule.unit === 'wd') d = addWorking(anchorDate, dir * n, cfg);
    else {
      d = rule.unit === 'm' ? addMonths(anchorDate, dir * n) : addDays(anchorDate, dir * n * (rule.unit === 'w' ? 7 : 1));
      if (!isWorking(d, cfg)) {
        rolled = whyNot(d, cfg);
        d = dir < 0 ? prevWorking(d, cfg) : nextWorking(d, cfg);
      }
    }
    return { date: d, rolled: rolled };
  }

  function ruleText(rule, nameOf) {
    if (!rule || !rule.from) return '';
    const n = Math.max(0, Math.round(+rule.n || 0));
    const u = UNITS[rule.unit] || UNITS.d;
    const anchor = rule.from === 'enquiry' ? 'the enquiry comes in'
      : rule.from === 'arrival' ? 'arrival'
      : rule.from === 'departure' ? 'departure'
      : (nameOf ? '“' + nameOf(rule.from.slice(5)) + '”' : 'another step');
    if (!n) return rule.from.startsWith('step:') ? 'Same day as ' + anchor : 'On the day of ' + anchor;
    return n + ' ' + (n === 1 ? u[0] : u[1]) + (rule.dir < 0 ? ' before ' : ' after ') + anchor;
  }

  /* Work out every step's date for one file.
     input: { enquiry:{date,time}, arrival:'YYYY-MM-DD', nights:n, actual:{stepId:date} }
     Returns { stepId: {date, how, rolled, from, err} }.                  */
  function plan(steps, input, cfg) {
    const byId = {}; steps.forEach(s => { byId[s.id] = s; });
    const out = {}, busy = {};
    const rec = input.enquiry && input.enquiry.date ? received(input.enquiry.date, input.enquiry.time, cfg) : null;
    const anchors = {
      enquiry: rec ? rec.date : null,
      arrival: isDate(input.arrival) ? input.arrival : null,
      departure: isDate(input.arrival) ? addDays(input.arrival, Math.max(0, +input.nights || 0)) : null
    };
    function dateOf(id) {
      if (out[id]) return out[id];
      const s = byId[id];
      if (!s) return (out[id] = { err: 'missing' });
      const act = input.actual && input.actual[id];
      if (isDate(act)) return (out[id] = { date: act, how: 'actual' });
      const r = s.when;
      if (!r || !r.from) return (out[id] = { err: 'norule' });
      if (busy[id]) return { err: 'loop' };
      busy[id] = true;
      let base;
      if (r.from.startsWith('step:')) {
        const up = dateOf(r.from.slice(5));
        base = up && up.date;
        if (!base) { busy[id] = false; return (out[id] = { err: up && up.err === 'loop' ? 'loop' : 'waits', from: r.from }); }
      } else {
        base = anchors[r.from];
        if (!base) { busy[id] = false; return (out[id] = { err: 'needs:' + r.from, from: r.from }); }
      }
      const res = applyRule(base, r, cfg);
      busy[id] = false;
      return (out[id] = { date: res.date, rolled: res.rolled, how: 'rule', from: r.from, base: base });
    }
    steps.forEach(s => dateOf(s.id));
    return { steps: out, anchors: anchors, received: rec };
  }

  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function nice(s, withYear) {
    if (!isDate(s)) return '';
    const d = parse(s);
    return WD[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()] + (withYear ? ' ' + d.getFullYear() : '');
  }

  function today() { return iso(new Date()); }

  root.JORWF_DATES = {
    iso, parse, addDays, addMonths, dow, isDate, diffDays, easter, holidays, holidayOn, whyNot,
    isWorking, nextWorking, prevWorking, addWorking, workingBetween, received, applyRule,
    ruleText, plan, nice, today, UNITS, MON, WD
  };
})(typeof window !== 'undefined' ? window : globalThis);
