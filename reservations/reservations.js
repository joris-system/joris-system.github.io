/* ═══════════════════════════════════════════════════════════════════════
   JORIS — reservations
   What needs doing today, the requests from the account managers, every
   booking (the pink sheet), and what walking away would cost. A file opens
   in the side panel: its request, its bookings, its rooming lists and the
   two paper forms. The server checks every change; this page only hides
   what a person can't use.
   ═══════════════════════════════════════════════════════════════════════ */
(async function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = UI.esc, I = UI.icon, RU = window.JOR_RULES, D = window.JORWF_DATES, E = window.JOR_ENGINE;
  const me = await JOR.me();
  UI.topBar('Reservations', 'JORIS', me);
  const can = (perm, f) => RU.can(Object.assign({}, me, { status: 'active' }), perm, f);
  const qs = new URLSearchParams(location.hash.slice(1));
  let view = ['todo', 'requests', 'bookings', 'exposure'].indexOf(qs.get('tab')) >= 0 ? qs.get('tab') : 'todo';
  let data = null, openRef = null;
  const filt = { mine: true, q: '', status: 'live' };

  const fileOf = ref => data.files.find(f => f.ref === ref) || { ref: ref, rooming: {} };
  const nameOf = id => (data.people.find(p => p.id === id) || {}).name || '';
  const short = id => nameOf(id).split(' ')[0];
  async function load() { data = await JOR.call('res.list'); }

  function tabs() {
    const t = [['todo', 'Needs doing'], ['requests', 'Requests'], ['bookings', 'Every booking']].concat(me.perms['res.exposure'] ? [['exposure', 'Exposure']] : []);
    $('#tabs').innerHTML = t.map(x => '<button data-tab="' + x[0] + '" class="' + (view === x[0] ? 'on' : '') + '">' + x[1] + '</button>').join('');
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; view = b.dataset.tab; render(); });
  function render() { tabs(); ({ todo: todo, requests: requests, bookings: bookings, exposure: exposure })[view](); }

  /* ══ Needs doing: the engine's list, each with its owner ═════════════ */
  function todo() {
    let list = data.issues.slice();
    if (filt.mine) list = list.filter(x => x.who === me.id);
    const sevs = { critical: 0, high: 0, medium: 0, low: 0 };
    list.forEach(x => { sevs[x.sev]++; });
    $('#view').innerHTML = '<div class="bar"><label class="chk"><input type="checkbox" id="mine"' + (filt.mine ? ' checked' : '') + '> Only mine</label><span class="mini">' +
      (sevs.critical ? '<b class="late">' + sevs.critical + ' urgent</b> · ' : '') + list.length + ' in all</span></div>' +
      (list.length ? '<div class="todo">' + list.map(x => '<a class="ti ' + esc(x.sev) + ' iss" href="#" data-open="' + esc(x.ref) + '"><span class="dot"></span><span class="bd"><b>' + esc(x.title) + '</b><span>' +
        esc(x.ref + ' · ' + x.detail) + '</span></span><span class="rt">' + UI.sevPill(x.sev) + (x.money ? '<div><b>' + esc(UI.euro(x.money)) + '</b></div>' : '') +
        (!filt.mine ? '<div>' + esc(short(x.who) || 'nobody') + '</div>' : '') + '</span></a>').join('') + '</div>'
        : '<div class="card pad empty">Nothing ' + (filt.mine ? 'on your list' : 'needs doing') + ' just now.</div>');
    $('#mine').addEventListener('change', e => { filt.mine = e.target.checked; todo(); });
  }

  /* ══ Requests ═══════════════════════════════════════════════════════ */
  function requests() {
    const order = { sent: 0, open: 1, draft: 2, complete: 3, cancelled: 4 };
    const list = data.requests.slice().sort((a, b) => (order[a.status] - order[b.status]) || ((fileOf(a.ref).arrival || '9') < (fileOf(b.ref).arrival || '9') ? -1 : 1));
    $('#view').innerHTML = '<div class="card tw">' + (list.length ? '<table class="t"><thead><tr><th>Ref</th><th>Agent</th><th>Arrives</th><th>From</th><th>Status</th><th>With</th><th>Progress</th><th>Short</th></tr></thead><tbody>' +
      list.map(r => {
        const f = fileOf(r.ref), sh = E.shortfall(r, data.bookings);
        const pr = r.status === 'open' || r.status === 'complete' ? E.progressOf(r, data.bookings) : null;
        return '<tr class="clk' + (r.status === 'sent' && r.to === me.id ? ' amber' : '') + (r.status === 'complete' || r.status === 'cancelled' ? ' dim' : '') + '" data-open="' + esc(r.ref) + '">' +
          '<td class="nw"><span class="ref">' + esc(r.ref) + '</span></td><td>' + esc(f.agent) + '</td><td class="nw">' + esc(UI.nice(f.arrival, true)) + '</td><td>' + esc(short(r.by)) + '</td>' +
          '<td><span class="pill ' + (r.status === 'sent' ? 'warn' : r.status === 'open' ? 'quoted' : r.status === 'complete' ? 'confirmed' : '') + '">' + esc(RU.REQUEST[r.status]) + '</span></td>' +
          '<td>' + esc(short(r.openedBy || r.to)) + '</td><td class="nw">' + (r.progress === '' ? '—' : r.progress + '%') + (pr !== null && pr !== r.progress ? ' <span class="mini">(rooms say ' + pr + '%)</span>' : '') + '</td>' +
          '<td class="nw">' + (r.status === 'open' && sh.length ? '<span class="late">' + sh.length + ' night' + (sh.length === 1 ? '' : 's') + '</span>' : '') + '</td></tr>';
      }).join('') + '</tbody></table>' : '<div class="empty">No accommodation requests yet. An account manager writes one from the file’s outline itinerary.</div>') + '</div>';
  }

  /* ══ Every booking ══════════════════════════════════════════════════ */
  function bookings() {
    let list = data.bookings.slice();
    if (filt.status === 'live') list = list.filter(b => E.LIVE[b.status] || (b.status === 'cancelled' && !(b.cancel || {}).ackAt));
    else if (filt.status !== 'all') list = list.filter(b => b.status === filt.status);
    if (filt.q) { const q = filt.q.toLowerCase(); list = list.filter(b => (b.ref + ' ' + b.hotel + ' ' + b.town + ' ' + fileOf(b.ref).agent + ' ' + b.confRef).toLowerCase().includes(q)); }
    list.sort((a, b) => a.checkIn < b.checkIn ? -1 : a.checkIn > b.checkIn ? 1 : a.hotel < b.hotel ? -1 : 1);
    let total = 0;
    const rows = list.map(b => {
      const s = E.state(b, data.today), f = fileOf(b.ref);
      total += s.exposure;
      return '<tr class="clk' + (s.past ? ' dim' : '') + '" data-open="' + esc(b.ref) + '"><td class="nw">' + esc(UI.nice(b.checkIn, true)) + ' <span class="mini">' + s.nights + 'n</span></td>' +
        '<td><b>' + esc(b.hotel) + '</b><span class="mini"> ' + esc(b.town) + '</span></td><td class="nw"><span class="ref">' + esc(b.ref) + '</span> ' + esc(f.agent) + '</td>' +
        '<td>' + esc(E.roomsText(b.rooms)) + '</td><td>' + statusPill(b, s) + '</td><td class="num">' + (b.hidden ? '' : b.ppn === '' ? '<span class="pill warn">no rate</span>' : esc(UI.euro(b.ppn))) + '</td>' +
        '<td class="num">' + esc(UI.euro(s.value)) + '</td><td class="num' + (s.exposure ? ' late' : '') + '">' + (s.exposure ? esc(UI.euro(s.exposure)) : '') + '</td><td class="tick">' + (b.tp ? I('check', 'sm') : '') + '</td></tr>';
    });
    $('#view').innerHTML = '<div class="bar"><input class="in srch" id="q" placeholder="Hotel, town, reference, agent, confirmation number…" value="' + esc(filt.q) + '">' +
      '<select class="in" id="fs">' + UI.options([['live', 'Held, or waiting for a hotel to acknowledge'], ['provisional', 'On option'], ['confirmed', 'Confirmed'], ['cancelled', 'Cancelled — not acknowledged'], ['released', 'Released'], ['all', 'Everything']], filt.status) + '</select></div>' +
      '<div class="count">' + list.length + ' booking' + (list.length === 1 ? '' : 's') + (total ? ' · <b class="late">' + esc(UI.euro(total)) + ' payable if all were cancelled today</b>' : '') + '</div>' +
      '<div class="card tw">' + (list.length ? '<table class="t"><thead><tr><th>Check-in</th><th>Hotel</th><th>File</th><th>Rooms</th><th>Status</th><th class="num">PP/PN</th><th class="num">Value</th><th class="num">To cancel today</th><th>T/P</th></tr></thead><tbody>' + rows.join('') + '</tbody></table>' : '<div class="empty">Nothing matches.</div>') + '</div>';
    const q = $('#q');
    q.addEventListener('input', () => { filt.q = q.value; clearTimeout(q._t); q._t = setTimeout(() => { const p = q.selectionStart; bookings(); const n = $('#q'); n.focus(); n.setSelectionRange(p, p); }, 200); });
    $('#fs').addEventListener('change', e => { filt.status = e.target.value; bookings(); });
  }
  function statusPill(b, s) {
    if (b.status === 'provisional') return '<span class="pill quoted">option' + (b.optionDate ? ' to ' + esc(UI.nice(b.optionDate)) : '') + '</span>' + (s.optionDays !== null && s.optionDays <= 3 ? ' ' + I('flag', 'sm') : '');
    if (b.status === 'confirmed') return '<span class="pill confirmed">confirmed</span>';
    if (b.status === 'cancelled') return '<span class="pill err">cancelled — not acknowledged</span>';
    return '<span class="pill lost">' + esc(E.STATUS[b.status] || b.status) + '</span>';
  }

  /* ══ Exposure ═══════════════════════════════════════════════════════ */
  async function exposure() {
    $('#view').innerHTML = '<div class="empty">Working it out…</div>';
    let x;
    try { x = await JOR.call('res.exposure'); } catch (e) { $('#view').innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; return; }
    if (view !== 'exposure') return;
    const max = Math.max(1, ...x.weeks.map(w => w.exposure)), bw = 100 / x.weeks.length;
    const chart = '<svg class="chart" viewBox="0 0 100 60" preserveAspectRatio="none" role="img" aria-label="What cancelling everything would cost, week by week">' +
      x.weeks.map((w, i) => { const h = 50 * w.exposure / max; return '<rect x="' + (i * bw + bw * 0.12) + '" y="' + (52 - h) + '" width="' + (bw * 0.76) + '" height="' + h + '" fill="' + (i ? '#E2A400' : '#B3261E') + '" rx="0.5"><title>' + esc(UI.nice(w.on)) + ': ' + esc(UI.euro(w.exposure)) + '</title></rect>'; }).join('') + '</svg>' +
      '<div style="display:flex;justify-content:space-between" class="mini">' + x.weeks.filter((w, i) => i % 4 === 0).map(w => '<span>' + esc(UI.nice(w.on)) + '</span>').join('') + '</div>';
    const table = (o, label) => '<div class="card pad"><h3>' + esc(label) + '</h3>' + (Object.keys(o).length ? Object.keys(o).sort((a, b) => o[b] - o[a]).slice(0, 12).map(k => '<div class="log"><span style="flex:1">' + esc(k) + '</span><b>' + esc(UI.euro(o[k])) + '</b></div>').join('') : '<div class="mini">Nothing.</div>') + '</div>';
    $('#view').innerHTML = '<div class="tiles"><div class="tile ' + (x.total ? 'err' : '') + '"><div class="k">If everything were cancelled today</div><div class="v">' + esc(UI.euro(x.total)) + '</div><div class="s">confirmed rooms, and cancellations not acknowledged</div></div></div>' +
      '<div class="card pad"><h3>' + I('chart', 'sm') + 'The next twenty weeks, if nothing is released</h3>' + chart + '</div>' +
      '<div class="two" style="margin-top:14px">' + table(monthNames(x.by.month), 'By month of arrival') + table(x.by.hotel, 'By hotel') + '</div>' +
      '<div class="two" style="margin-top:14px">' + table(x.by.am, 'By account manager') + table(x.by.agent, 'By agent') + '</div>';
  }

  function monthNames(o) { const out = {}; Object.keys(o).sort().forEach(k => { out[D.MON[+k.slice(5, 7) - 1] + ' ' + k.slice(0, 4)] = o[k]; }); return out; }
  $('#view').addEventListener('click', e => { const r = e.target.closest('[data-open]'); if (r) { e.preventDefault(); openFile(r.dataset.open); } });

  /* ══ One file ═══════════════════════════════════════════════════════ */
  function openFile(ref) {
    openRef = ref;
    history.replaceState(null, '', '#ref=' + encodeURIComponent(ref));
    paintFile();
  }
  function closeFile() { openRef = null; $('#side').classList.add('hidden'); $('#side').innerHTML = ''; history.replaceState(null, '', '#'); }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && openRef && !document.querySelector('.scrim')) closeFile(); });

  function paintFile() {
    const f = fileOf(openRef), side = $('#side');
    side.classList.remove('hidden');
    const reqs = data.requests.filter(r => r.ref === f.ref).sort((a, b) => a.status === 'cancelled' ? 1 : b.status === 'cancelled' ? -1 : 0);
    const books = data.bookings.filter(b => b.ref === f.ref).sort((a, b) => a.checkIn < b.checkIn ? -1 : 1);
    const fs = E.fileState(f, data.bookings, data.today);
    const canReq = can('res.request', f), canBook = can('res.book', f), canProg = can('res.progress', f);
    let h = '<div class="sh"><div class="tt"><b>' + esc(f.ref) + ' — ' + esc(f.agent || '') + '</b><span class="mini">' + UI.pill(f.status) + ' · ' +
      esc([f.pax ? f.pax + ' pax' : '', f.arrival ? UI.nice(f.arrival, true) + (f.departure ? ' – ' + UI.nice(f.departure, true) : '') : '', f.am ? 'with ' + nameOf(f.am) : 'not assigned', f.selfBook ? 'books its own hotels' : ''].filter(Boolean).join(' · ')) + '</span></div>' +
      '<button class="btn ghost" data-close title="Close">' + I('x') + '</button></div><div class="sb">';
    h += '<div class="xlinks"><a href="../register/#ref=' + encodeURIComponent(f.ref) + '">' + I('list', 'sm') + 'The file</a>' +
      (RU.can(me, 'costing.view', f) ? '<a href="../costing/#ref=' + encodeURIComponent(f.ref) + '">' + I('calc', 'sm') + 'Costing</a>' : '') +
      (RU.can(me, 'money.view', f) ? '<a href="../money/#ref=' + encodeURIComponent(f.ref) + '">' + I('euro', 'sm') + 'Money</a>' : '') + '</div>';
    if (fs.dead && fs.liveCount) h += '<div class="errbox"><b>' + fs.liveCount + ' booking' + (fs.liveCount === 1 ? ' is' : 's are') + ' still held on a ' + esc(f.status) + ' file.</b> Losing a file doesn’t release its rooms.' +
      (canBook ? ' <button class="btn sm dngr" data-act="release">Release them all</button>' : '') + '</div>';
    if (fs.exposure) h += '<div class="warnbox">Cancelling this file today would cost <b>' + esc(UI.euro(fs.exposure)) + '</b>' + (fs.nextOn ? ', going up by ' + esc(UI.euro(fs.nextJump)) + ' on ' + esc(UI.nice(fs.nextOn, true)) : '') + '.</div>';

    /* The request */
    h += '<h4>Accommodation request</h4>';
    if (!reqs.length) h += f.selfBook ? '<div class="mini">' + esc(f.agent) + ' books its own hotels through its account manager — no request to reservations.</div>'
      : '<div class="mini">None yet.</div>' + (canReq ? '<div class="acts"><button class="btn p sm" data-act="newreq">' + I('plus', 'sm') + 'Write the request from the outline itinerary</button></div>' : '');
    reqs.forEach(r => {
      const sh = E.shortfall(r, data.bookings), pr = E.progressOf(r, data.bookings);
      h += '<div class="note"><div><span class="pill ' + (r.status === 'sent' ? 'warn' : r.status === 'complete' ? 'confirmed' : '') + '">' + esc(RU.REQUEST[r.status]) + '</span> ' +
        '<span class="mini">' + esc(['by ' + short(r.by), r.sentAt ? 'sent ' + UI.when(r.sentAt) + ' to ' + short(r.to) : '', r.openedAt ? 'picked up by ' + short(r.openedBy) + ' ' + UI.when(r.openedAt) : ''].filter(Boolean).join(' · ')) + '</span></div>' +
        '<div class="lines" style="margin-top:6px">' + r.lines.map(l => '<div class="mini"><b>' + esc(UI.nice(l.from)) + ' – ' + esc(UI.nice(l.to)) + '</b> · ' + D.diffDays(l.from, l.to) + ' night' + (D.diffDays(l.from, l.to) === 1 ? '' : 's') + ' · ' +
          esc(l.town) + (l.hotel ? ' (' + esc(l.hotel) + ')' : '') + (l.basis ? ' · ' + esc(l.basis) : '') + ' · ' + esc(E.roomsText(l.rooms)) + '</div>').join('') + '</div>' +
        (r.budget || r.star ? '<div class="mini">' + esc([r.star ? r.star + '★' : '', r.budget].filter(Boolean).join(' · ')) + '</div>' : '') + (r.note ? '<div class="mini" style="white-space:pre-wrap">' + esc(r.note) + '</div>' : '') +
        (r.status === 'open' ? '<div class="mini" style="margin-top:6px">How far it has got' + (r.progressAt ? ' (set ' + esc(UI.when(r.progressAt)) + ')' : '') + ' — the rooms on the pink sheet say ' + pr + '%:</div>' +
          '<div class="prog">' + [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(p => '<button data-prog="' + p + '" data-req="' + esc(r.id) + '" class="' + (r.progress === p ? 'on' : '') + '"' + (canProg ? '' : ' disabled') + '>' + p + '</button>').join('') + '</div>' : '') +
        (r.status === 'open' && sh.length ? '<div class="short">Still short: ' + sh.slice(0, 6).map(x => '<b>' + esc(x.town) + ' ' + esc(UI.nice(x.date)) + '</b> ' + x.got + ' of ' + x.want).join(' · ') + (sh.length > 6 ? '…' : '') + '</div>' : '') +
        '<div class="acts">' +
        (r.status === 'draft' && canReq ? '<button class="btn sm" data-act="editreq" data-req="' + esc(r.id) + '">Edit</button><button class="btn sm p" data-act="sendreq" data-req="' + esc(r.id) + '">Send to reservations</button>' : '') +
        ((r.status === 'sent' || r.status === 'open') && canReq ? '<button class="btn sm" data-act="editreq" data-req="' + esc(r.id) + '">Change it</button>' : '') +
        (r.status === 'sent' && canProg ? '<button class="btn sm p" data-act="pickup" data-req="' + esc(r.id) + '">Pick it up</button>' : '') +
        (r.status === 'open' && canProg ? '<button class="btn sm p" data-act="secured" data-req="' + esc(r.id) + '">All secured</button>' : '') +
        '<button class="btn sm" data-act="reqsheet" data-req="' + esc(r.id) + '">' + I('print', 'sm') + 'Request sheet</button></div></div>';
    });

    /* The pink sheet */
    h += '<h4>Bookings — the pink sheet</h4>' + (books.length ? books.map(b => bookingCard(b, f, canBook)).join('') : '<div class="mini">None yet.</div>') +
      '<div class="acts">' + (canBook ? '<button class="btn p sm" data-act="newbook">' + I('plus', 'sm') + 'Add a hotel</button>' : '') +
      (books.length ? '<button class="btn sm" data-act="pink">' + I('print', 'sm') + 'Pink sheet</button>' : '') + '</div>';

    /* The green sheet: lunches and visits */
    h += '<h4>Lunches and visits — the green sheet</h4><div id="gs"><div class="mini">Loading…</div></div>';

    /* Rooming lists */
    if (f.status === 'confirmed' || f.status === 'closed') {
      h += '<h4>Rooming lists — from the client, then to each hotel</h4>' + E.POLICY.rooming.map(m => {
        const x = (f.rooming || {})[m], due = f.arrival ? D.addDays(f.arrival, -m) : '';
        return '<label class="chkrow"><input type="checkbox" data-room="' + m + '"' + (x ? ' checked' : '') + '>' + m + ' days before' + (due ? ' — ' + esc(UI.nice(due, true)) : '') +
          '<span class="mini">' + (x ? esc(short(x.by) + ' · ' + UI.when(x.at)) : due && due < data.today ? '<span class="late">overdue</span>' : '') + '</span></label>';
      }).join('');
    }
    side.innerHTML = h + '</div>';
    wireFile(f);
    greenSheet(f);
  }

  /* ── The green sheet: the Services Reservation Sheet, as the booking department keeps it ── */
  const KIND = { visit: 'Visit', lunch: 'Lunch', dinner: 'Dinner', entertainment: 'Entertainment', other: 'Other' };
  let gsData = null;
  async function greenSheet(f) {
    const box = $('#gs');
    try { gsData = await JOR.call('services.list', { ref: f.ref }); } catch (e) { if (box) box.innerHTML = '<div class="mini">' + esc(e.message) + '</div>'; return; }
    if (!$('#gs') || openRef !== f.ref) return;
    const L = gsData.lines, hd = gsData.header, canEdit = can('services.edit', f);
    const outline = (data.requests.filter(r => r.ref === f.ref && r.status !== 'cancelled').map(r => r.days || []).pop() || []).filter(d => d.morning || d.lunch || d.afternoon);
    $('#gs').innerHTML = (hd.nationality || hd.ageProfile || hd.lunchDetails ? '<div class="mini">' + esc([hd.nationality, hd.ageProfile ? 'ages ' + hd.ageProfile : '', hd.lunchDetails ? 'lunches: ' + hd.lunchDetails : ''].filter(Boolean).join(' · ')) + '</div>' : '') +
      (L.length ? '<div class="tw"><table class="t gst"><thead><tr><th>Day</th><th>Date</th><th>Time</th><th></th><th>Service</th><th>Notes</th><th>OAP</th><th>Tourplan</th><th>Booked</th></tr></thead><tbody>' +
        L.map(x => '<tr class="' + (x.checked ? 'chk' : '') + '"><td>' + esc(x.day) + '</td><td class="nw">' + esc(x.date ? UI.nice(x.date) : '') + '</td><td>' + esc(x.time) + '</td><td>' + esc(KIND[x.kind] || '') + '</td><td><b>' + esc(x.name) + '</b></td>' +
          '<td>' + esc(x.notes) + '</td><td>' + esc(x.oap === 'yes' ? 'Y' : x.oap === 'no' ? 'N' : '') + '</td><td>' + (x.tp ? '✓' + (x.seq ? ' #' + esc(x.seq) : '') : '') + '</td><td>' + (x.booked ? '✓' : '<span class="late">not yet</span>') + '</td></tr>').join('') +
        '</tbody></table></div><div class="mini">' + L.filter(x => x.booked).length + ' of ' + L.length + ' booked · ' + L.filter(x => x.checked).length + ' checked by the operations manager (highlighted)</div>' : '<div class="mini">Nothing on it yet.</div>') +
      '<div class="acts">' + (canEdit ? '<button class="btn sm p" data-gs="edit">' + I('doc', 'sm') + (L.length ? 'Fill in the green sheet' : 'Start the green sheet') + '</button>' : '') +
      (canEdit && !L.length && outline.length ? '<button class="btn sm" data-gs="outline">From the outline itinerary</button>' : '') +
      '<button class="btn sm" data-gs="print">' + I('print', 'sm') + 'Green sheet</button></div>';
    $('#gs').querySelectorAll('[data-gs]').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.gs === 'print') UI.sheet('Green sheet — ' + f.ref, greenPaper(f), true);
      else if (b.dataset.gs === 'edit') greenForm(f, L);
      else greenForm(f, [].concat.apply([], outline.map(d => [d.morning ? { date: d.date, time: '10:00', kind: 'visit', name: d.morning } : null, d.lunch ? { date: d.date, time: '13:00', kind: 'lunch', name: d.lunch } : null,
        d.afternoon ? { date: d.date, time: '15:00', kind: 'visit', name: d.afternoon } : null].filter(Boolean))));
    }));
  }
  function greenForm(f, lines) {
    const hd = gsData.header, rows = lines.map(x => Object.assign({}, x));
    while (rows.length < Math.max(6, lines.length + 3)) rows.push({ kind: 'visit' });
    const row = (x, i) => '<tr data-i="' + i + '"><td><input class="in" type="date" data-k="date" value="' + esc(x.date || '') + '"></td><td><input class="in" data-k="time" placeholder="12:30" value="' + esc(x.time || '') + '" style="width:70px"></td>' +
      '<td><select class="in" data-k="kind">' + UI.options(Object.keys(KIND).map(k => [k, KIND[k]]), x.kind || 'visit') + '</select></td><td><input class="in" data-k="name" list="gsSup" value="' + esc(x.name || '') + '"></td>' +
      '<td><input class="in" data-k="notes" value="' + esc(x.notes || '') + '"></td><td><select class="in" data-k="oap">' + UI.options([['', '—'], ['yes', 'Y'], ['no', 'N']], x.oap || '') + '</select></td>' +
      '<td class="nw"><input type="checkbox" data-k="tp"' + (x.tp ? ' checked' : '') + '> <input class="in" data-k="seq" placeholder="item" value="' + esc(x.seq || '') + '" style="width:56px"></td>' +
      '<td><input type="checkbox" data-k="booked"' + (x.booked ? ' checked' : '') + '></td><td><input type="checkbox" data-k="checked"' + (x.checked ? ' checked' : '') + '></td></tr>';
    UI.dialog({
      title: 'The green sheet — ' + f.ref, wide: true,
      body: '<div class="g3">' + UI.field('Nationality', UI.pick('nationality', 'nationality', hd.nationality || RU.NATIONALITY[hd.country] || RU.countryName(hd.country), { placeholder: 'Start typing — French, France…' })) +
        UI.field('Age profile', '<select class="in" name="ageProfile">' + UI.options([['', '—']].concat(RU.AGE_BANDS, hd.ageProfile && RU.AGE_BANDS.indexOf(hd.ageProfile) < 0 ? [hd.ageProfile] : []), hd.ageProfile || '') + '</select>') + UI.field('Lunch details', '<input class="in" name="lunchDetails" value="' + esc(hd.lunchDetails || '') + '" placeholder="e.g. two courses, tea or coffee">') + '</div>' +
        '<datalist id="gsSup">' + gsData.suppliers.map(x => '<option value="' + esc(x.name) + '">' + esc(x.town || '') + '</option>').join('') + '</datalist>' +
        '<div class="tw"><table class="t gsf"><thead><tr><th>Date</th><th>Time</th><th>Visit / lunch</th><th>Service</th><th>Notes</th><th>OAP rate</th><th>Tourplan · item</th><th>Booked</th><th>Checked</th></tr></thead><tbody>' + rows.map(row).join('') + '</tbody></table></div>' +
        '<div class="acts" style="justify-content:flex-start"><button class="btn sm" data-more>' + I('plus', 'sm') + 'More lines</button></div>' +
        '<p class="mini">Checked: the operations manager’s PCM check (step 11b) — the right time and date; it shows highlighted, as on the paper sheet.</p><div class="err" data-err></div>',
      foot: '<button class="btn" data-x>Cancel</button><button class="btn p" data-ok>Save</button>',
      on: (el, close) => {
        el.querySelector('[data-more]').addEventListener('click', () => { const tb = el.querySelector('.gsf tbody'), n = tb.children.length; tb.insertAdjacentHTML('beforeend', [0, 1, 2].map(i => row({ kind: 'visit' }, n + i)).join('')); });
        el.querySelector('[data-ok]').addEventListener('click', async () => {
          const lines = [...el.querySelectorAll('.gsf tbody tr')].map(tr => { const o = {}; tr.querySelectorAll('[data-k]').forEach(i => { o[i.dataset.k] = i.type === 'checkbox' ? i.checked : i.value.trim(); }); return o; })
            .filter(x => x.name || x.date || x.notes);
          const v = n => el.querySelector('[name=' + n + ']').value.trim();
          try { await JOR.call('services.save', { ref: f.ref, header: { nationality: v('nationality'), ageProfile: v('ageProfile'), lunchDetails: v('lunchDetails') }, lines: lines }); close(); UI.toast('Green sheet saved.'); greenSheet(f); }
          catch (e) { el.querySelector('[data-err]').textContent = e.message; }
        });
      }
    });
  }
  function greenPaper(f) {
    const L = gsData.lines, hd = gsData.header, tr = L.map(x => '<tr class="' + (x.checked ? 'chk' : '') + '"><td>' + esc(x.day) + '</td><td>' + esc(x.date ? UI.nice(x.date) : '') + '</td><td>' + esc(x.time) + '</td><td>' + esc(KIND[x.kind] || '') + '</td>' +
      '<td>' + esc(x.name) + '</td><td>' + esc(x.notes) + '</td><td class="c">' + esc(x.oap === 'yes' ? 'Y' : x.oap === 'no' ? 'N' : '') + '</td><td class="c">' + (x.tp ? '✓' : '') + '</td><td class="c">' + esc(x.seq) + '</td></tr>');
    for (let i = L.length; i < 20; i++) tr.push('<tr>' + new Array(10).join('<td>&nbsp;</td>') + '</tr>');
    return '<div class="paper green"><div class="gs-title">Services Reservation Sheet</div><table class="gs-head"><tbody><tr><th>Group Ref:</th><td>' + esc(f.ref + ' ' + (f.agent || '')) + '</td></tr><tr><th>Nationality:</th><td>' + esc(hd.nationality) + '</td></tr>' +
      '<tr><th>Pax:</th><td>' + esc(hd.pax) + '</td></tr><tr><th>Lunch Details:</th><td>' + esc(hd.lunchDetails) + '</td></tr><tr><th>Age Profile:</th><td>' + esc(hd.ageProfile) + '</td></tr></tbody></table>' +
      '<table class="gs-grid"><thead><tr>' + ['Day', 'Date', 'Time', 'Visit / Lunch', 'Service Name', 'Notes', 'OAP Rate Y/N', 'Tourplan', 'Number Item Seq'].map(x => '<th>' + x + '</th>').join('') + '</tr></thead><tbody>' + tr.join('') + '</tbody></table>' +
      '<div class="ps-foot">From JORIS, ' + esc(UI.nice(data.today, true)) + ' · highlighted: checked by the operations manager</div></div>';
  }

  function bookingCard(b, f, canBook) {
    const s = E.state(b, data.today), c = b.cancel || {};
    const gone = b.status === 'released' || b.status === 'expired';
    const bits = [E.roomsText(b.rooms), s.nights + ' night' + (s.nights === 1 ? '' : 's'), b.basis, b.hidden ? '' : b.ppn === '' ? 'no PP/PN rate' : UI.euro(b.ppn) + ' PP/PN' + (b.ssupp !== '' ? ', single ' + UI.euro(b.ssupp) : ''), b.confRef ? 'ref ' + b.confRef : '', b.alloc ? 'from our allocation' : ''].filter(Boolean);
    let money = 'Worth ' + UI.euro(s.value);
    if (b.status === 'confirmed' && b.terms) money += s.pct ? ' · cancelling today costs <b class="late">' + esc(UI.euro(s.exposure)) + '</b> (' + s.pct + '%)' : ' · free to cancel today';
    if (s.step && s.chargeable) money += ' · ' + s.step.pct + '% from ' + esc(UI.nice(s.step.on, true));
    if (b.status === 'confirmed' && !b.terms) money += ' · <span class="late">no cancellation terms recorded</span>';
    if (b.status === 'cancelled') money = 'Cancelled ' + esc(UI.when(c.sentAt)) + ' (' + esc(c.reason || '') + ') · ' + (c.pct ? c.pct + '% payable then, ' + esc(UI.euro(c.cost)) : 'nothing payable then') +
      ' · <b class="late">not acknowledged</b>' + (c.chases && c.chases.length ? ' · chased ' + c.chases.length + '×' : '');
    if (b.status === 'released') money = c.ackRef === 'option' ? 'Option let go ' + esc(UI.when(c.sentAt)) + ' — no cost' : 'Released ' + esc(UI.when(c.ackAt)) + ', the hotel’s reference ' + esc(c.ackRef || '');
    const act = (a, label, cls) => '<button class="btn sm ' + (cls || '') + '" data-act="' + a + '" data-b="' + esc(b.id) + '">' + label + '</button>';
    return '<div class="bk' + (gone ? ' gone' : '') + '"><div class="top2"><b>' + esc(b.hotel) + '</b><span class="mini">' + esc(b.town) + '</span><span class="sp"></span>' + statusPill(b, s) + '</div>' +
      '<div class="mini">' + esc(UI.nice(b.checkIn, true)) + ' – ' + esc(UI.nice(b.checkOut, true)) + ' · ' + esc(bits.join(' · ')) + '</div>' +
      '<div class="money">' + money + '</div>' + (b.comment ? '<div class="mini">' + esc(b.comment) + '</div>' : '') +
      (canBook ? '<div class="acts">' +
        (b.status === 'provisional' ? act('confirm', 'Confirmed', 'p') + act('extend', 'Extend the option') + act('drop', 'Let it go', 'dngr') : '') +
        (b.status === 'confirmed' ? act('tp', b.tp ? I('check', 'sm') + 'On Tourplan' : 'Entered on Tourplan?') + act('cancel', 'Cancel', 'dngr') : '') +
        (b.status === 'cancelled' ? act('ack', 'Hotel acknowledged', 'p') + act('chase', 'Chased them') : '') +
        (E.LIVE[b.status] ? act('edit', 'Pink sheet details') : '') + '</div>' : '') + '</div>';
  }

  async function refresh(msg) { await load(); render(); if (openRef) paintFile(); if (msg) UI.toast(msg); }
  async function act(fn, msg) {
    try { await fn(); await refresh(msg); }
    catch (e) { if (e.stale) { await refresh(); UI.toast(e.message, 6000); } else UI.toast(e.message, 5000); }
  }
  const ask = (title, body, ok, run, danger) => UI.dialog({
    title: title, body: body + '<div class="err" data-err></div>', foot: '<button class="btn" data-x>Cancel</button><button class="btn ' + (danger ? 'dngr' : 'p') + '" data-ok>' + esc(ok) + '</button>',
    on: (el, close) => el.querySelector('[data-ok]').addEventListener('click', async () => {
      try { const m = await run(el); close(); await refresh(m); } catch (e) { if (e.stale) { close(); await refresh(); UI.toast(e.message, 6000); } else el.querySelector('[data-err]').textContent = e.message; }
    })
  });

  function wireFile(f) {
    const side = $('#side');
    side.querySelector('[data-close]').addEventListener('click', closeFile);
    side.querySelectorAll('[data-prog]').forEach(b => b.addEventListener('click', () => act(() => JOR.call('request.progress', { id: b.dataset.req, progress: +b.dataset.prog }), 'Progress ' + b.dataset.prog + '%.')));
    side.querySelectorAll('[data-room]').forEach(c => c.addEventListener('change', () => act(() => JOR.call('rooming.mark', { ref: f.ref, milestone: +c.dataset.room, on: c.checked }), c.checked ? 'Rooming list ticked as sent.' : 'Unticked.')));
    side.querySelectorAll('[data-act]').forEach(btn => btn.addEventListener('click', () => {
      const a = btn.dataset.act, b = data.bookings.find(x => x.id === btn.dataset.b), r = data.requests.find(x => x.id === btn.dataset.req);
      if (a === 'newreq') requestForm(f);
      else if (a === 'editreq') requestForm(f, r);
      else if (a === 'sendreq') sendRequest(r);
      else if (a === 'pickup') act(() => JOR.call('request.pickup', { id: r.id }), 'Picked up — it is yours.');
      else if (a === 'secured') act(() => JOR.call('request.status', { id: r.id, status: 'complete' }), 'Marked as all secured.');
      else if (a === 'reqsheet') UI.sheet('Accommodation request sheet — ' + f.ref, requestSheet(r, f), false);
      else if (a === 'pink') UI.sheet('Pink sheet — ' + f.ref, pinkSheet(f), true);
      else if (a === 'newbook') bookingForm(f);
      else if (a === 'edit') bookingForm(f, b);
      else if (a === 'confirm') ask('Confirmed — ' + b.hotel, UI.field('The hotel’s confirmation reference', '<input class="in" name="c" data-focus>', 'Without it there is nothing to quote back to them.'), 'Confirm it',
        el => JOR.call('booking.confirm', { id: b.id, rev: b.rev, confRef: el.querySelector('[name=c]').value }).then(() => b.hotel + ' confirmed.'));
      else if (a === 'extend') ask('Extend the option — ' + b.hotel, UI.field('Held until', '<input class="in" type="date" name="d" value="' + esc(b.optionDate || '') + '" data-focus>'), 'Save',
        el => JOR.call('booking.extend', { id: b.id, rev: b.rev, optionDate: el.querySelector('[name=d]').value }).then(() => 'Option extended.'));
      else if (a === 'drop') ask('Let the option go — ' + b.hotel, '<p>An option costs nothing to drop. Tell the hotel too.</p>' + UI.field('Why (optional)', '<input class="in" name="w" data-focus>'), 'Let it go',
        el => JOR.call('booking.drop', { id: b.id, rev: b.rev, reason: el.querySelector('[name=w]').value }).then(() => 'Option let go.'), true);
      else if (a === 'cancel') {
        const s = E.state(b, data.today);
        ask('Cancel ' + b.hotel + '?', '<p>' + (s.pct ? 'Today ' + s.pct + '% is payable: <b>' + esc(UI.euro(s.exposure)) + '</b>.' : 'Today it is free to cancel.') + ' The figure is written down now, and the booking stays open until the hotel acknowledges it with their release reference.</p>' +
          UI.field('Why?', '<input class="in" name="w" data-focus placeholder="e.g. Group down to 20">'), 'Send the cancellation',
          el => JOR.call('booking.cancel', { id: b.id, rev: b.rev, reason: el.querySelector('[name=w]').value }).then(() => 'Cancellation recorded — waiting for the hotel to acknowledge.'), true);
      }
      else if (a === 'ack') ask('The hotel acknowledged — ' + b.hotel, UI.field('Their release reference', '<input class="in" name="r" data-focus>', 'Their email or letter saying the rooms are released.'), 'Close it',
        el => JOR.call('booking.ack', { id: b.id, rev: b.rev, ackRef: el.querySelector('[name=r]').value }).then(() => 'Released.'));
      else if (a === 'chase') act(() => JOR.call('booking.chase', { id: b.id, rev: b.rev }), 'Chase recorded.');
      else if (a === 'tp') act(() => JOR.call('booking.tp', { id: b.id, on: !b.tp }), b.tp ? 'Tourplan tick removed.' : 'Ticked as on Tourplan.');
      else if (a === 'release') ask('Release every room on ' + f.ref + '?', '<p>Options are let go at no cost. Confirmed bookings are cancelled, with today’s cost written down, and stay open until each hotel acknowledges.</p>', 'Release them',
        () => JOR.call('res.release', { ref: f.ref }).then(r => r.released + ' released' + (r.cost ? ' — ' + UI.euro(r.cost) + ' payable unless the hotels waive it' : '') + '.'), true);
    }));
  }

  function sendRequest(r) {
    const res = data.people.filter(p => p.role === 'reservations' || p.role === 'management');
    ask('Send to reservations', UI.field('To', '<select class="in" name="to" data-focus>' + UI.options(res.map(p => [p.id, p.name + (p.id === data.resLead ? ' — leads reservations' : '')]), data.resLead || '') + '</select>',
      'A named person — never a shared list, or everyone thinks someone else is doing it. They get an email.'), 'Send it',
      el => JOR.call('request.send', { id: r.id, to: el.querySelector('[name=to]').value }).then(() => 'Sent to ' + nameOf(el.querySelector('[name=to]').value) + '.'));
  }

  /* ── The outline itinerary, night by night, becomes the request ── */
  function requestForm(f, r) {
    r = r || { rooms: {}, days: [] };
    const first = (r.lines && r.lines[0] && r.lines[0].rooms) || r.rooms || {};
    const nights = [];
    if (r.days && r.days.length) r.days.forEach(d => nights.push(d));
    else if (f.arrival && f.departure) for (let d = f.arrival; d < f.departure; d = D.addDays(d, 1)) nights.push({ date: d, town: '', hotel: '', basis: 'BB' });
    const towns = [...new Set(data.hotels.map(h => h.town).filter(Boolean))].sort();
    const row = d => '<tr><td class="d" data-date="' + esc(d.date) + '">' + esc(UI.nice(d.date, true)) + '</td>' +
      '<td><input class="in" name="town" list="townList" value="' + esc(d.town || '') + '" placeholder="Town or area"></td>' +
      '<td><input class="in" name="hotel" list="hotelList" value="' + esc(d.hotel || '') + '" placeholder="Preference, e.g. Galway Bay Hotel"></td>' +
      '<td><select class="in" name="basis">' + UI.options(RU.BASES, d.basis || 'BB') + '</select></td>' +
      '<td><input class="in" name="morning" value="' + esc(d.morning || '') + '" placeholder="Morning"></td><td><input class="in" name="lunch" value="' + esc(d.lunch || '') + '" placeholder="Lunch"></td>' +
      '<td><input class="in" name="afternoon" value="' + esc(d.afternoon || '') + '" placeholder="Afternoon"></td><td><button class="btn sm ghost" data-del title="Take this night out">' + I('x', 'sm') + '</button></td></tr>';
    UI.dialog({
      title: (r.id ? 'Accommodation request — ' : 'Outline itinerary and accommodation request — ') + f.ref, wide: true,
      body: '<p class="mini" style="margin-top:0">Night by night: where they stay, and what they do. Reservations get one line per stop — nothing is typed twice.</p>' +
        '<datalist id="townList">' + towns.map(t => '<option value="' + esc(t) + '">').join('') + '</datalist><datalist id="hotelList">' + data.hotels.map(h => '<option value="' + esc(h.name) + '">' + esc(h.town) + '</option>').join('') + '</datalist>' +
        '<div class="rooms">' + E.ROOM_TYPES.map(t => UI.field(t.name + 's', '<input class="in" type="number" min="0" name="r_' + t.id + '" value="' + esc(first[t.id] || '') + '">')).join('') + '</div>' +
        '<div class="g3">' + UI.field('Star rating', '<select class="in" name="star">' + UI.options([['', 'Any']].concat(RU.STARS, r.star && !RU.STARS.some(x => x[0] === String(r.star)) ? [[r.star, r.star]] : []), r.star || '') + '</select>') + UI.field('Budget', '<input class="in" name="budget" value="' + esc(r.budget || '') + '" placeholder="e.g. €1,450 pp">') +
        UI.field('Rooms in all', '<input class="in" name="sum" disabled>') + '</div>' +
        '<div class="tw"><table class="days"><thead><tr><th>Night</th><th>Stay in</th><th>Hotel</th><th>Basis</th><th>Morning</th><th>Lunch</th><th>Afternoon</th><th></th></tr></thead><tbody data-days>' + nights.map(row).join('') + '</tbody></table></div>' +
        '<div class="acts"><button class="btn sm" data-add>' + I('plus', 'sm') + 'Another night</button></div>' +
        UI.field('Notes for reservations', '<textarea class="in" name="note">' + esc(r.note || '') + '</textarea>') + '<div class="okbox" data-prev></div><div class="err" data-err></div>',
      foot: '<button class="btn" data-x>Cancel</button><button class="btn' + (r.id ? ' p' : '') + '" data-ok>' + (r.id ? 'Save' : 'Save as a draft') + '</button>' + (!r.id && !f.selfBook ? '<button class="btn p" data-send>Save and send to reservations</button>' : ''),
      on: (el, close) => {
        const read = () => {
          const rooms = {};
          E.ROOM_TYPES.forEach(t => { const v = +el.querySelector('[name=r_' + t.id + ']').value; if (v > 0) rooms[t.id] = v; });
          const days = Array.from(el.querySelectorAll('[data-days] tr')).map(tr => {
            const g = n => tr.querySelector('[name=' + n + ']').value.trim();
            return { date: tr.querySelector('[data-date]').dataset.date, town: g('town'), hotel: g('hotel'), basis: g('basis'), morning: g('morning'), lunch: g('lunch'), afternoon: g('afternoon') };
          });
          return { id: r.id, rev: r.rev, ref: f.ref, rooms: rooms, star: el.querySelector('[name=star]').value, budget: el.querySelector('[name=budget]').value, note: el.querySelector('[name=note]').value, days: days };
        };
        const prev = () => {
          const x = read(), lines = E.linesFromDays(x.days, x.rooms, x.star);
          el.querySelector('[name=sum]').value = E.roomsText(x.rooms);
          el.querySelector('[data-prev]').innerHTML = lines.length ? '<b>Reservations will see:</b><br>' + lines.map(l => esc(UI.nice(l.from) + ' – ' + UI.nice(l.to) + ': ' + l.town + (l.hotel ? ' (' + l.hotel + ')' : '') + (l.basis ? ', ' + l.basis : ''))).join('<br>') : 'Fill in where they stay each night.';
        };
        el.addEventListener('input', prev); el.addEventListener('change', prev); prev();
        el.querySelector('[data-days]').addEventListener('click', e => { const b = e.target.closest('[data-del]'); if (b) { b.closest('tr').remove(); prev(); } });
        el.querySelector('[data-add]').addEventListener('click', () => {
          const trs = el.querySelectorAll('[data-days] tr'), last = trs.length ? trs[trs.length - 1].querySelector('[data-date]').dataset.date : (f.arrival || data.today);
          const t = document.createElement('tbody'); t.innerHTML = row({ date: trs.length ? D.addDays(last, 1) : last, basis: 'BB' });
          el.querySelector('[data-days]').appendChild(t.firstElementChild); prev();
        });
        const go = async send => {
          try {
            const res = await JOR.call('request.save', { request: read() });
            if (send) { close(); await refresh(); sendRequest(res.request); return; }
            close(); await refresh('Saved.');
          } catch (e) { if (e.stale) { close(); await refresh(); UI.toast(e.message, 6000); } else el.querySelector('[data-err]').textContent = e.message; }
        };
        el.querySelector('[data-ok]').addEventListener('click', () => go(false));
        const s = el.querySelector('[data-send]'); if (s) s.addEventListener('click', () => go(true));
      }
    });
  }

  /* ── A hotel on the pink sheet ── */
  function bookingForm(f, b) {
    const isNew = !b;
    b = b || { rooms: {}, basis: 'BB', status: 'provisional', checkIn: f.arrival || '', checkOut: f.arrival ? D.addDays(f.arrival, 1) : '' };
    const req = data.requests.find(r => r.ref === f.ref && r.status !== 'cancelled');
    if (isNew && req && req.lines[0]) b.rooms = Object.assign({}, req.lines[0].rooms);
    UI.dialog({
      title: (isNew ? 'Add a hotel — ' : 'Pink sheet details — ') + (isNew ? f.ref : b.hotel), wide: true,
      body: '<datalist id="hotelList2">' + data.hotels.map(h => '<option value="' + esc(h.name) + '">' + esc(h.town) + '</option>').join('') + '</datalist>' +
        (isNew ? '<div class="g2">' + UI.field('Hotel', '<input class="in" name="hotel" list="hotelList2" data-focus autocomplete="off">', 'One on the list brings its rate for the year and its cancellation terms.') +
          UI.field('Town', '<input class="in" name="town">') + '</div>' : '') +
        '<div class="g4">' + UI.field('Check-in', '<input class="in" type="date" name="checkIn" value="' + esc(b.checkIn) + '">') + UI.field('Check-out', '<input class="in" type="date" name="checkOut" value="' + esc(b.checkOut) + '">') +
        UI.field('Basis', '<select class="in" name="basis">' + UI.options(RU.BASES, b.basis || 'BB') + '</select>') + UI.field('Hotel contact', '<input class="in" name="contact" value="' + esc(b.contact || '') + '">') + '</div>' +
        '<div class="rooms">' + E.ROOM_TYPES.map(t => UI.field(t.name, '<input class="in" type="number" min="0" name="r_' + t.id + '" value="' + esc((b.rooms || {})[t.id] || '') + '">')).join('') + '</div>' +
        '<div class="g4">' + UI.field('PP/PN rate (€)', UI.moneyIn('ppn', b.ppn), 'Per person sharing, per night.' + (isNew ? ' Blank: from the rates list.' : '')) + UI.field('Single supplement (€)', UI.moneyIn('ssupp', b.ssupp)) +
        UI.field('Allocation', '<label class="chkrow"><input type="checkbox" name="alloc"' + (b.alloc ? ' checked' : '') + '> Taken from our allocation with this hotel</label>') +
        (isNew ? UI.field('Status', '<select class="in" name="status">' + UI.options([['provisional', 'On option'], ['confirmed', 'Confirmed']], 'provisional') + '</select>') : UI.field('Option held until', '<input class="in" type="date" name="optionDate" value="' + esc(b.optionDate || '') + '"' + (b.status === 'provisional' ? '' : ' disabled') + '>')) + '</div>' +
        (isNew ? '<div class="g2">' + UI.field('Option held until', '<input class="in" type="date" name="optionDate">') + UI.field('Confirmation reference', '<input class="in" name="confRef">', 'If it is confirmed already.') + '</div>' : '') +
        UI.field('Comment', '<input class="in" name="comment" value="' + esc(b.comment || '') + '">') + '<div class="mini" data-val></div><div class="err" data-err></div>',
      foot: '<button class="btn" data-x>Cancel</button><button class="btn p" data-ok>' + (isNew ? 'Add it' : 'Save') + '</button>',
      on: (el, close) => {
        UI.money(el);
        const hotel = el.querySelector('[name=hotel]');
        if (hotel) hotel.addEventListener('change', () => { const h = data.hotels.find(x => x.name.toLowerCase() === hotel.value.trim().toLowerCase()); if (h) { el.querySelector('[name=town]').value = h.town; if (h.contact && !el.querySelector('[name=contact]').value) el.querySelector('[name=contact]').value = h.contact; } });
        const v = n => { const x = el.querySelector('[name=' + n + ']'); return x ? x.value.trim() : undefined; };
        const read = () => {
          const rooms = {};
          E.ROOM_TYPES.forEach(t => { const n = +v('r_' + t.id); if (n > 0) rooms[t.id] = n; });
          const o = { ref: f.ref, checkIn: v('checkIn'), checkOut: v('checkOut'), basis: v('basis'), contact: v('contact'), rooms: rooms, ppn: UI.num(v('ppn')), ssupp: UI.num(v('ssupp')), alloc: el.querySelector('[name=alloc]').checked ? 'yes' : '', comment: v('comment'), optionDate: v('optionDate') };
          if (isNew) { const h = data.hotels.find(x => x.name.toLowerCase() === (v('hotel') || '').toLowerCase() && (!v('town') || x.town.toLowerCase() === v('town').toLowerCase())); Object.assign(o, { hotel: v('hotel'), town: v('town'), supplierId: h ? h.id : '', status: v('status'), confRef: v('confRef') }); }
          else Object.assign(o, { id: b.id, rev: b.rev });
          return o;
        };
        const val = () => { const x = read(); const n = x.checkIn && x.checkOut ? D.diffDays(x.checkIn, x.checkOut) : 0; el.querySelector('[data-val]').textContent = n > 0 && x.ppn !== '' ? 'Worth ' + UI.euro(E.value(Object.assign({}, x, { status: 'confirmed' }))) + ' — ' + n + ' night' + (n === 1 ? '' : 's') + ', ' + E.roomsText(x.rooms) + '.' : ''; };
        el.addEventListener('input', val); val();
        el.querySelector('[data-ok]').addEventListener('click', async () => {
          try { await JOR.call('booking.save', { booking: read() }); close(); await refresh(isNew ? 'Added to the pink sheet.' : 'Saved.'); }
          catch (e) { if (e.stale) { close(); await refresh(); UI.toast(e.message, 6000); } else el.querySelector('[data-err]').textContent = e.message; }
        });
      }
    });
  }

  /* ══ The two paper forms, filled in from the record ═════════════════ */
  const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const tick = on => on ? '✓' : '';
  function pinkSheet(f) {
    const rows = data.bookings.filter(b => b.ref === f.ref).sort((x, y) => x.checkIn < y.checkIn ? -1 : 1);
    const clerk = (rows.find(b => b.bookedBy) || {}).bookedBy;
    const tr = rows.map(b => {
      const gone = b.status === 'cancelled' || b.status === 'released', c = b.cancel || {};
      const extra = [b.rooms.triple ? b.rooms.triple + ' triple' : '', b.confRef ? 'Ref ' + b.confRef : '', b.status === 'cancelled' ? 'not acknowledged' : '', c.ackRef && c.ackRef !== 'option' ? 'release ' + c.ackRef : '', b.comment].filter(Boolean);
      return '<tr' + (gone ? ' class="gone"' : '') + '><td class="nw">' + esc(UI.nice(b.checkIn)) + ' – ' + esc(UI.nice(b.checkOut)) + '</td><td>' + esc(b.hotel) + '</td><td>' + esc(b.contact) + '</td><td>' + esc(b.basis) + '</td>' +
        '<td class="n">' + (b.rooms.twin || '') + '</td><td class="n">' + (b.rooms.double || '') + '</td><td class="n">' + (b.rooms.single || '') + '</td><td class="nw">' + esc(b.optionDate ? UI.nice(b.optionDate) : '') + '</td>' +
        '<td class="tick">' + tick(b.status === 'provisional') + '</td><td class="tick">' + tick(b.status === 'confirmed') + '</td><td class="tick">' + tick(gone) + '</td>' +
        (b.hidden ? '<td></td>' : b.ppn !== '' ? '<td class="nw">' + esc(UI.euro(b.ppn)) + (b.ssupp !== '' ? '<div class="ss">SS ' + esc(UI.euro(b.ssupp)) + '</div>' : '') + '</td>' : '<td class="miss">not written down</td>') +
        '<td class="tick">' + tick(b.alloc) + '</td><td class="tick">' + tick(b.tp) + '</td><td>' + esc(extra.join(' · ')) + '</td></tr>';
    });
    for (let i = rows.length; i < 14; i++) tr.push('<tr class="blank">' + new Array(16).join('<td>&nbsp;</td>') + '</tr>');
    return '<div class="paper pink"><div class="ps-title">ACCOMMODATION RESERVATIONS SHEET</div><table class="ps-head"><tr><th>Today’s Date:</th><td>' + esc(UI.nice(data.today, true)) + '</td><th>Group Ref:</th><td>' + esc(f.ref) + '</td>' +
      '<th>Res Clerk:</th><td>' + esc(nameOf(clerk)) + '</td></tr><tr><th>Agent:</th><td>' + esc(f.agent) + '</td><th>Tour:</th><td>' + esc(f.tourName || '') + '</td><th>Acc Exec:</th><td>' + esc(nameOf(f.am)) + '</td></tr></table>' +
      '<table class="ps-grid"><thead><tr>' + ['Dates:', 'Hotels:', 'Contact:', 'Basis:', 'Twin', 'Dbl', 'Sg.', 'Option Date:', 'Prov', 'Conf', 'Canc', 'PP/PN Rate', 'Alloc', 'T/P', 'Comment:'].map(x => '<th>' + x + '</th>').join('') + '</tr></thead><tbody>' + tr.join('') + '</tbody></table>' +
      '<div class="ps-foot">' + esc([f.tourName, f.pax ? f.pax + ' pax' : ''].filter(Boolean).join(' · ')) + ' · from JORIS, ' + esc(UI.nice(data.today, true)) + '</div></div>';
  }
  function requestSheet(r, f) {
    const first = (r.lines[0] || {}).rooms || {};
    let nights = 0;
    const rows = [];
    r.lines.forEach(l => {
      const n = D.diffDays(l.from, l.to), other = JSON.stringify(l.rooms) !== JSON.stringify(first);
      for (let k = 0; k < n; k++) {
        const d = D.addDays(l.from, k);
        nights++;
        rows.push('<tr><td>' + esc(UI.nice(d)) + '</td><td>' + DAY[D.dow(d)] + '</td><td>' + esc(l.basis || '') + '</td><td>' + esc((l.hotel ? l.hotel + (l.hotel.indexOf(l.town) < 0 ? ', ' + l.town : '') : l.town) + (k === 0 && other ? ' — ' + E.roomsText(l.rooms) : '')) + '</td></tr>');
      }
    });
    for (let i = rows.length; i < 14; i++) rows.push('<tr class="blank"><td>&nbsp;</td><td></td><td></td><td></td></tr>');
    const notes = [r.note].concat((r.days || []).filter(d => d.notes).map(d => UI.nice(d.date) + ': ' + d.notes)).filter(Boolean);
    return '<div class="paper"><div class="rs-title">Accommodation Request Sheet</div><table class="rs-head">' +
      '<tr><th>Group Ref</th><td colspan="3">' + esc(f.ref) + '</td></tr><tr><th>Agency</th><td colspan="3">' + esc(f.agent) + '</td></tr>' +
      '<tr><th>No of Pax</th><td colspan="3">' + esc(f.pax || '') + '</td></tr><tr><th rowspan="2">Breakdown</th><td class="c">Singles</td><td class="c">Twins/ Doubles</td><td class="c">Triple</td></tr>' +
      '<tr><td class="c">' + (first.single || 0) + '</td><td class="c">' + ((first.twin || 0) + (first.double || 0)) + '</td><td class="c">' + (first.triple || 0) + '</td></tr>' +
      '<tr><th>Star Rating</th><td colspan="3">' + esc(r.star || '') + '</td></tr><tr><th>Budget</th><td colspan="3">' + esc(r.budget || '') + '</td></tr><tr><th>No of Nights</th><td colspan="3">' + nights + '</td></tr></table>' +
      '<table class="rs-grid"><thead><tr><th>Date</th><th>Day</th><th>Basis</th><th>Hotel/Location</th></tr></thead><tbody>' + rows.join('') + '</tbody></table>' +
      '<div class="rs-notes"><u>Notes</u>' + notes.map(n => '<p>' + esc(n) + '</p>').join('') + '</div>' +
      '<div class="ps-foot">Raised by ' + esc(nameOf(r.by)) + (r.sentAt ? ' on ' + esc(UI.nice(r.sentAt, true)) : '') + ' · from JORIS</div></div>';
  }

  /* ══ Start ══════════════════════════════════════════════════════════ */
  try { await load(); } catch (e) { $('#view').innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; return; }
  render();
  if (qs.get('ref')) openFile(qs.get('ref'));
  window.addEventListener('hashchange', () => { const r = new URLSearchParams(location.hash.slice(1)).get('ref'); if (r && r !== openRef) openFile(r); });
  window.JORRES = { data: () => data, openFile: openFile };
})();
