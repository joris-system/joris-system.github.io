/* ═══════════════════════════════════════════════════════════════════════
   JORIS — the RFP register
   The board (every file, filtered), one file in the side panel, registering
   a new RFP, and the dashboard for management. Everything goes through the
   server, which checks who may do what; this page only hides buttons.
   ═══════════════════════════════════════════════════════════════════════ */
(async function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = UI.esc, I = UI.icon, RU = window.JOR_RULES, D = window.JORWF_DATES;
  const me = await JOR.me();
  UI.topBar('RFP register', 'JORIS', me);
  const can = (perm, f) => RU.can(Object.assign({}, me, { status: 'active' }), perm, f);

  let data = { files: [], people: [], agents: [], today: D.today() };
  let view = location.hash === '#dashboard' && me.perms['register.dashboard'] ? 'dashboard' : 'board';
  const filt = { q: '', status: 'open', am: '', year: '' };
  let openRef = null, lastFile = null;

  /* Closing a file, or marking it lost or cancelled, may wait for a sign-off (Settings). */
  const SIGN_OFF = { closed: 1, lost: 1, cancelled: 1 };
  const canSignoff = () => me.role === 'management' || !!(data.signer && data.signer.id === me.id);
  const needsSignoff = to => !!(data.signer && SIGN_OFF[to] && me.id !== data.signer.id && me.role !== 'management');
  const person = id => data.people.find(p => p.id === id);
  const nameOf = id => (person(id) || {}).name || '';
  const ams = () => data.people.filter(p => ['account', 'management', 'operations'].includes(p.role));
  const keyOf = s => String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').replace(/\b(ltd|limited|sa|sarl|gmbh|inc|llc|the)\b/g, '').trim();

  async function load() {
    const r = await JOR.call('register.list');
    JOR.keep('register.list', null, r);
    data = r;
  }

  /* ══ Tabs ═══════════════════════════════════════════════════════════ */
  function tabs() {
    const t = [['board', 'Board']].concat(me.perms['register.dashboard'] ? [['dashboard', 'Dashboard']] : []);
    $('#tabs').innerHTML = t.map(x => '<button data-tab="' + x[0] + '" class="' + (view === x[0] ? 'on' : '') + '">' + x[1] + '</button>').join('');
    if (me.perms['register.create']) { $('#new').classList.remove('hidden'); $('#new').innerHTML = I('plus', 'sm') + 'Register an RFP'; }
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; view = b.dataset.tab; history.replaceState(null, '', view === 'dashboard' ? '#dashboard' : '#'); render(); });

  function render() { tabs(); if (view === 'dashboard') dashboard(); else board(); }

  /* ══ The board ══════════════════════════════════════════════════════ */
  function board() {
    const years = [...new Set(data.files.map(f => f.year))].sort();
    let list = data.files.slice();
    if (filt.status === 'open') list = list.filter(f => RU.OPEN[f.status]);
    else if (filt.status === 'signoff') list = list.filter(f => f.pending);
    else if (filt.status !== 'all') list = list.filter(f => f.status === filt.status);
    if (filt.am === 'mine') list = list.filter(f => f.am === me.id);
    else if (filt.am === 'none') list = list.filter(f => !f.am);
    else if (filt.am) list = list.filter(f => f.am === filt.am);
    if (filt.year) list = list.filter(f => f.year === filt.year);
    if (filt.q) {
      const q = filt.q.toLowerCase().replace(/\s+/g, ' ');
      list = list.filter(f => (f.ref + ' ' + RU.refName(f.ref) + ' ' + f.agent + ' ' + f.contact + ' ' + f.contactEmail + ' ' + f.country + ' ' + f.notes).toLowerCase().includes(q));
    }
    list.sort((a, b) => (b.received || b.registered) < (a.received || a.registered) ? -1 : 1);
    const unassigned = list.filter(f => RU.OPEN[f.status] && !f.am).length;
    const overdue = list.filter(f => f.followUp && f.followUp < data.today).length;

    $('#view').innerHTML = signoffPanel() + '<div class="bar">' +
      '<input class="in srch" id="q" placeholder="Reference, agent, contact, email…" value="' + esc(filt.q) + '">' +
      '<select class="in" id="fs">' + UI.options([['open', 'Open (enquiry or quoted)'], ['enquiry', 'Enquiry'], ['quoted', 'Quoted'], ['confirmed', 'Confirmed'], ['lost', 'Lost'], ['cancelled', 'Cancelled'], ['closed', 'Closed'], ['signoff', 'Waiting for sign-off'], ['all', 'Everything']], filt.status) + '</select>' +
      '<select class="in" id="fa">' + UI.options([['', 'Every account manager'], ['mine', 'Mine'], ['none', 'Not assigned']].concat(ams().map(p => [p.id, p.name])), filt.am) + '</select>' +
      '<select class="in" id="fy">' + UI.options([['', 'Every travel year']].concat(years.map(y => [y, '20' + y])), filt.year) + '</select></div>' +
      '<div class="count">' + list.length + ' file' + (list.length === 1 ? '' : 's') + (unassigned ? ' · <b style="color:var(--warn)">' + unassigned + ' not assigned</b>' : '') +
      (overdue ? ' · <b style="color:var(--err)">' + overdue + ' follow-up' + (overdue === 1 ? '' : 's') + ' overdue</b>' : '') + '</div>' +
      '<div class="card tw">' + (list.length ? '<table class="t"><thead><tr><th>Ref</th><th>Came in</th><th>Agent</th><th>Ctry</th><th class="num">Pax</th><th>Travel</th>' +
        '<th>Account manager</th><th>Status</th><th>Next follow-up</th><th>Checklist</th></tr></thead><tbody>' + list.map(row).join('') + '</tbody></table>'
        : '<div class="empty">' + (data.files.length ? 'Nothing matches.' : 'No RFPs yet. ' + (me.perms['register.create'] ? 'Register the first with the button above.' : '')) + '</div>') + '</div>';
    const q = $('#q');
    q.addEventListener('input', () => { filt.q = q.value; clearTimeout(q._t); q._t = setTimeout(() => { const pos = q.selectionStart; board(); const n = $('#q'); n.focus(); n.setSelectionRange(pos, pos); }, 200); });
    $('#fs').addEventListener('change', e => { filt.status = e.target.value; board(); });
    $('#fa').addEventListener('change', e => { filt.am = e.target.value; board(); });
    $('#fy').addEventListener('change', e => { filt.year = e.target.value; board(); });
    $('#view').querySelectorAll('[data-sok],[data-sback]').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      signoff(data.files.find(f => f.ref === (b.dataset.sok || b.dataset.sback)), !!b.dataset.sok);
    }));
  }

  /* Iain's waiting list: everything asked to be closed, lost or cancelled, to confirm or send back. */
  function signoffPanel() {
    const waiting = canSignoff() ? data.files.filter(f => f.pending) : [];
    if (!waiting.length) return '';
    return '<div class="card pad" style="margin-bottom:14px" id="signoffs"><h3 style="margin:0 0 6px">' + I('check', 'sm') + 'Waiting for your sign-off · ' + waiting.length + '</h3>' +
      '<p class="mini" style="margin:0 0 8px">Nothing changes until you confirm. Send one back to say what else to try.</p>' +
      waiting.map(f => '<div class="log"><span style="flex:1"><b class="clk" style="cursor:pointer" data-open="' + esc(f.ref) + '">' + esc(f.ref) + ' ' + esc(f.agent) + '</b> — ' + esc(RU.STATUS[f.pending.to].t.toLowerCase()) +
        (f.pending.reason ? ': “' + esc(f.pending.reason) + '”' : '') + ' <span class="mini">asked by ' + esc(nameOf(f.pending.by)) + ', ' + esc(UI.nice(String(f.pending.at).slice(0, 10))) + '</span></span>' +
        '<button class="btn sm" data-sback="' + esc(f.ref) + '">Send back</button><button class="btn sm p" data-sok="' + esc(f.ref) + '">Confirm</button></div>').join('') + '</div>';
  }
  /* Confirm: it goes through as asked. Send back: it stays as it was, with a note to whoever asked. */
  async function signoff(f, ok) {
    if (!f || !f.pending) return;
    const what = RU.STATUS[f.pending.to].t.toLowerCase();
    if (ok) {
      try {
        const r = await JOR.call('register.signoff', { ref: f.ref, rev: f.rev, ok: true });
        await refresh(f.ref, f.ref + ' signed off: ' + what + '.');
        if (r.liveBookings) releasePrompt(f, r.liveBookings);
      } catch (e) {
        if (/close it anyway/.test(e.message)) return forceClose(f, e.message);
        if (e.stale) await refresh(f.ref);
        UI.toast(e.message, 6000);
      }
      return;
    }
    UI.dialog({
      title: f.ref + ' — not signed off as ' + what,
      body: UI.field('Why does it go back?', '<textarea class="in" name="why" data-focus placeholder="e.g. Try them once more — they were keen in September"></textarea>', esc(nameOf(f.pending.by)) + ' sees this on their list, and by email.') + '<div class="err" data-err></div>',
      foot: '<button class="btn" data-x>Cancel</button><button class="btn p" data-ok>Send it back</button>',
      on: (el, close) => el.querySelector('[data-ok]').addEventListener('click', async () => {
        try { await JOR.call('register.signoff', { ref: f.ref, rev: f.rev, ok: false, note: el.querySelector('[name=why]').value }); close(); await refresh(f.ref, 'Sent back to ' + nameOf(f.pending.by) + '.'); }
        catch (e) { el.querySelector('[data-err]').textContent = e.message; }
      })
    });
  }
  /* Management signing off a close with something still owed: only with a reason. */
  function forceClose(f, why) {
    UI.dialog({
      title: f.ref + ' — close it anyway?',
      body: '<p>' + esc(why) + '</p>' + UI.field('Why close it now?', '<textarea class="in" name="why" data-focus placeholder="e.g. The hotel billed the client directly"></textarea>', 'Kept in the log with what was outstanding.') + '<div class="err" data-err></div>',
      foot: '<button class="btn" data-x>Cancel</button><button class="btn dngr" data-ok>Close it anyway</button>',
      on: (el, close) => el.querySelector('[data-ok]').addEventListener('click', async () => {
        try { await JOR.call('register.signoff', { ref: f.ref, rev: f.rev, ok: true, force: true, reason: el.querySelector('[name=why]').value }); close(); await refresh(f.ref, f.ref + ' closed.'); }
        catch (e) { el.querySelector('[data-err]').textContent = e.message; }
      })
    });
  }

  function travel(f) {
    if (f.arrival) return UI.nice(f.arrival, true) + (f.departure ? ' – ' + UI.nice(f.departure) : '') + (f.nights ? ' <span class="mini">' + f.nights + 'n</span>' : '');
    return '<span class="mini">20' + esc(f.year) + '</span>';
  }
  function dots(f) {
    return '<span class="dots">' + RU.checksFor(f).filter(c => !c.side).map(c => '<i class="' + (f.checks[c.k] ? 'on' : '') + '" title="' + esc(c.t + (f.checks[c.k] ? ' ✓' : ' — not yet')) + '"></i>').join('') + '</span>';
  }
  function row(f) {
    const late = f.followUp && f.followUp < data.today;
    const amber = RU.OPEN[f.status] && !f.am;
    return '<tr class="clk' + (amber ? ' amber' : '') + (RU.LIVE[f.status] ? '' : ' dim') + '" data-ref="' + esc(f.ref) + '">' +
      '<td class="nw"><span class="ref">' + esc(f.ref) + '</span></td>' +
      '<td class="nw">' + esc(UI.when(f.received)) + '</td>' +
      '<td class="agent"><b>' + esc(f.agent) + '</b>' + (f.contact ? '<span class="mini">' + esc(f.contact) + '</span>' : '') + (f.newClient === 'yes' ? ' <span class="pill quoted">new</span>' : '') + '</td>' +
      '<td>' + esc(f.country) + '</td><td class="num">' + esc(f.pax) + '</td><td class="nw">' + travel(f) + '</td>' +
      '<td class="nw">' + (f.am ? esc(nameOf(f.am)) : RU.OPEN[f.status] ? '<span class="pill warn">not assigned</span>' : '') + '</td>' +
      '<td>' + UI.pill(f.status) + '</td>' +
      '<td class="nw' + (late ? ' late' : '') + '" title="' + esc(f.followText) + '">' + (f.followUp ? esc(UI.when(f.followUp)) + (late ? ' ' + I('flag', 'sm') : '') : '') + '</td>' +
      '<td>' + dots(f) + '</td></tr>';
  }
  $('#view').addEventListener('click', e => { const r = e.target.closest('tr[data-ref],[data-open]'); if (r) openFile(r.dataset.ref || r.dataset.open); });

  /* ══ One file, in the side panel ═════════════════════════════════════ */
  async function openFile(ref) {
    openRef = ref;
    const side = $('#side');
    side.classList.remove('hidden');
    side.innerHTML = '<div class="sh"><div class="tt"><b>' + esc(ref) + '</b></div><button class="btn ghost" data-close>' + I('x') + '</button></div><div class="sb"><div class="empty">Opening…</div></div>';
    let r;
    try { r = await JOR.call('register.file', { ref: ref }); }
    catch (e) { side.querySelector('.sb').innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; return; }
    if (openRef !== ref) return;
    lastFile = r;
    history.replaceState(null, '', '#ref=' + encodeURIComponent(ref));
    paintFile(r);
  }
  function closeFile() { openRef = null; $('#side').classList.add('hidden'); $('#side').innerHTML = ''; if (/^#ref=/.test(location.hash)) history.replaceState(null, '', '#'); }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && openRef && !document.querySelector('.scrim')) closeFile(); });

  function paintFile(r) {
    const f = r.file, side = $('#side');
    const st = RU.STATUS[f.status];
    const canStatus = can('register.status', f), canEdit = can('register.edit', f), canCheck = can('register.checklist', f), canAssign = can('register.assign', f);
    const kv = [['Came in', UI.when(f.received)], ['Registered', f.origin ? '' : UI.when(f.registered) + ' · ' + nameOf(f.registeredBy)],
      ['Came from', f.origin ? 'The ' + f.origin.split(' + ').join(' and the ') + ' — brought in ' + UI.nice(f.importedAt, true) : ''], ['Agent', f.agent], ['Contact', [f.contact, f.contactEmail].filter(Boolean).join(' · ')],
      ['Country', f.country], ['Source', f.source], ['New client', f.newClient === 'yes' ? 'Yes' : f.newClient === 'no' ? 'No' : ''], ['Type', f.type],
      ['People', f.pax], ['Travel', f.arrival ? UI.nice(f.arrival, true) + (f.departure ? ' – ' + UI.nice(f.departure, true) : '') + (f.nights ? ' (' + f.nights + ' nights)' : '') : '20' + f.year],
      ['Tour name', f.tourName], ['Series', f.series], ['Tour leader', [f.tlName, f.tlPhone].filter(Boolean).join(' · ')], ['Arrives at', f.arrivePoint], ['Budget', f.budget], ['Account manager', f.am ? nameOf(f.am) + (f.assignedAt ? ' · ' + UI.when(f.assignedAt) : '') : 'Not assigned'],
      ['Proposal sent', f.quotedAt ? UI.nice(f.quotedAt, true) : ''], ['Confirmed', f.confirmedAt ? UI.nice(f.confirmedAt, true) : ''], ['Why lost', f.lostReason]]
      .filter(x => x[1] !== '' && x[1] !== undefined);
    let h = '<div class="sh"><div class="tt"><b>' + esc(f.ref) + ' — ' + esc(f.agent) + '</b><span class="mini">' + UI.pill(f.status) + ' · folder <span style="font-family:Consolas,monospace;color:var(--ink-2)">' + esc(RU.refName(f.ref) + ' ' + f.agent) + '</span></span></div>' +
      '<button class="btn ghost" data-close title="Close">' + I('x') + '</button></div><div class="sb">';
    /* The rest of the file, in the other parts. */
    const pt = r.parts || {};
    const link = (perm, dir, icon, label, n) => RU.can(me, perm, f) ? '<a href="../' + dir + '/#ref=' + encodeURIComponent(f.ref) + '">' + I(icon, 'sm') + label + (n ? ' <b>' + n + '</b>' : '') + '</a>' : '';
    h += '<div class="xlinks">' + link('res.view', 'reservations', 'bed', 'Reservations', pt.bookings) + link('costing.view', 'costing', 'calc', 'Costing', pt.costings) +
      link('money.view', 'money', 'euro', 'Money', pt.payments) + (f.status === 'confirmed' || f.status === 'closed' ? link('guide.office', 'guidefile', 'doc', 'Guide file', pt.guideDocs) : '') +
      (pt.complaints || f.status === 'confirmed' ? link('complaints.view', 'complaints', 'msg', 'Complaints', pt.complaints) : '') +
      '<a href="#" data-cover>' + I('print', 'sm') + 'File cover</a>' + (f.status === 'confirmed' || f.status === 'closed' ? '<a href="#" data-steps>' + I('print', 'sm') + 'Step sheets</a>' : '') + '</div>';
    /* Asked to be closed, lost or cancelled: it waits for the sign-off, and nothing else changes its status meanwhile. */
    if (f.pending) {
      const p = f.pending;
      h += '<div class="warnbox" style="margin:10px 0">' + I('clock', 'sm') + ' <b>Waiting for ' + esc(data.signer ? data.signer.name : 'management') + ' to sign off: ' + esc(RU.STATUS[p.to].t.toLowerCase()) + '</b>' +
        (p.reason ? ' — “' + esc(p.reason) + '”' : '') + '<div class="mini">Asked by ' + esc(nameOf(p.by)) + ', ' + esc(UI.when(p.at)) + '. It stays ' + esc(st.t.toLowerCase()) + ' until then.</div>' +
        '<div class="acts" style="margin-top:8px">' + (canSignoff() ? '<button class="btn sm" data-sback>Send back</button><button class="btn sm p" data-sok>Confirm</button>' : '') +
        (p.by === me.id ? '<button class="btn sm" data-swd>Take it back</button>' : '') + '</div></div>';
    } else if (canStatus && st.next.length) h += '<div class="acts">' + st.next.map(s => '<button class="btn sm' + (s === 'lost' || s === 'cancelled' ? ' dngr' : s === 'quoted' || s === 'confirmed' ? ' p' : '') + '" data-status="' + s + '">' +
      ({ quoted: 'Proposal sent', confirmed: 'Confirmed', lost: 'Lost', cancelled: 'Cancelled', closed: 'Close the file', enquiry: 'Back to enquiry' }[s]) + '</button>').join('') + '</div>';
    if (canAssign) {
      const load = {};
      data.files.forEach(x => { if (RU.OPEN[x.status] && x.am) load[x.am] = (load[x.am] || 0) + 1; });
      h += '<h4>Account manager</h4><div class="bar"><select class="in" id="amSel" style="flex:1">' +
        UI.options([['', 'Not assigned']].concat(ams().map(p => [p.id, p.name + ' — ' + (load[p.id] || 0) + ' open'])), f.am) + '</select><button class="btn p" id="amGo">Assign</button></div>';
    }
    h += '<h4>Details</h4><div class="kv">' + kv.map(x => '<div><span>' + esc(x[0]) + '</span>' + esc(x[1]) + '</div>').join('') + '</div>' +
      (f.notes ? '<div class="note" style="margin-top:10px;white-space:pre-wrap">' + esc(f.notes) + '</div>' : '') +
      (canEdit ? '<div class="acts"><button class="btn sm" id="edit">Edit details</button></div>' : '');
    /* Each side ticks its own steps; the account manager and management, any. */
    const mayTick = c => canCheck && (me.role !== 'marketing' || c.marketing) && (me.role !== 'operations' || c.side === 'om') && (me.role !== 'reservations' || c.side !== 'am');
    let lastN = 0;
    const depth = c => (c.of ? ((RU.CHECKS.find(y => y.k === c.of) || {}).of ? 2 : 1) : 0);
    const dlDate = c => (f.checks[c.k] && f.checks[c.k].date) || usualDate(f, c);
    const tick = c => {
      const x = f.checks[c.k], first = c.n && c.n !== lastN, dp = depth(c);
      if (c.n) lastN = c.n;
      const num = c.side ? '<span class="sn">' + (first && !c.of ? c.n : '') + '</span>' : '';
      const chip = c.side && first && !c.of ? '<span class="sd ' + c.side + '" title="' + esc(RU.SIDES[c.side]) + '">' + c.side.toUpperCase() + '</span>' : '';
      const help = c.help ? ' <span class="help" title="' + esc(c.help) + '">How?</span>' : '';
      const cls = 'chkrow' + (dp === 1 ? ' sub' : dp === 2 ? ' sub2' : '') + (c.side ? ' st' : '');
      /* Step 2: written, not ticked — with each golf course's terms. */
      if (c.notes) return '<div class="' + cls + ' notes">' + num + '<span class="tx">' + esc(c.t) +
        (x && x.note ? '<div class="nt">' + esc(x.note) + '</div>' : '') +
        (x && x.golf ? '<div class="mini">' + x.golf.map(g => '<b>' + esc(g.course || 'Golf course') + '</b>' + (g.deposit ? ' · deposit ' + esc(g.deposit) : '') + (g.balance ? ' · balance ' + esc(g.balance) : '') + (g.balanceDate ? ' by ' + esc(UI.nice(g.balanceDate, true)) : '') + (g.terms ? ' · ' + esc(g.terms) : '')).join('<br>') + '</div>' : '') +
        '</span>' + chip + (mayTick(c) ? '<button class="btn sm" data-notes="' + c.k + '">' + (x ? 'Change' : 'Write') + '</button>' : '') + '</div>';
      /* Step 9: the date, from the arrival unless the account manager set another. */
      if (c.date) {
        const d = dlDate(c);
        return '<div class="' + cls + '">' + num + '<span class="tx">' + esc(c.t) + ' <b>' + esc(d ? UI.nice(d, true) : '—') + '</b>' +
          (x ? ' <span class="mini">set by ' + esc(nameOf(x.by) || x.by) + '</span>' : usualDate(f, c) ? ' <span class="mini">(' + usualDays(f, c) + ' days before arrival)</span>' : c.k === 'dlDeposit' ? ' <span class="mini">(not set — the file’s own terms)</span>' : '') + '</span>' + help + chip +
          (mayTick(c) ? '<button class="btn sm" data-date="' + c.k + '">Change</button>' : '') + '</div>';
      }
      return '<label class="' + cls + '">' + num + '<input type="checkbox" data-check="' + c.k + '"' + (x ? ' checked' : '') + (mayTick(c) ? '' : ' disabled') + '>' +
        '<span class="tx">' + esc(c.t) + help + (x && x.note ? ' — <b>' + esc(x.note) + '</b>' : '') +
        (['finalCalc', 'finalCheck', 'finalSent'].indexOf(c.k) >= 0 && f.checks.finalCalc && f.checks.finalCalc.amount !== undefined ? ' — <b>' + esc(UI.euro(f.checks.finalCalc.amount)) + '</b>' : '') + '</span>' + chip +
        '<span class="mini">' + (x ? esc((nameOf(x.by) || x.by) + ' · ' + UI.when(x.at)) : c.ops && f.arrival && f.status === 'confirmed' ? 'by ' + esc(UI.nice(UI.D.addDays(f.arrival, -c.days), true)) : '') + '</span></label>';
    };
    const office = RU.checksFor(f).filter(c => !c.side), steps = RU.checksFor(f).filter(c => c.side), ticks = steps.filter(c => !c.date && !c.notes);
    h += '<h4>Checklist</h4>' + office.map(tick).join('');
    if (steps.length) {
      const done = ticks.filter(c => f.checks[c.k]).length;
      h += '<h4>Steps when confirmed <span class="mini">' + done + ' of ' + ticks.length + ' ticked</span></h4><div class="mini" style="margin:-4px 0 6px">AM the account manager · OM the operations manager, the reservations team</div>' +
        '<div class="stepbar"><i style="width:' + Math.round(100 * done / ticks.length) + '%"></i></div>' + steps.map(tick).join('');
      h += '<h4>Important — before arrival</h4>' + importantHtml(f, r) + (canCheck && me.role !== 'marketing' ? '<div class="acts"><button class="btn sm" id="impEdit">' + I('doc', 'sm') + 'Pre and post nights, transfers, extras</button></div>' : '');
    }
    const open = r.notes.filter(n => n.followUp && !n.done).sort((a, b) => a.followUp < b.followUp ? -1 : 1);
    const rest = r.notes.filter(n => !(n.followUp && !n.done));
    h += '<h4>Notes and follow-ups</h4>' +
      (me.perms['register.note'] ? '<textarea class="in" id="nt" placeholder="A note, or what to follow up…"></textarea><div class="bar" style="margin-top:8px">' +
        '<label class="mini">Follow up on <input class="in" type="date" id="nd" style="width:auto;display:inline-block;margin-left:6px"></label><span class="sp" style="flex:1"></span><button class="btn p sm" id="na">Add</button></div>' : '') +
      open.concat(rest).map(n => {
        const due = n.followUp && !n.done, over = due && n.followUp < data.today;
        return '<div class="note' + (over ? ' over' : due ? ' due' : '') + (n.done ? ' done' : '') + '"><div style="white-space:pre-wrap">' + esc(n.text) + '</div>' +
          '<div class="mini">' + esc(n.by) + ' · ' + esc(UI.when(n.when)) + (n.followUp ? ' · follow up ' + esc(UI.nice(n.followUp, true)) : '') + (n.done && n.followUp ? ' · done' + (n.doneBy ? ' by ' + esc(n.doneBy) : '') : '') +
          (due && me.perms['register.note'] ? (f.status === 'quoted' && (n.kind === 'followup' || n.kind === 'chase' || n.kind === 'hold')
            ? ' · <a href="#" data-done="' + esc(n.id) + '" data-ans="1">they answered</a> · <a href="#" data-done="' + esc(n.id) + '">chased — no answer yet</a> · <a href="#" data-hold="' + esc(n.id) + '">they’ll come back to us…</a>'
            : ' · <a href="#" data-done="' + esc(n.id) + '">mark done</a>') : '') + '</div></div>';
      }).join('');
    /* Flights, from the client, counted by flight. */
    const pax = r.flights.reduce((a, x) => { a[x.dir] = (a[x.dir] || 0) + x.pax; return a; }, {});
    h += '<h4>Flights</h4>' + (r.flights.length ? '<table class="t"><tbody>' + r.flights.map(x => '<tr><td>' + (x.dir === 'arr' ? 'Arrives' : 'Leaves') + '</td><td><b>' + esc(x.flight) + '</b> ' + esc(x.route) + '</td>' +
      '<td class="nw">' + esc(UI.nice(x.date, true)) + ' ' + esc(x.time) + '</td><td class="num">' + x.pax + '</td><td>' + (me.perms['register.note'] ? '<button class="btn sm ghost" data-fdel="' + esc(x.id) + '" title="Take it out">' + I('x', 'sm') + '</button>' : '') + '</td></tr>').join('') +
      '</tbody></table><div class="mini">' + (pax.arr || 0) + ' arriving, ' + (pax.dep || 0) + ' leaving' + (f.pax && pax.arr && pax.arr !== f.pax ? ' — <b class="late">the file says ' + f.pax + '</b>' : '') + '</div>' : '<div class="mini">None yet.</div>') +
      (me.perms['register.note'] ? '<div class="acts"><button class="btn sm" id="fpaste">' + I('plane', 'sm') + 'Paste flights</button></div>' : '');
    /* Links to the documents: the shared drive, OneDrive, the proposal. */
    h += '<h4>Documents</h4>' + (r.docs.length ? r.docs.map(d => '<div class="log"><span style="flex:1">' + (/^https:\/\//.test(d.link) ? '<a href="' + esc(d.link) + '" target="_blank" rel="noopener">' + esc(d.name) + '</a>' : '<b>' + esc(d.name) + '</b>' + (d.link ? ' <span class="mini" style="font-family:Consolas,monospace">' + esc(d.link) + '</span>' : '')) +
      (d.kind ? ' <span class="mini">' + esc(d.kind) + '</span>' : '') + '</span><span class="mini">' + esc(d.by) + '</span>' + (me.perms['register.note'] ? '<button class="btn sm ghost" data-ddel="' + esc(d.id) + '">' + I('x', 'sm') + '</button>' : '') + '</div>').join('') : '<div class="mini">None linked yet.</div>') +
      (me.perms['register.note'] ? '<div class="acts"><button class="btn sm" id="dadd">' + I('link', 'sm') + 'Link a document</button></div>' : '');
    h += '<h4>History</h4>' + (r.log.length ? r.log.map(x => '<div class="log"><span class="t">' + esc(UI.when(x.when)) + '</span><span><b>' + esc(x.who) + '</b> ' + esc(x.what.toLowerCase()) + (x.detail ? ' — ' + esc(x.detail) : '') + '</span></div>').join('') : '<div class="mini">Nothing yet.</div>') + '</div>';
    side.innerHTML = h;
    wireFile(f);
  }

  /* After any change: the board and the open file, both fresh. */
  async function refresh(ref, msg) {
    /* The list and the open file are asked for together, not one after the other. */
    const file = ref && openRef === ref ? openFile(ref) : null;
    await load();
    if (view === 'board') board();
    if (file) await file;
    if (msg) UI.toast(msg);
  }
  async function act(ref, fn, msg) {
    try { await fn(); await refresh(ref, msg); }
    catch (e) {
      if (e.stale) { await refresh(ref); UI.toast(e.message, 6000); }
      else UI.toast(e.message, 5000);
    }
  }

  function wireFile(f) {
    const side = $('#side');
    side.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeFile));
    side.querySelectorAll('[data-status]').forEach(b => b.addEventListener('click', () => statusDialog(f, b.dataset.status)));
    const ag = side.querySelector('#amGo');
    if (ag) ag.addEventListener('click', () => act(f.ref, () => JOR.call('register.assign', { ref: f.ref, rev: f.rev, am: side.querySelector('#amSel').value }),
      side.querySelector('#amSel').value ? 'Assigned to ' + nameOf(side.querySelector('#amSel').value) + '.' : 'Unassigned.'));
    const ed = side.querySelector('#edit');
    if (ed) ed.addEventListener('click', () => fileForm(f));
    side.querySelectorAll('[data-check]').forEach(c => c.addEventListener('change', () => {
      const item = RU.CHECKS.filter(x => x.k === c.dataset.check)[0];
      if (c.checked && item && item.amount) {
        c.checked = false;
        UI.dialog({
          title: item.n + '. ' + item.t + ' — ' + f.ref, body: UI.field('The final payment (€)', UI.moneyIn('amt', '', 'data-focus'), 'The reservations team see it on the steps, to send the invoice through Tourplan. Operations and marketing don’t.'),
          foot: '<button class="btn" data-x>Cancel</button><button class="btn p" data-ok>Tick it</button>',
          on: (el, close) => {
            UI.money(el);
            el.querySelector('[data-ok]').addEventListener('click', () => { const v = el.querySelector('[name=amt]').value; if (!v.trim()) return; close(); act(f.ref, () => JOR.call('register.check', { ref: f.ref, key: item.k, on: true, amount: v })); });
          }
        });
        return;
      }
      if (!c.checked || !item || (!item.note && !item.date)) { act(f.ref, () => JOR.call('register.check', { ref: f.ref, key: c.dataset.check, on: c.checked })); return; }
      c.checked = false;
      UI.dialog({
        title: (item.n ? item.n + '. ' : '') + item.t + ' — ' + f.ref,
        body: item.date ? UI.field('The date', '<input class="in" type="date" name="date" data-focus>', 'It goes on the steps, and on the list of whoever’s step is due by then, a week before.')
          : UI.field(item.note, '<input class="in" name="note" maxlength="80" data-focus placeholder="' + (item.k === 'coach' ? 'e.g. the coach company' : item.k === 'guide' ? 'e.g. the guide’s name' : 'name and phone') + '">', 'It shows on the file and on the operations list.'),
        foot: '<button class="btn" data-x>Cancel</button><button class="btn p" data-ok>Tick it</button>',
        on: (el, close) => {
          const box = el.querySelector('[name=note],[name=date]');
          const go = () => { const v = box.value.trim(); if (item.date && !v) { box.focus(); return; } close(); act(f.ref, () => JOR.call('register.check', Object.assign({ ref: f.ref, key: item.k, on: true }, item.date ? { date: v } : { note: v }))); };
          el.querySelector('[data-ok]').addEventListener('click', go);
          box.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
        }
      });
    }));
    side.querySelectorAll('[data-date]').forEach(b => b.addEventListener('click', e => {
      e.preventDefault();
      const item = RU.CHECKS.find(x => x.k === b.dataset.date), x = f.checks[item.k];
      const usual = usualDate(f, item);
      UI.dialog({
        title: item.n + '. ' + item.t + ' — ' + f.ref,
        body: UI.field('The date', '<input class="in" type="date" name="date" value="' + esc((x && x.date) || usual) + '" data-focus>', usual ? 'Usually ' + usualDays(f, item) + ' days before arrival: ' + esc(UI.nice(usual, true)) + '.' : item.k === 'dlDeposit' ? 'As this file’s terms say — the Money part’s deposit date follows it.' : 'There is no arrival date yet.') +
          (item.k === 'dlFinal' && f.arrival && lastFile && lastFile.finalAlt ? '<p class="mini" style="margin:10px 0 4px">Either option:</p><div class="acts" style="justify-content:flex-start">' +
            [usualDays(f, item), lastFile.finalAlt].map(n => '<button class="btn sm" data-pick="' + UI.D.addDays(f.arrival, -n) + '">' + n + ' days before — ' + esc(UI.nice(UI.D.addDays(f.arrival, -n), true)) + '</button>').join('') +
            '</div><p class="mini">The Money part’s due date for the final payment follows this.</p>' : ''),
        foot: '<button class="btn" data-x>Cancel</button>' + (x ? '<button class="btn" data-usual>Back to the usual</button>' : '') + '<button class="btn p" data-ok>Save</button>',
        on: (el, close) => {
          el.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => { el.querySelector('[name=date]').value = b.dataset.pick; }));
          el.querySelector('[data-ok]').addEventListener('click', () => { const v = el.querySelector('[name=date]').value; if (!v) return; close(); act(f.ref, () => JOR.call('register.check', { ref: f.ref, key: item.k, on: true, date: v })); });
          const u = el.querySelector('[data-usual]');
          if (u) u.addEventListener('click', () => { close(); act(f.ref, () => JOR.call('register.check', { ref: f.ref, key: item.k, on: false })); });
        }
      });
    }));
    side.querySelectorAll('[data-notes]').forEach(b => b.addEventListener('click', e => {
      e.preventDefault();
      const item = RU.CHECKS.find(x => x.k === b.dataset.notes), x = f.checks[item.k] || {}, golf = (x.golf || []).slice();
      const golfy = f.type === 'Golf' || golf.length;
      while (golf.length < 8) golf.push({});
      const row = (g, i) => '<tr><td><input class="in" data-g="course" data-i="' + i + '" value="' + esc(g.course || '') + '" placeholder="Golf course"></td><td><input class="in" data-g="deposit" data-i="' + i + '" value="' + esc(g.deposit || '') + '" placeholder="€"></td>' +
        '<td><input class="in" type="date" data-g="balanceDate" data-i="' + i + '" value="' + esc(g.balanceDate || '') + '"></td><td><input class="in" data-g="balance" data-i="' + i + '" value="' + esc(g.balance || '') + '" placeholder="€"></td>' +
        '<td><input class="in" data-g="terms" data-i="' + i + '" value="' + esc(g.terms || '') + '"></td></tr>';
      UI.dialog({
        title: item.n + '. Booking conditions — ' + f.ref, wide: true,
        body: UI.field('Each hotel: the deadline to release FOC, free places', '<textarea class="in" name="note" data-focus style="min-height:110px">' + esc(x.note || '') + '</textarea>') +
          '<details' + (golfy ? ' open' : '') + '><summary class="mini"><b>Golf courses</b> — payment and cancellation terms, up to eight</summary><div class="tw"><table class="t golf"><thead><tr><th>Golf course</th><th>Deposit paid</th><th>Balance due</th><th>Balance</th><th>Cancellation terms</th></tr></thead><tbody>' +
          golf.map(row).join('') + '</tbody></table></div></details>',
        foot: '<button class="btn" data-x>Cancel</button><button class="btn p" data-ok>Save</button>',
        on: (el, close) => el.querySelector('[data-ok]').addEventListener('click', () => {
          const g = [];
          el.querySelectorAll('[data-g]').forEach(i => { const n = +i.dataset.i; g[n] = g[n] || {}; g[n][i.dataset.g] = i.value.trim(); });
          close(); act(f.ref, () => JOR.call('register.check', { ref: f.ref, key: item.k, on: true, note: el.querySelector('[name=note]').value.trim(), golf: g.filter(Boolean) }));
        })
      });
    }));
    const ie = side.querySelector('#impEdit');
    if (ie) ie.addEventListener('click', () => importantForm(f));
    const na = side.querySelector('#na');
    if (na) na.addEventListener('click', () => {
      const text = side.querySelector('#nt').value.trim(), due = side.querySelector('#nd').value;
      if (!text) { side.querySelector('#nt').focus(); return; }
      act(f.ref, () => JOR.call('register.note', { ref: f.ref, text: text, followUp: due }), due ? 'Follow-up set for ' + UI.nice(due, true) + '.' : 'Note added.');
    });
    side.querySelectorAll('[data-done]').forEach(a => a.addEventListener('click', e => {
      e.preventDefault();
      act(f.ref, () => JOR.call('register.done', { id: a.dataset.done, answered: !!a.dataset.ans }).then(r => { if (r.chases) UI.toast('The next chase is set.'); }), a.dataset.ans ? 'Done — the chasing stops.' : 'Marked done.');
    }));
    /* They asked us to hold, or said they'd come back: no chasing until the day they gave (Iain, 14 Oct). */
    side.querySelectorAll('[data-hold]').forEach(a => a.addEventListener('click', e => {
      e.preventDefault();
      UI.dialog({
        title: f.ref + ' — they’ll come back to us',
        body: UI.field('Check in with them on', '<input class="in" type="date" name="back" value="' + D.addDays(data.today, 21) + '" min="' + D.addDays(data.today, 1) + '" data-focus>', 'No chasing until then — and nothing is marked lost. Held rooms stay held: ask reservations to extend the options.') + '<div class="err" data-err></div>',
        foot: '<button class="btn" data-x>Cancel</button><button class="btn p" data-ok>Save</button>',
        on: (el, close) => el.querySelector('[data-ok]').addEventListener('click', async () => {
          const back = el.querySelector('[name=back]').value;
          try { await JOR.call('register.done', { id: a.dataset.hold, backOn: back }); close(); await refresh(f.ref, 'No chasing until ' + UI.nice(back, true) + '.'); }
          catch (x) { el.querySelector('[data-err]').textContent = x.message; }
        })
      });
    }));
    side.querySelectorAll('[data-sok],[data-sback]').forEach(b => b.addEventListener('click', () => signoff(f, b.hasAttribute('data-sok'))));
    const swd = side.querySelector('[data-swd]');
    if (swd) swd.addEventListener('click', () => act(f.ref, () => JOR.call('register.withdraw', { ref: f.ref, rev: f.rev }), 'Taken back — ' + f.ref + ' stays as it was.'));
    side.querySelectorAll('[data-fdel]').forEach(b => b.addEventListener('click', () => act(f.ref, () => JOR.call('register.flightDelete', { id: b.dataset.fdel }), 'Flight taken out.')));
    side.querySelectorAll('[data-ddel]').forEach(b => b.addEventListener('click', () => act(f.ref, () => JOR.call('register.docDelete', { id: b.dataset.ddel }), 'Link taken out.')));
    const fp = side.querySelector('#fpaste'); if (fp) fp.addEventListener('click', () => flightsForm(f));
    const da = side.querySelector('#dadd'); if (da) da.addEventListener('click', () => docForm(f));
    side.querySelector('[data-cover]').addEventListener('click', e => { e.preventDefault(); UI.sheet('File cover — ' + f.ref, coverSheet(f, lastFile), false); });
    const ss = side.querySelector('[data-steps]');
    if (ss) ss.addEventListener('click', e => { e.preventDefault(); UI.sheet('Step sheets — ' + f.ref, stepSheets(f), false); });
  }

  /* Flights pasted from the client's email or the arrivals sheet: one a line,
     e.g. "EI 521 CDG-DUB 14/05/2027 10:40 35". */
  function parseFlights(text, dir, year) {
    return text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => {
      const flight = (l.match(/\b([A-Z0-9]{2}\s?\d{2,4}[A-Z]?)\b/i) || [])[1] || '';
      const route = (l.match(/\b([A-Z]{3})\s*[-–>\/ ]+\s*([A-Z]{3})\b/) || []).slice(1, 3).join('-');
      const dm = l.match(/\b(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?\b/), iso = l.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
      const y = dm && dm[3] ? (dm[3].length === 2 ? '20' + dm[3] : dm[3]) : year;
      const date = iso ? iso[0] : dm ? y + '-' + dm[2].padStart(2, '0') + '-' + dm[1].padStart(2, '0') : '';
      const time = (l.match(/\b(\d{1,2}[:h.]\d{2})\b/) || [])[1] || '';
      const nums = l.replace(/\b\d{1,2}[:h.]\d{2}\b/g, ' ').replace(/\b\d{1,4}[\/.\-]\d{1,2}([\/.\-]\d{2,4})?\b/g, ' ').replace(flight, ' ').match(/\b\d{1,3}\b/g) || [];
      return { dir: /\bdep|leav|départ|retour/i.test(l) ? 'dep' : /\barr|arriv/i.test(l) ? 'arr' : dir, flight: flight.replace(/\s/g, '').toUpperCase(), route: route, date: date, time: time.replace(/[h.]/, ':'), pax: nums.length ? +nums[nums.length - 1] : 0 };
    }).filter(x => x.flight);
  }
  function flightsForm(f) {
    UI.dialog({
      title: 'Flights — ' + f.ref, wide: true,
      body: '<p class="mini" style="margin-top:0">Paste them from the client’s email or the arrivals sheet, one flight a line — the flight, the airports, the date, the time and how many on it.</p>' +
        '<div class="g2">' + UI.field('Unless a line says', '<select class="in" name="dir">' + UI.options([['arr', 'Arriving'], ['dep', 'Leaving']], 'arr') + '</select>') +
        '<label class="chk" style="margin-top:22px"><input type="checkbox" name="rep"> Replace the flights already on the file</label></div>' +
        '<textarea class="in" name="txt" rows="7" data-focus placeholder="EI 521 CDG-DUB 14/05/2027 10:40 35&#10;AF 1816 DUB-CDG 21/05/2027 dep 18:05 35"></textarea><div data-prev class="mini" style="margin-top:8px"></div><div class="err" data-err></div>',
      foot: '<button class="btn" data-x>Cancel</button><button class="btn p" data-ok>Put them on the file</button>',
      on: (el, close) => {
        const year = (f.arrival || data.today).slice(0, 4);
        const prev = () => { const l = parseFlights(el.querySelector('[name=txt]').value, el.querySelector('[name=dir]').value, year);
          el.querySelector('[data-prev]').innerHTML = l.map(x => esc((x.dir === 'arr' ? 'Arrives ' : 'Leaves ') + x.flight + ' ' + x.route + ' ' + (x.date ? UI.nice(x.date, true) : '— no date') + ' ' + x.time + ' · ' + x.pax + ' people')).join('<br>'); };
        el.addEventListener('input', prev); el.addEventListener('change', prev);
        el.querySelector('[data-ok]').addEventListener('click', async () => {
          const l = parseFlights(el.querySelector('[name=txt]').value, el.querySelector('[name=dir]').value, year);
          if (!l.length) { el.querySelector('[data-err]').textContent = 'No flight numbers found.'; return; }
          try { await JOR.call('register.flights', { ref: f.ref, flights: l, replace: el.querySelector('[name=rep]').checked }); close(); await refresh(f.ref, l.length + ' flight' + (l.length === 1 ? '' : 's') + ' on the file.'); }
          catch (e) { el.querySelector('[data-err]').textContent = e.message; }
        });
      }
    });
  }
  function docForm(f) {
    UI.dialog({
      title: 'Link a document — ' + f.ref,
      body: UI.field('What it is', '<input class="in" name="name" data-focus placeholder="e.g. Proposal v2, Costing, Signed contract">') +
        UI.field('Kind', '<select class="in" name="kind">' + UI.options(['', 'Proposal', 'Costing', 'Contract', 'Rooming list', 'Final itinerary', 'Vouchers', 'Email', 'Other'], '') + '</select>') +
        UI.field('Where it is', '<input class="in" name="link" placeholder="https://… or S:\\RFP\\27\\271274\\…">', 'A web link, or the folder on the shared drive.') + '<div class="err" data-err></div>',
      foot: '<button class="btn" data-x>Cancel</button><button class="btn p" data-ok>Link it</button>',
      on: (el, close) => el.querySelector('[data-ok]').addEventListener('click', async () => {
        const v = n => el.querySelector('[name=' + n + ']').value.trim();
        try { await JOR.call('register.doc', { ref: f.ref, name: v('name'), kind: v('kind'), link: v('link') }); close(); await refresh(f.ref, 'Linked.'); }
        catch (e) { el.querySelector('[data-err]').textContent = e.message; }
      })
    });
  }

  /* Maude's "Important" box: flights, the tour leader, pre and post nights, transfers, a driver booked out, extras. */
  const IMP = [['pre', 'Pre night — driver or guide', ['date', 'hotel', 'name']], ['post', 'Post night — driver or guide', ['date', 'hotel', 'name']],
    ['guestPre', 'Pre night — guests', ['date', 'hotel', 'rooms', 'name']], ['guestPost', 'Post night — guests', ['date', 'hotel', 'rooms', 'name']],
    ['transferPre', 'Transfer — pre night', ['date', 'from', 'to', 'name', 'coach', 'driver']], ['transferPost', 'Transfer — post night', ['date', 'from', 'to', 'name', 'coach', 'driver']],
    ['bookedOut', 'Driver booked out', ['date', 'hotel', 'full', 'amount', 'name']]];
  const IMPF = { date: 'Date', hotel: 'Hotel', name: 'Name', rooms: 'Rooms', from: 'From', to: 'To', coach: 'Coach company', driver: 'Driver’s name and phone', full: 'Full amount', amount: 'Amount' };
  const impLine = (v, fields) => fields.filter(k => v[k]).map(k => (k === 'date' ? UI.nice(v[k], true) : k === 'full' ? 'full amount ' + v[k] : k === 'name' || k === 'hotel' ? v[k] : IMPF[k].toLowerCase() + ' ' + v[k])).join(' · ');
  function importantHtml(f, r) {
    const im = f.important || {}, fl = (r && r.flights) || [];
    const rows = [['Flights', fl.length ? fl.map(x => (x.dir === 'arr' ? 'Arrives ' : 'Leaves ') + x.flight + ' ' + x.route + ' ' + UI.nice(x.date, true) + ' ' + x.time).join(' · ') : 'none in yet — paste them under Flights'],
      ['Tour leader', [f.tlName, f.tlPhone].filter(Boolean).join(' · ') || 'name and phone not in yet — Edit details']]
      .concat(IMP.filter(x => im[x[0]]).map(x => [x[1], impLine(im[x[0]], x[2])]))
      .concat([['Headsets · drinks · porterage', ['headset', 'drinks', 'porterage'].map(k => ({ headset: 'Headsets', drinks: 'Drinks', porterage: 'Porterage' }[k]) + ' ' + (im[k] === 'yes' ? 'yes' : im[k] === 'no' ? 'no' : '?')).join(' · ')]]);
    return '<div class="kv imp">' + rows.map(x => '<div><span>' + esc(x[0]) + '</span>' + esc(x[1]) + '</div>').join('') + '</div>';
  }
  function importantForm(f) {
    const im = f.important || {};
    const yn = k => '<select class="in" name="' + k + '">' + UI.options([['', '—'], ['yes', 'Yes'], ['no', 'No']], im[k] || '') + '</select>';
    UI.dialog({
      title: 'Important — ' + f.ref, wide: true,
      body: IMP.map(x => '<p class="mini" style="margin:10px 0 4px"><b>' + esc(x[1]) + '</b></p><div class="g3">' + x[2].map(k => UI.field(IMPF[k], k === 'date' ? '<input class="in" type="date" name="' + x[0] + '.' + k + '" value="' + esc((im[x[0]] || {})[k] || '') + '">'
        : k === 'full' ? '<select class="in" name="' + x[0] + '.' + k + '">' + UI.options([['', '—'], ['yes', 'Yes'], ['no', 'No']], (im[x[0]] || {})[k] || '') + '</select>'
          : '<input class="in" name="' + x[0] + '.' + k + '" value="' + esc((im[x[0]] || {})[k] || '') + '">')).join('') + '</div>').join('') +
        '<div class="g3" style="margin-top:12px">' + UI.field('Headsets', yn('headset')) + UI.field('Drinks', yn('drinks')) + UI.field('Porterage', yn('porterage')) + '</div>' +
        '<p class="mini">Flights go in under Flights on the file; the tour leader under Edit details.</p><div class="err" data-err></div>',
      foot: '<button class="btn" data-x>Cancel</button><button class="btn p" data-ok>Save</button>',
      on: (el, close) => el.querySelector('[data-ok]').addEventListener('click', async () => {
        const out = {};
        el.querySelectorAll('[name]').forEach(i => { const p = i.name.split('.'); if (p.length === 2) { out[p[0]] = out[p[0]] || {}; out[p[0]][p[1]] = i.value.trim(); } else out[p[0]] = i.value; });
        try { await JOR.call('register.important', { ref: f.ref, important: out }); close(); await refresh(f.ref, 'Saved.'); } catch (e) { el.querySelector('[data-err]').textContent = e.message; }
      })
    });
  }

  const usualDays = (f, c) => (c.k === 'dlFinal' && f.finalDays !== '' && f.finalDays !== undefined ? f.finalDays : c.k === 'dlDeposit' ? f.depositDays : (data.deadlineDays || {})[c.dflt]);
  /* The day a step 9 date falls on when nobody has set it: so many days before arrival — none for a deposit with no agent's rule. */
  const usualDate = (f, c) => { const n = usualDays(f, c); return f.arrival && data.deadlineDays && n !== '' && n !== undefined && n !== null ? UI.D.addDays(f.arrival, -n) : ''; };

  /* JOR's two step sheets — the account manager's and the operations manager's —
     as on paper: each step, who ticked it, when, and the note. */
  function stepSheets(f) {
    const page = sd => {
      const rows = RU.checksFor(f).filter(c => c.side === sd);
      let lastN = 0;
      return '<div class="paper ssheet"><table class="sshead"><tbody><tr><th>Group name</th><td>' + esc(f.agent + (f.tourName ? ' — ' + f.tourName : '')) + '</td><th>Ref</th><td>' + esc(f.ref) + '</td></tr>' +
        '<tr><th>Pax</th><td>' + esc(f.pax) + '</td><th>Final pax</th><td></td></tr></tbody></table>' +
        '<h3 style="text-align:center;margin:10px 0">' + (sd === 'am' ? 'Account Manager File' : 'Operation Manager File') + '</h3>' +
        '<table class="steps"><thead><tr><th style="width:9%">Step</th><th>' + (sd === 'am' ? 'Account manager' : 'Operations manager') + ': ' + esc(sd === 'am' ? nameOf(f.am) : '') + '</th><th style="width:8%">Done</th><th style="width:15%">Date</th><th style="width:24%">Note</th></tr></thead><tbody>' +
        rows.map(c => { const x = f.checks[c.k], first = c.n !== lastN; lastN = c.n;
          const dl = c.date ? (x && x.date) || usualDate(f, c) : '';
          const pad = c.of ? ' style="padding-left:' + ((RU.CHECKS.find(y => y.k === c.of) || {}).of ? 34 : 18) + 'px"' : '';
          return '<tr><td class="c">' + (first && !c.of ? c.n : '') + '</td><td' + pad + '>' + esc(c.t) +
            (c.notes && x ? '<div style="white-space:pre-wrap;margin-top:3px">' + esc(x.note || '') + '</div>' + (x.golf ? '<table class="golfp"><tbody>' + x.golf.map(g => '<tr><td>' + esc(g.course) + '</td><td>dep. ' + esc(g.deposit) + '</td><td>bal. ' + esc(g.balance) + (g.balanceDate ? ' by ' + esc(UI.nice(g.balanceDate)) : '') + '</td><td>' + esc(g.terms) + '</td></tr>').join('') + '</tbody></table>' : '') : '') + '</td>' +
            '<td class="c">' + (c.date || c.notes ? '' : x ? '✓' : '☐') + '</td>' +
            '<td>' + esc(c.date ? (dl ? UI.nice(dl, true) : '') : x ? UI.nice(String(x.at).slice(0, 10)) : '') + '</td><td>' + esc(x && !c.notes ? [x.note, nameOf(x.by) || x.by].filter(Boolean).join(' · ') : '') + '</td></tr>'; }).join('') +
        '</tbody></table>' + (sd === 'am' ? '<div class="ssnote"><b>IMPORTANT</b>' + importantHtml(f, lastFile).replace('class="kv imp"', 'class="ssimp"') + '</div>' : '') +
        '<div class="ps-foot">Printed from JORIS, ' + esc(UI.nice(data.today, true)) + '</div></div>';
    };
    return page('am') + '<div style="break-before:page"></div>' + page('om');
  }

  /* The front cover of the file: the white sticker, the checklist, and the
     shorthand itinerary for the inside cover. */
  function coverSheet(f, r) {
    const ck = RU.checksFor(f).filter(c => !c.side), days = (r && r.outline) || [], inv = (r && r.invoices) || {}, fl = (r && r.flights) || [];
    const arr = fl.filter(x => x.dir === 'arr')[0], dep = fl.filter(x => x.dir === 'dep')[0];
    const ln = (k, v) => '<tr><th>' + esc(k) + '</th><td>' + esc(v || '') + '</td></tr>';
    return '<div class="paper"><div class="sticker"><h2>JOE O’REILLY TOURS LIMITED</h2><div class="stk"><table><tbody>' +
      '<tr><th>Ref. No:</th><td><b>' + esc(f.ref) + '</b></td><th style="width:auto">Pax:</th><td>' + esc(f.pax) + '</td></tr>' +
      '<tr><th>Agency:</th><td colspan="3">' + esc(f.agent) + '</td></tr><tr><th>Address</th><td colspan="3"></td></tr><tr><th></th><td colspan="3"></td></tr>' +
      '<tr><th>Contact:</th><td colspan="3">' + esc([f.contact, f.contactEmail].filter(Boolean).join(' · ')) + '</td></tr>' +
      '<tr><th>Arr. Date:</th><td colspan="3">' + esc(f.arrival ? UI.nice(f.arrival, true) : '') + '</td></tr>' +
      '<tr><th>Arr. Point:</th><td colspan="3">' + esc([f.arrivePoint, arr ? arr.flight + ' ' + arr.time : ''].filter(Boolean).join(' · ')) + '</td></tr>' +
      '<tr><th>Guide:</th><td colspan="3">' + esc(f.guideName || (f.checks.guide && f.checks.guide.note) || '') + '</td></tr>' +
      '<tr><th>Deposit Inv:#</th><td colspan="3">' + esc(inv.deposit || '') + '</td></tr><tr><th>Final Inv:#</th><td colspan="3">' + esc(inv.final || '') + '</td></tr>' +
      '</tbody></table><table><tbody>' + ln('Group:', f.tourName) + ln('Name:', f.tlName) + ln('Tel:', f.tlPhone) + ln('Fax:', '') + ln('Email:', '') + '<tr><td colspan="2" style="height:8mm"></td></tr>' +
      ln('Dep. Date:', f.departure ? UI.nice(f.departure, true) : '') + ln('Dep. Point:', dep ? dep.flight + ' ' + dep.time : '') + ln('Acc. Exec.:', nameOf(f.am)) +
      ln('Coach:', (f.checks.coach && f.checks.coach.note) || '') + '</tbody></table></div></div>' +
      '<p style="margin:12px 0 4px" class="mini">Folder: ' + esc(RU.refName(f.ref) + ' ' + f.agent) + ' · came in ' + esc(UI.when(f.received)) + '</p>' +
      '<p style="margin:10px 0 6px"><b>Checklist</b></p><table class="fc-chk"><tbody>' + ck.map(c => '<tr><td>' + (f.checks[c.k] ? '✓' : '☐') + '</td><td>' + esc(c.t) + (f.checks[c.k] ? ' — ' + esc((f.checks[c.k].note ? f.checks[c.k].note + '; ' : '') + (nameOf(f.checks[c.k].by) || f.checks[c.k].by) + ', ' + UI.nice(f.checks[c.k].at)) : '') + '</td></tr>').join('') + '</tbody></table>' +
      (days.length ? '<p style="margin:14px 0 6px"><b>Shorthand itinerary</b></p><table><thead><tr><th>Day</th><th>Morning</th><th>Lunch</th><th>Afternoon</th><th>Hotel</th></tr></thead><tbody>' +
        days.map(d => '<tr><td class="nw">' + esc(UI.nice(d.date)) + '</td><td>' + esc(d.morning) + '</td><td>' + esc(d.lunch) + '</td><td>' + esc(d.afternoon) + '</td><td>' + esc([d.hotel, d.town].filter(Boolean).join(', ')) + (d.basis ? ' (' + esc(d.basis) + ')' : '') + '</td></tr>').join('') + '</tbody></table>' : '') +
      '<div class="ps-foot">Printed from JORIS, ' + esc(UI.nice(data.today, true)) + '</div></div>';
  }

  function statusDialog(f, to) {
    const needDate = to === 'quoted' || to === 'confirmed' || to === 'closed', needWhy = to === 'lost' || to === 'cancelled';
    const label = { quoted: 'Proposal sent on', confirmed: 'Confirmed on', closed: 'Closed on' }[to];
    const due = to === 'quoted' ? D.addWorking(data.today, RU.FOLLOW_UP_DAYS, data.cfg || {}) : '';
    UI.dialog({
      title: f.ref + ' — ' + ({ quoted: 'proposal sent', confirmed: 'confirmed', lost: 'lost', cancelled: 'cancelled', closed: 'close the file', enquiry: 'back to enquiry' }[to]),
      body: (needDate ? UI.field(label, '<input class="in" type="date" name="d" value="' + data.today + '" data-focus>', to === 'quoted' ? 'A follow-up is set 5 working days on — <b data-due>' + esc(UI.nice(due, true)) + '</b>.' : '') : '') +
        (needWhy ? UI.field('Why?', '<select class="in" name="code" data-focus>' + UI.options([['', '— choose']].concat((data.lostCodes || []).map(c => [c.code, c.code + ' · ' + c.label]), [['other', 'Something else']]), '') + '</select>') +
          UI.field('A few words', '<textarea class="in" name="why" rows="2" placeholder="e.g. Went with another DMC on price"></textarea>', 'Optional with a code; needed for something else.') : '') +
        (to === 'lost' && f.status === 'quoted' ? '<p class="mini">If any rooms are held for this file, release them — closing the file doesn’t.</p>' : '') +
        (to === 'enquiry' ? '<p>It goes back on the board as an enquiry.</p>' : '') +
        (needsSignoff(to) ? '<p class="okbox">' + I('clock', 'sm') + ' This goes to <b>' + esc(data.signer.name) + '</b> to sign off. ' + esc(f.ref) + ' stays ' + esc(RU.STATUS[f.status].t.toLowerCase()) + ' until then.</p>' : '') + '<div class="err" data-err></div>',
      foot: '<button class="btn" data-x>Cancel</button><button class="btn ' + (needWhy ? 'dngr' : 'p') + '" data-ok>' + (needsSignoff(to) ? 'Send to sign off' : 'Save') + '</button>',
      on: (el, close) => {
        const d = el.querySelector('[name=d]');
        if (d && to === 'quoted') d.addEventListener('input', () => { const x = el.querySelector('[data-due]'); if (x && d.value) x.textContent = UI.nice(D.addWorking(d.value, RU.FOLLOW_UP_DAYS, data.cfg || {}), true); });
        let force = false;
        el.querySelector('[data-ok]').addEventListener('click', async () => {
          try {
            let why = needWhy || force ? (el.querySelector('[name=why]') || {}).value.trim() : '';
            /* The reason goes in as its code, the way the RFP window had it: "X1 — Went with a Dublin DMC". */
            const code = needWhy ? el.querySelector('[name=code]').value : '';
            if (needWhy && !code) throw new Error('Choose why, from the list.');
            if (needWhy && code === 'other' && !why) throw new Error('Say in a few words why.');
            if (code && code !== 'other') why = code + (why ? ' — ' + why : '');
            const r = await JOR.call('register.status', { ref: f.ref, rev: f.rev, status: to, date: d ? d.value : '', reason: why, force: force });
            close(); await refresh(f.ref, r.pending ? 'Sent to ' + r.pending.signer + ' to sign off.' : f.ref + ' is now ' + RU.STATUS[to].t.toLowerCase() + '.');
            /* Losing a file doesn't release its rooms: offer to, there and then. */
            if (r.liveBookings) releasePrompt(f, r.liveBookings);
          } catch (e) {
            if (e.stale) { close(); await refresh(f.ref); UI.toast(e.message, 6000); return; }
            el.querySelector('[data-err]').textContent = e.message;
            /* Management can close a file with something outstanding — with a reason. */
            if (to === 'closed' && /anyway/.test(e.message) && !force) {
              force = true;
              el.querySelector('[data-err]').insertAdjacentHTML('afterend', UI.field('Why close it anyway?', '<textarea class="in" name="why" placeholder="e.g. Galway billed the client directly"></textarea>'));
              el.querySelector('[data-ok]').textContent = 'Close it anyway';
            }
          }
        });
      }
    });
  }

  function releasePrompt(f, n) {
    const may = can('res.book', Object.assign({}, f, { selfBook: f.selfBook }));
    UI.dialog({
      title: n + ' booking' + (n === 1 ? ' is' : 's are') + ' still held for ' + f.ref,
      body: '<p>Losing or cancelling a file doesn’t release its rooms — the hotels can still bill for them.</p>' +
        (may ? '<p>Release them now? Options are let go at no cost; confirmed rooms are cancelled with today’s cost written down, and stay open until each hotel acknowledges.</p>'
          : '<p>Reservations have it on their list as urgent. <a href="../reservations/#ref=' + encodeURIComponent(f.ref) + '">See them in Reservations</a>.</p>') + '<div class="err" data-err></div>',
      foot: '<button class="btn" data-x>' + (may ? 'Not now' : 'OK') + '</button>' + (may ? '<button class="btn dngr" data-ok>Release them</button>' : ''),
      on: (el, close) => { const b = el.querySelector('[data-ok]'); if (b) b.addEventListener('click', async () => {
        try { const r = await JOR.call('res.release', { ref: f.ref }); close(); UI.toast(r.released + ' released' + (r.cost ? ' — ' + UI.euro(r.cost) + ' payable unless the hotels waive it' : '') + '.', 6000); }
        catch (e) { el.querySelector('[data-err]').textContent = e.message; }
      }); }
    });
  }

  /* ══ The form: a new RFP, or a file's details ═══════════════════════ */
  const thisYear = +D.today().slice(2, 4);
  function formHtml(f) {
    f = f || {};
    const now = UI.nowLocal();
    const rec = f.received ? { date: f.received.slice(0, 10), time: f.received.slice(11, 16) } : now;
    const yr = f.year || '';
    return '<datalist id="agentList">' + data.agents.map(a => '<option value="' + esc(a.agent) + '">').join('') + '</datalist>' +
      '<div class="g2">' + UI.field('Agent or client', '<input class="in" name="agent" list="agentList" autocomplete="off" value="' + esc(f.agent || '') + '" data-focus>') +
      UI.field('Contact', '<input class="in" name="contact" value="' + esc(f.contact || '') + '">') + '</div>' +
      '<div class="hint hidden" data-hint></div>' +
      '<div class="g2">' + UI.field('Contact’s email', '<input class="in" name="contactEmail" type="email" value="' + esc(f.contactEmail || '') + '">') +
      UI.field('Country', UI.pick('country', 'country', f.country || '', { placeholder: 'Start typing — France, FR…' }), 'Pick it: the two-letter code goes in by itself.') + '</div>' +
      '<div class="g3">' + UI.field('Came in by', '<select class="in" name="source">' + UI.options([['', '—']].concat(RU.SOURCES), f.source || '') + '</select>') +
      UI.field('New client?', '<select class="in" name="newClient">' + UI.options([['', '—'], ['yes', 'Yes — new'], ['no', 'No — quoted before']], f.newClient || '') + '</select>') +
      UI.field('Type', '<select class="in" name="type">' + UI.options([['', '—']].concat(RU.TYPES), f.type || '') + '</select>') + '</div>' +
      '<div class="g4">' + UI.field('People', '<input class="in" name="pax" type="number" min="1" value="' + esc(f.pax || '') + '">') +
      UI.field('Arrive', '<input class="in" name="arrival" type="date" value="' + esc(f.arrival || '') + '">') +
      UI.field('Leave', '<input class="in" name="departure" type="date" value="' + esc(f.departure || '') + '">') +
      (f.ref ? UI.field('Travel year', '<input class="in" value="20' + esc(f.year) + '" disabled>', 'Part of the reference.') :
        UI.field('Travel year', '<select class="in" name="year">' + UI.options([['', 'From the dates']].concat([0, 1, 2, 3].map(i => [String(thisYear + i), '20' + (thisYear + i)])), yr) + '</select>')) + '</div>' +
      '<div class="g2">' + UI.field('Budget', '<input class="in" name="budget" placeholder="e.g. €1,400 pp" value="' + esc(f.budget || '') + '">') +
      UI.field('Tour name', '<input class="in" name="tourName" value="' + esc(f.tourName || '') + '" placeholder="once it has one">') + '</div>' +
      (f.ref ? (f.series ? '<p class="mini">Part of the series ' + esc(f.series) + '.</p>' : '') : UI.field('Departures in the series', '<input class="in" name="departures" type="number" min="1" max="60" placeholder="1" style="max-width:120px">',
        'A series — the same tour, many departures: each gets a number of its own, one after the other. The dates above are the first departure’s.')) +
      (f.ref ? '<div class="g2">' + UI.field('Tour leader', '<input class="in" name="tlName" value="' + esc(f.tlName || '') + '" placeholder="the client’s tour leader, once known">') +
        UI.field('Tour leader’s phone', '<input class="in" type="tel" name="tlPhone" value="' + esc(f.tlPhone || '') + '">') + '</div>' : '') +
      '<div class="g2">' + UI.field('Email came in on', '<input class="in" name="rdate" type="date" value="' + esc(rec.date) + '">') +
      UI.field('At', '<input class="in" name="rtime" type="time" value="' + esc(rec.time) + '">', '<span data-oh></span>') + '</div>' +
      UI.field('Notes', '<textarea class="in" name="notes" placeholder="What they’ve asked for…">' + esc(f.notes || '') + '</textarea>') +
      '<div class="err" data-err></div>';
  }
  function readForm(el) {
    const v = n => { const x = el.querySelector('[name=' + n + ']'); return x ? x.value.trim() : undefined; };
    const out = {};
    ['agent', 'contact', 'contactEmail', 'country', 'source', 'newClient', 'type', 'pax', 'arrival', 'departure', 'budget', 'notes', 'year', 'tourName', 'bl', 'tlName', 'tlPhone'].forEach(k => { const x = v(k); if (x !== undefined) out[k] = x; });
    if (out.country) out.country = out.country.toUpperCase();
    out.received = v('rdate') && v('rtime') ? v('rdate') + 'T' + v('rtime') : '';
    return out;
  }
  function wireForm(el, editing) {
    const agent = el.querySelector('[name=agent]'), hint = el.querySelector('[data-hint]');
    /* An agent JOR has quoted before fills in the rest — never typed twice. */
    const fill = () => {
      const a = data.agents.find(x => keyOf(x.agent) === keyOf(agent.value));
      if (!agent.value.trim()) { hint.classList.add('hidden'); return; }
      hint.classList.remove('hidden');
      if (a) {
        if (!editing && agent.value !== a.agent) agent.value = a.agent;
        hint.className = 'hint';
        hint.innerHTML = 'Quoted before — ' + a.files + ' file' + (a.files === 1 ? '' : 's') + ', the last ' + esc(a.lastRef) + (a.am ? ', usually <b>' + esc(nameOf(a.am)) + '</b>' : '') + '.';
        if (!editing) {
          [['country', a.country], ['contact', a.contact], ['contactEmail', a.contactEmail], ['type', a.type]].forEach(([k, val]) => { const x = el.querySelector('[name=' + k + ']'); if (x && !x.value && val) x.value = val; });
          el.querySelector('[name=newClient]').value = 'no';
        }
      } else {
        hint.className = 'hint new';
        hint.textContent = 'Not quoted before — a new client. Bernard or Iain calls new clients.';
        if (!editing) el.querySelector('[name=newClient]').value = 'yes';
      }
    };
    agent.addEventListener('change', fill);
    agent.addEventListener('blur', fill);
    if (editing) fill();
    /* After hours, at the weekend or on a bank holiday it counts from the next working morning. */
    const oh = () => {
      const d = el.querySelector('[name=rdate]').value, t = el.querySelector('[name=rtime]').value, x = el.querySelector('[data-oh]');
      if (!d || !t) { x.textContent = ''; return; }
      const r = D.received(d, t, data.cfg || {});
      x.textContent = r.moved ? 'Out of hours (' + r.why + ') — counts from ' + UI.nice(r.date) + ' ' + r.time + '.' : '';
    };
    el.querySelector('[name=rdate]').addEventListener('input', oh);
    el.querySelector('[name=rtime]').addEventListener('input', oh);
    oh();
  }

  function newRfp() {
    UI.dialog({
      title: 'Register an RFP', wide: true, body: formHtml(),
      foot: '<button class="btn" data-x>Cancel</button><button class="btn p" data-ok>Register it</button>',
      on: (el, close) => {
        wireForm(el, false);
        const go = async force => {
          const f = readForm(el);
          el.querySelector('[data-err]').textContent = '';
          try {
            const dep = el.querySelector('[name=departures]');
            const r = await JOR.call('register.create', { file: f, force: !!force, departures: dep && dep.value.trim() ? dep.value.trim() : 1 });
            if (r.duplicates) { duplicates(r.duplicates, () => go(true), close); return; }
            close();
            await refresh();
            registered(r.file, r.suggestAm, r.series);
          } catch (e) { el.querySelector('[data-err]').textContent = e.message; }
        };
        el.querySelector('[data-ok]').addEventListener('click', () => go(false));
      }
    });
  }
  $('#new').addEventListener('click', newRfp);

  /* The same agent again so soon — ask before making a second file. */
  function duplicates(list, anyway, closeForm) {
    UI.dialog({
      title: 'Is this one already registered?',
      body: '<p>The same agent sent ' + (list.length === 1 ? 'one' : list.length) + ' recently:</p>' + list.map(d => '<div class="note"><span class="ref">' + esc(d.ref) + '</span> — ' + esc(d.agent) +
        (d.arrival ? ', arriving ' + esc(UI.nice(d.arrival, true)) : '') + (d.pax ? ', ' + esc(d.pax) + ' people' : '') + ' · registered ' + esc(UI.when(d.registered)) + ' · ' + UI.pill(d.status) +
        ' <a href="#" data-see="' + esc(d.ref) + '">open it</a></div>').join(''),
      foot: '<button class="btn" data-x>Go back</button><button class="btn p" data-anyway>It’s a different RFP — register it</button>',
      on: (el, close) => {
        el.querySelector('[data-anyway]').addEventListener('click', () => { close(); anyway(); });
        el.querySelectorAll('[data-see]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); close(); closeForm(); openFile(a.dataset.see); }));
      }
    });
  }

  /* Registered: the reference, the folder name, and the next steps. */
  function registered(f, suggest, series) {
    const folder = RU.refName(f.ref) + ' ' + f.agent;
    UI.dialog({
      title: series ? 'Registered — a series' : 'Registered',
      body: '<div class="done-ref">' + esc(series || f.ref) + '</div>' + (series ? '<p class="mini">Each departure has its own file and number. This is the first; give the others their dates as they are fixed.</p>' : '') +
        '<div class="folder"><span data-fname>' + esc(folder) + '</span><button class="btn sm" data-copy>' + I('copy', 'sm') + 'Copy</button></div>' +
        '<p class="mini">Name the file folder like this. Then tick off on the file: ' + RU.OFFICE.filter(c => !c.newOnly || f.newClient === 'yes').map(c => c.t.toLowerCase()).join(', ') + '.</p>' +
        (suggest && can('register.assign') ? '<p>' + esc(f.agent) + ' usually goes to <b>' + esc(nameOf(suggest)) + '</b>.</p>' : ''),
      foot: '<button class="btn" data-x>Done</button>' + (suggest && can('register.assign') ? '<button class="btn" data-assign>Assign to ' + esc(nameOf(suggest).split(' ')[0]) + '</button>' : '') + '<button class="btn p" data-openit>Open the file</button>',
      on: (el, close) => {
        el.querySelector('[data-copy]').addEventListener('click', async () => { try { await navigator.clipboard.writeText(folder); UI.toast('Copied.'); } catch (e) { UI.toast('Select it and copy.'); } });
        el.querySelector('[data-openit]').addEventListener('click', () => { close(); openFile(f.ref); });
        const asg = el.querySelector('[data-assign]');
        if (asg) asg.addEventListener('click', async () => { close(); await act(f.ref, () => JOR.call('register.assign', { ref: f.ref, rev: f.rev, am: suggest }), 'Assigned to ' + nameOf(suggest) + '.'); openFile(f.ref); });
      }
    });
  }

  function fileForm(f) {
    UI.dialog({
      title: 'Edit ' + f.ref, wide: true, body: formHtml(f),
      foot: '<button class="btn" data-x>Cancel</button><button class="btn p" data-ok>Save</button>',
      on: (el, close) => {
        wireForm(el, true);
        el.querySelector('[data-ok]').addEventListener('click', async () => {
          const x = readForm(el); delete x.year;
          try { await JOR.call('register.update', { ref: f.ref, rev: f.rev, file: x }); close(); await refresh(f.ref, 'Saved.'); }
          catch (e) { if (e.stale) { close(); await refresh(f.ref); UI.toast(e.message, 6000); } else el.querySelector('[data-err]').textContent = e.message; }
        });
      }
    });
  }

  /* ══ The dashboard ══════════════════════════════════════════════════ */
  async function dashboard() {
    $('#view').innerHTML = '<div class="empty">Working it out…</div>';
    let d;
    try { d = await JOR.call('register.dashboard'); } catch (e) { $('#view').innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; return; }
    if (view !== 'dashboard') return;
    const mins = m => m === null ? '—' : m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min';
    const won = d.conversion.won + d.conversion.lost ? Math.round(100 * d.conversion.won / (d.conversion.won + d.conversion.lost)) + '%' : '—';
    const tile = (k, v, s, tone) => '<div class="tile ' + (tone || '') + '"><div class="k">' + esc(k) + '</div><div class="v">' + v + '</div><div class="s">' + esc(s || '') + '</div></div>';
    const max = Math.max(1, ...d.weeks.map(w => w.n));
    const bw = 100 / d.weeks.length;
    const bars = '<svg class="chart" viewBox="0 0 100 60" preserveAspectRatio="none" role="img" aria-label="RFPs registered each week">' +
      d.weeks.map((w, i) => { const h = 46 * w.n / max; return '<rect x="' + (i * bw + bw * 0.15) + '" y="' + (50 - h) + '" width="' + (bw * 0.7) + '" height="' + h + '" fill="#00A66E" rx="0.6"><title>w/c ' + esc(UI.nice(w.start)) + ': ' + w.n + '</title></rect>'; }).join('') + '</svg>' +
      '<div style="display:flex;justify-content:space-between" class="mini">' + d.weeks.filter((w, i) => i % 3 === 0).map(w => '<span>' + esc(UI.nice(w.start)) + '</span>').join('') + '</div>';
    const list = (o, n) => Object.keys(o).sort((a, b) => o[b] - o[a]).slice(0, n || 10).map(k => '<div class="log"><span style="flex:1">' + esc(k) + '</span><b>' + o[k] + '</b></div>').join('') || '<div class="mini">Nothing yet.</div>';
    $('#view').innerHTML = '<div class="tiles">' +
      tile('Enquiries', d.byStatus.enquiry, 'not quoted yet') + tile('Quoted', d.byStatus.quoted, 'waiting for an answer') +
      tile('Not assigned', d.unassigned, 'open files with no account manager', d.unassigned ? 'warn' : '') +
      tile('Follow-ups overdue', d.overdue.length, 'past their date', d.overdue.length ? 'err' : '') +
      tile('Turnaround', mins(d.turnaround.median), 'office time from email to the board, last 90 days (' + d.turnaround.count + ')') +
      tile('Won', won, d.conversion.won + ' confirmed, ' + d.conversion.lost + ' lost') + '</div>' +
      '<div class="two"><div class="card pad"><h3>' + I('chart', 'sm') + 'RFPs each week</h3>' + bars + '</div>' +
      '<div class="card pad"><h3>' + I('users', 'sm') + 'Open files by account manager</h3><table class="t"><thead><tr><th>Who</th><th class="num">Enquiries</th><th class="num">Quoted</th><th class="num">Overdue</th></tr></thead><tbody>' +
      d.byAm.map(a => '<tr><td>' + esc(a.name) + '</td><td class="num">' + a.enquiry + '</td><td class="num">' + a.quoted + '</td><td class="num' + (a.overdue ? ' late' : '') + '">' + a.overdue + '</td></tr>').join('') + '</tbody></table></div></div>' +
      '<div class="two" style="margin-top:14px"><div class="card pad"><h3>' + I('flag', 'sm') + 'Overdue follow-ups</h3>' +
      (d.overdue.length ? d.overdue.sort((a, b) => a.due < b.due ? -1 : 1).map(o => '<div class="log" style="cursor:pointer" data-open="' + esc(o.ref) + '"><span class="ref">' + esc(o.ref) + '</span><span style="flex:1">' + esc(o.agent) + ' · ' + esc(nameOf(o.am) || 'not assigned') + '</span><span class="late">' + esc(UI.nice(o.due)) + '</span></div>').join('') : '<div class="mini">None. Good.</div>') + '</div>' +
      '<div class="card pad"><h3>Where they come from</h3><div class="two"><div>' + list(d.bySource) + '</div><div>' + list(d.byCountry) + '</div></div></div></div>';
  }

  /* ══ Start ══════════════════════════════════════════════════════════ */
  try { await JOR.live('register.list', null, r => { data = r; render(); }); } catch (e) { $('#view').innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; return; }
  const want = new URLSearchParams(location.hash.slice(1)).get('ref');
  if (want) openFile(want);
  window.addEventListener('hashchange', () => { const r = new URLSearchParams(location.hash.slice(1)).get('ref'); if (r && r !== openRef) openFile(r); });
  window.JORREG = { data: () => data, openFile: openFile, filt: filt };
})();
