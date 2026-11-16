/* ═══════════════════════════════════════════════════════════════════════
   JORIS — the money engine
   What a booking is worth, what it costs to walk away from it today and
   when that changes, and what should worry reservations this morning.
   Brought over from the JOR Reservations app, which was built around the
   bills cancellations run up. The server and the pages both run this, so
   the money is worked out in one place only.

   The three rules that matter:
     · an option costs nothing to drop — only confirmed rooms are exposure;
     · a cancellation isn't closed until the hotel acknowledges it, with
       their release reference — until then they can still invoice;
     · closing or losing a file doesn't release its rooms.
   ═══════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  const D = root.JORWF_DATES;
  const diff = (a, b) => D.diffDays(a, b);

  const ROOM_TYPES = [
    { id: 'twin', name: 'Twin', short: 'Twin', sleeps: 2 },
    { id: 'double', name: 'Double', short: 'Dbl', sleeps: 2 },
    { id: 'single', name: 'Single', short: 'Sg.', sleeps: 1 },
    { id: 'triple', name: 'Triple', short: 'Tpl', sleeps: 3 }
  ];

  /* Cancellation terms a hotel can be on. Each tier: within `from` days of
     arrival it costs `pct` % of the booking. A hotel's own terms are kept
     with the hotel; a booking keeps the terms it was made on. */
  const TERMS = {
    std60: { name: 'Standard group — free to 60 days', tiers: [{ from: 60, pct: 25 }, { from: 30, pct: 50 }, { from: 14, pct: 100 }] },
    city45: { name: 'City hotel — free to 45 days', tiers: [{ from: 45, pct: 30 }, { from: 21, pct: 60 }, { from: 10, pct: 100 }] },
    lux90: { name: 'Luxury / castle — free to 90 days', tiers: [{ from: 90, pct: 25 }, { from: 60, pct: 50 }, { from: 45, pct: 100 }] },
    peak120: { name: 'Peak block — free to 120 days', tiers: [{ from: 120, pct: 20 }, { from: 90, pct: 40 }, { from: 60, pct: 75 }, { from: 45, pct: 100 }] },
    soft30: { name: 'Soft terms — free to 30 days', tiers: [{ from: 30, pct: 25 }, { from: 14, pct: 50 }, { from: 5, pct: 100 }] },
    strict: { name: 'Non-refundable from confirmation', tiers: [{ from: 9999, pct: 100 }] }
  };

  const POLICY = { rooming: [90, 60, 30], ackChaseDays: 3, ackCriticalDays: 7, warnDays: 14, requestPickupDays: 2 };

  function roomCount(r) { let n = 0; for (const k in (r || {})) n += +r[k] || 0; return n; }
  function bedCount(r) { let n = 0; ROOM_TYPES.forEach(t => { n += (+(r || {})[t.id] || 0) * t.sleeps; }); return n; }
  function roomsText(r) {
    const out = [];
    ROOM_TYPES.forEach(t => { if (+(r || {})[t.id]) out.push(r[t.id] + ' ' + t.name.toLowerCase()); });
    return out.length ? out.join(', ') : 'no rooms';
  }
  function nights(b) { return b.checkIn && b.checkOut ? Math.max(0, diff(b.checkIn, b.checkOut)) : 0; }

  /* A room's rate from the pink sheet's per-person-sharing rate and the
     single supplement. */
  function roomRate(b, type) {
    const p = +b.ppn || 0, s = +b.ssupp || 0;
    if (type === 'single') return p + s;
    if (type === 'triple') return 3 * p;
    return 2 * p;
  }
  function value(b) {
    let total = 0;
    const n = nights(b);
    ROOM_TYPES.forEach(t => { total += (+(b.rooms || {})[t.id] || 0) * roomRate(b, t.id) * n; });
    return Math.round(total * 100) / 100;
  }

  function termsOf(b) { return b && b.terms && b.terms.tiers ? b.terms : null; }
  /* A tier bites on the day it names, not the day after — the cautious reading. */
  function penaltyPct(terms, daysOut) {
    let pct = 0;
    ((terms && terms.tiers) || []).forEach(t => { if (daysOut <= t.from) pct = Math.max(pct, t.pct); });
    return pct;
  }
  function nextStep(terms, daysOut) {
    let best = null;
    ((terms && terms.tiers) || []).forEach(t => { if (t.from < daysOut && (!best || t.from > best.from)) best = t; });
    return best ? { from: best.from, pct: best.pct, inDays: daysOut - best.from } : null;
  }
  /* Every date this booking's price of walking away changes. */
  function ladder(b) {
    const t = termsOf(b), v = value(b);
    if (!t) return [];
    return t.tiers.slice().sort((a, c) => c.from - a.from).map(x => ({
      on: x.from > 3000 ? (b.bookedAt || '').slice(0, 10) : D.addDays(b.checkIn, -x.from), pct: x.pct, amount: Math.round(v * x.pct) / 100, from: x.from
    }));
  }

  const LIVE = { provisional: 1, confirmed: 1 };
  const STATUS = {
    provisional: 'On option', confirmed: 'Confirmed', cancelled: 'Cancelled — not acknowledged',
    released: 'Released', expired: 'Option lapsed'
  };

  /* Everything about one booking, as of today. */
  function state(b, today) {
    const t = termsOf(b), daysOut = diff(today, b.checkIn), v = value(b);
    const pct = penaltyPct(t, daysOut), step = nextStep(t, daysOut);
    if (step) step.on = D.addDays(b.checkIn, -step.from);
    const c = b.cancel || {};
    const unproven = b.status === 'cancelled' && !c.ackAt;
    const chargeable = unproven || (b.status === 'confirmed' && daysOut >= 0);
    const exposure = chargeable ? Math.round(v * pct) / 100 : 0;
    const nextExposure = chargeable ? (step ? Math.round(v * step.pct) / 100 : exposure) : 0;
    return {
      daysOut: daysOut, nights: nights(b), value: v, live: !!LIVE[b.status], unproven: unproven, chargeable: chargeable,
      pct: pct, exposure: exposure, step: step, nextExposure: nextExposure, stepJump: Math.round((nextExposure - exposure) * 100) / 100,
      rooms: roomCount(b.rooms), beds: bedCount(b.rooms), past: daysOut < 0, noRate: !(+b.ppn > 0), noTerms: !t,
      optionDays: b.status === 'provisional' && b.optionDate ? diff(today, b.optionDate) : null,
      ackDays: c.sentAt && !c.ackAt ? diff(String(c.sentAt).slice(0, 10), today) : null
    };
  }

  const FILE_DEAD = { lost: 1, cancelled: 1 };
  function fileState(f, bookings, today) {
    const mine = bookings.filter(b => b.ref === f.ref);
    let exposure = 0, confirmedValue = 0, heldValue = 0, liveRooms = 0, liveCount = 0, provCount = 0, nextOn = '', nextJump = 0;
    mine.forEach(b => {
      const s = state(b, today);
      exposure += s.exposure;
      if (s.live) {
        liveRooms += s.rooms; liveCount++;
        if (b.status === 'provisional') { heldValue += s.value; provCount++; } else confirmedValue += s.value;
      }
      if (s.chargeable && s.step && s.stepJump > 0 && (!nextOn || s.step.on < nextOn)) { nextOn = s.step.on; nextJump = s.stepJump; }
    });
    return { bookings: mine, exposure: Math.round(exposure * 100) / 100, confirmedValue: confirmedValue, heldValue: heldValue, liveRooms: liveRooms,
      liveCount: liveCount, provCount: provCount, nextOn: nextOn, nextJump: nextJump, dead: !!FILE_DEAD[f.status], daysOut: f.arrival ? diff(today, f.arrival) : null };
  }

  /* The account manager's outline itinerary, night by night, becomes the
     accommodation request's lines: one line per run of nights in the same
     town, hotel and basis. Nothing typed twice. */
  function linesFromDays(days, rooms, star) {
    const out = [];
    (days || []).filter(d => d && d.date && d.town).slice().sort((a, b) => a.date < b.date ? -1 : 1).forEach(d => {
      const last = out[out.length - 1];
      const same = last && last.to === d.date && last.town.toLowerCase() === String(d.town).toLowerCase() && (last.hotel || '') === (d.hotel || '') && (last.basis || '') === (d.basis || '');
      if (same) last.to = D.addDays(d.date, 1);
      else out.push({ from: d.date, to: D.addDays(d.date, 1), town: String(d.town), hotel: d.hotel || '', basis: d.basis || '', rooms: Object.assign({}, rooms || {}), standard: star || '', notes: d.notes || '' });
    });
    return out;
  }

  /* What was asked for against what was secured, night by night and town by town. */
  function shortfall(req, bookings) {
    const want = {}, got = {}, label = {};
    (req.lines || []).forEach(l => {
      if (!l.from || !l.to) return;
      for (let d = l.from; d < l.to; d = D.addDays(d, 1)) {
        const k = String(l.town || '').toLowerCase() + '|' + d;
        want[k] = (want[k] || 0) + roomCount(l.rooms);
        label[k] = l.town;
      }
    });
    bookings.filter(b => b.ref === req.ref && LIVE[b.status]).forEach(b => {
      for (let d = b.checkIn; d < b.checkOut; d = D.addDays(d, 1)) {
        const k = String(b.town || '').toLowerCase() + '|' + d;
        got[k] = (got[k] || 0) + roomCount(b.rooms);
      }
    });
    const out = [];
    Object.keys(want).sort((a, b) => a.split('|')[1] < b.split('|')[1] ? -1 : 1).forEach(k => {
      const [town, d] = k.split('|');
      if ((got[k] || 0) < want[k]) out.push({ town: label[k] || town, date: d, want: want[k], got: got[k] || 0 });
    });
    return out;
  }
  /* How far a request has got: nights secured against nights asked for, in tens. */
  function progressOf(req, bookings) {
    let want = 0, short = 0;
    (req.lines || []).forEach(l => { if (l.from && l.to) want += roomCount(l.rooms) * Math.max(0, diff(l.from, l.to)); });
    shortfall(req, bookings).forEach(s => { short += s.want - s.got; });
    if (!want) return 0;
    return Math.max(0, Math.min(100, Math.floor(10 * (want - short) / want) * 10));
  }

  /* What should worry reservations today: one list, each with who it is
     for (never a shared list), how serious, when and the euro at stake. */
  const SEV = { critical: 0, high: 1, medium: 2, low: 3 };
  function issues(data, today, policy) {
    const P = Object.assign({}, POLICY, policy || {});
    const files = {}, agents = {}, out = [];
    (data.files || []).forEach(f => { files[f.ref] = f; });
    (data.agents || []).forEach(a => { agents[a.key] = a; });
    const fmt = d => D.nice(d);
    const ownerOf = (b, f) => (f && agentSelf(f) ? f.am : b.bookedBy) || (f && f.am) || P.resLead || '';
    const agentSelf = f => { const a = agents[f.agentKey]; return !!(a && a.selfBook === 'yes'); };
    const add = o => out.push(o);
    (data.bookings || []).forEach(b => {
      const f = files[b.ref];
      if (!f) return;
      const s = state(b, today), who = ownerOf(b, f);
      if (s.live && !s.past && FILE_DEAD[f.status]) add({ kind: 'dead-file-live-rooms', sev: 'critical', ref: b.ref, booking: b.id, who: who,
        title: 'Rooms still held on a ' + f.status + ' file', detail: b.hotel + ' — ' + s.rooms + ' rooms from ' + fmt(b.checkIn) + '. The file is ' + f.status + ' but this booking was never released.', money: s.exposure, when: b.checkIn });
      if (b.status === 'cancelled' && s.ackDays !== null && s.ackDays >= P.ackChaseDays) add({ kind: 'cancel-unacknowledged', sev: s.ackDays >= P.ackCriticalDays ? 'critical' : 'high', ref: b.ref, booking: b.id, who: who,
        title: 'Cancellation never acknowledged', detail: b.hotel + ' — sent ' + s.ackDays + ' days ago, no release reference. Until they answer they can still bill it.', money: s.exposure, when: String(b.cancel.sentAt).slice(0, 10) });
      if (!s.live || s.past) return;
      if (b.status === 'provisional' && b.optionDate && s.optionDays <= 7) add({ kind: s.optionDays < 0 ? 'option-lapsed' : 'option-expiring', sev: s.optionDays <= 2 ? 'high' : 'medium', ref: b.ref, booking: b.id, who: who,
        title: s.optionDays < 0 ? 'Option lapsed — the rooms may be gone' : 'Option ends ' + (s.optionDays === 0 ? 'today' : 'in ' + s.optionDays + ' day' + (s.optionDays === 1 ? '' : 's')),
        detail: b.hotel + ' — ' + s.rooms + ' rooms held to ' + fmt(b.optionDate) + '. Confirm it or let it go.', money: 0, when: b.optionDate });
      if (s.chargeable && s.step && s.step.inDays <= P.warnDays && s.stepJump > 0) add({ kind: s.pct === 0 ? 'free-window-closing' : 'penalty-step', sev: s.step.inDays <= 3 ? 'high' : s.step.inDays <= 7 ? 'medium' : 'low', ref: b.ref, booking: b.id, who: who,
        title: s.pct === 0 ? 'Free cancellation ends ' + fmt(s.step.on) : 'Cancelling goes up to ' + s.step.pct + '% on ' + fmt(s.step.on),
        detail: b.hotel + ' — walking away goes from €' + s.exposure.toLocaleString('en-IE') + ' to €' + s.nextExposure.toLocaleString('en-IE') + '.', money: s.stepJump, when: s.step.on });
      if (b.status === 'confirmed' && !b.tp) add({ kind: 'not-on-tourplan', sev: s.daysOut <= 45 ? 'high' : 'medium', ref: b.ref, booking: b.id, who: who,
        title: 'Not entered on Tourplan', detail: b.hotel + ' — confirmed (' + (b.confRef || 'no ref') + ') but not ticked as entered on Tourplan.', money: 0, when: (b.confirmedAt || '').slice(0, 10) });
      if (b.status === 'confirmed' && s.noTerms) add({ kind: 'no-terms', sev: 'high', ref: b.ref, booking: b.id, who: who,
        title: 'No cancellation terms', detail: b.hotel + ' — confirmed with nothing recorded about what it costs to cancel.', money: s.value, when: (b.confirmedAt || '').slice(0, 10) });
      if (s.noRate) add({ kind: 'no-rate', sev: 'medium', ref: b.ref, booking: b.id, who: who,
        title: 'No PP/PN rate written down', detail: b.hotel + ' — the costing can’t use it and its value shows as nothing.', money: 0, when: b.checkIn });
    });
    (data.files || []).forEach(f => {
      if (f.status !== 'confirmed' || !f.arrival) return;
      const fs = fileState(f, data.bookings || [], today);
      if (fs.provCount && fs.daysOut <= 75 && fs.daysOut >= 0) {
        const b = fs.bookings.find(x => x.status === 'provisional');
        add({ kind: 'confirmed-file-provisional-rooms', sev: fs.daysOut <= 40 ? 'high' : 'medium', ref: f.ref, who: ownerOf(b, f),
          title: fs.provCount + ' booking' + (fs.provCount === 1 ? '' : 's') + ' still on option on a confirmed file', detail: f.agent + ' arrives ' + fmt(f.arrival) + '. The client is confirmed; these rooms aren’t.', money: 0, when: f.arrival });
      }
      /* The rooming list asked for at each milestone — unless operations have ticked it gone to the hotels. */
      const rooming = f.rooming || {};
      P.rooming.forEach(m => {
        const due = D.addDays(f.arrival, -m), d = diff(today, due);
        if (rooming[m] || f.roomingSent || d > 10 || fs.daysOut < 0) return;
        add({ kind: 'rooming-due', sev: d < 0 ? 'high' : d <= 3 ? 'medium' : 'low', ref: f.ref, who: f.am || '', milestone: m,
          title: m + '-day rooming list ' + (d < 0 ? 'overdue' : 'due ' + fmt(due)), detail: f.agent + ' — from the client, then to ' + (fs.liveCount || 'the') + ' hotel' + (fs.liveCount === 1 ? '' : 's') + ' through Tourplan.', money: 0, when: due });
      });
    });
    (data.requests || []).forEach(r => {
      const f = files[r.ref];
      if (!f || r.status === 'complete' || r.status === 'cancelled' || r.status === 'draft') return;
      const age = r.sentAt ? diff(String(r.sentAt).slice(0, 10), today) : 0;
      if (r.status === 'sent' && age >= P.requestPickupDays) add({ kind: 'request-unopened', sev: age >= 5 ? 'high' : 'medium', ref: r.ref, request: r.id, who: r.to || P.resLead || '',
        title: 'Accommodation request not picked up', detail: f.agent + ' — sent ' + age + ' days ago and not opened in reservations.', money: 0, when: String(r.sentAt).slice(0, 10) });
      if (r.status === 'open' && f.arrival && diff(today, f.arrival) <= 90) {
        const short = shortfall(r, data.bookings || []);
        if (short.length) add({ kind: 'rooms-short', sev: diff(today, f.arrival) <= 45 ? 'high' : 'medium', ref: r.ref, request: r.id, who: r.openedBy || P.resLead || '',
          title: 'Rooms secured don’t match the request', detail: short.slice(0, 3).map(x => x.town + ' ' + fmt(x.date) + ': ' + x.got + ' of ' + x.want).join('; ') + (short.length > 3 ? '…' : ''), money: 0, when: f.arrival });
      }
    });
    out.sort((a, b) => (SEV[a.sev] - SEV[b.sev]) || (b.money - a.money) || (a.when < b.when ? -1 : 1));
    return out;
  }

  root.JOR_ENGINE = { ROOM_TYPES, TERMS, POLICY, LIVE, STATUS, SEV, roomCount, bedCount, roomsText, nights, roomRate, value, penaltyPct, nextStep, ladder, state, fileState, linesFromDays, shortfall, progressOf, issues };
})(typeof window !== 'undefined' ? window : globalThis);
