/* ═══════════════════════════════════════════════════════════════════════
   JORIS — Complaints
   Every complaint, from the form or logged by hand: acknowledged, passed
   to whoever can fix it, looked after by someone, and put right. The QR
   codes for the form — one for anywhere, one for each group — and the log
   as JOR has always kept it, in Excel.
   ═══════════════════════════════════════════════════════════════════════ */
(async function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = UI.esc, I = UI.icon, RU = window.JOR_RULES;
  const me = await JOR.me();
  UI.topBar('Complaints', 'JORIS', me);
  if (!me.perms['complaints.view']) { $('#view').innerHTML = '<div class="card pad empty">Complaints are for management, operations, reservations and each file’s account manager.</div>'; return; }
  const FORM = JOR.ROOT + 'complaint/';
  const ST = { new: 'New', acknowledged: 'Acknowledged', resolved: 'Put right' };
  let d = null, filter = 'open', search = '';
  const hash = () => new URLSearchParams(location.hash.slice(1));

  $('#add').innerHTML = I('plus', 'sm') + 'Log a complaint';
  $('#qr').innerHTML = I('hash', 'sm') + 'QR codes';
  $('#xl').innerHTML = I('down', 'sm') + 'The log in Excel';
  if (!me.perms['complaints.log']) $('#add').classList.add('hidden');

  async function load() {
    try { d = await JOR.call('complaints.list'); } catch (e) { $('#view').innerHTML = '<div class="card pad empty">' + esc(e.message) + '</div>'; return; }
    draw();
    const h = hash();
    if (h.get('complaint')) { const c = d.complaints.find(x => x.id === h.get('complaint')); if (c) open(c); }
    else if (h.get('qr')) qrDialog(h.get('qr'));
  }
  const nameOf = id => (d.people.find(p => p.id === id) || {}).name || '';
  function shown() {
    const s = search.toLowerCase();
    return d.complaints.filter(c => (filter === 'all' || (filter === 'open' ? c.status !== 'resolved' : c.status === filter)) &&
      (!s || [c.num, c.ref, c.agent, c.name, c.groupName, c.what, c.where, c.sentTo].join(' ').toLowerCase().includes(s)));
  }
  function draw() {
    const n = k => d.complaints.filter(c => (k === 'open' ? c.status !== 'resolved' : k === 'all' ? true : c.status === k)).length;
    $('#chips').innerHTML = [['open', 'Open'], ['new', 'New'], ['resolved', 'Put right'], ['all', 'All']].map(x => '<button data-f="' + x[0] + '" class="' + (filter === x[0] ? 'on' : '') + '">' + x[1] + '<b>' + n(x[0]) + '</b></button>').join('');
    const list = shown();
    $('#view').innerHTML = list.length ? '<div class="card tw"><table class="t"><thead><tr><th>Number</th><th>In</th><th>File</th><th>From</th><th>What happened</th><th>Status</th><th>Looked after by</th></tr></thead><tbody>' +
      list.map(c => '<tr class="clk" data-id="' + esc(c.id) + '"><td class="nw"><b>' + esc(c.num) + '</b></td><td class="nw">' + esc(UI.when(c.received)) + '</td>' +
        '<td class="nw">' + (c.ref ? '<span class="ref">' + esc(c.ref) + '</span> ' + esc(c.agent || '') : esc(c.groupName || '—')) + '</td>' +
        '<td>' + esc((d.roles[c.role] || '').replace(/^(A|The) /, '')) + (c.name ? '<div class="mini">' + esc(c.name) + '</div>' : '') + '</td>' +
        '<td><div class="what">' + esc(c.what) + '</div><div class="mini">' + esc(d.via[c.via] || '') + (c.lang === 'fr' ? ' · in French' : '') + '</div></td>' +
        '<td><span class="pill ' + esc(c.status) + '">' + esc(ST[c.status]) + '</span></td><td>' + esc(c.ownerName || (c.status !== 'resolved' ? nameOf(d.lead) : '')) + '</td></tr>').join('') + '</tbody></table></div>'
      : '<div class="card pad empty">' + (d.complaints.length ? 'None here.' : 'No complaints yet. The QR codes take people straight to the form.') + '</div>';
  }
  $('#chips').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) { filter = b.dataset.f; draw(); } });
  $('#q').addEventListener('input', e => { search = e.target.value.trim(); draw(); });
  $('#view').addEventListener('click', e => { const r = e.target.closest('tr[data-id]'); if (r) open(d.complaints.find(c => c.id === r.dataset.id)); });

  /* One complaint: what was said, and what has been done about it. */
  function open(c) {
    const may = RU.can(me, 'complaints.manage', { am: c.am });
    history.replaceState(null, '', '#complaint=' + c.id);
    const kv = [['Number', c.num], ['In', UI.when(c.received) + ' · ' + (d.via[c.via] || '')], ['File', c.ref ? c.ref + ' ' + (c.agent || '') : ''], ['Group, as they wrote it', c.groupName],
      ['From', (d.roles[c.role] || '') + (c.name ? ' — ' + c.name : '')], ['Contact', c.contact], ['When it happened', c.travelDate ? UI.nice(c.travelDate, true) : ''], ['Where', c.where],
      ['Account manager', c.amName], ['Acknowledged', c.ackAt ? UI.when(c.ackAt) + ' · ' + c.ackBy : ''], ['Put right', c.resolvedAt ? UI.when(c.resolvedAt) + ' · ' + c.resolvedBy : '']].filter(x => x[1]);
    UI.dialog({
      title: c.num + ' — ' + ST[c.status], wide: true,
      body: '<div class="cdet"><blockquote>' + esc(c.what) + '</blockquote>' + (c.wish ? '<p><b>What they would like:</b> ' + esc(c.wish) + '</p>' : '') +
        '<div class="kv">' + kv.map(x => '<div><span>' + esc(x[0]) + '</span>' + esc(x[1]) + '</div>').join('') + '</div>' +
        (c.ref ? '<p class="mini"><a href="../register/#ref=' + encodeURIComponent(c.ref) + '">Open ' + esc(c.ref) + ' in the register</a></p>' : '') +
        (may ? '<div class="g2">' + UI.field('Passed to', '<input class="in" name="sentTo" value="' + esc(c.sentTo) + '" placeholder="e.g. the hotel’s manager, the coach company">', 'Who it has gone to, to be put right — as on the old Complaints Log.') +
          UI.field('Looked after by', '<select class="in" name="owner">' + UI.options([['', (nameOf(d.lead) || 'whoever looks after complaints') + ' (Settings)']].concat(d.people.map(p => [p.id, p.name])), c.owner) + '</select>') + '</div>' +
          UI.field('What was done to put it right', '<textarea class="in" name="resolution" placeholder="An apology, a refund, a word with the hotel…">' + esc(c.resolution) + '</textarea>')
          : (c.sentTo || c.resolution ? '<p><b>Passed to:</b> ' + esc(c.sentTo || '—') + '</p><p><b>What was done:</b> ' + esc(c.resolution || '—') + '</p>' : '')) +
        '<div class="err" data-err></div></div>',
      foot: '<button class="btn" data-x>Close</button>' + (may ? (c.status === 'new' ? '<button class="btn" data-do="ack">Acknowledged</button>' : '') +
        (c.status === 'resolved' ? '<button class="btn" data-do="reopen">Reopen</button>' : '<button class="btn" data-do="save">Save</button><button class="btn p" data-do="resolve">Put right — close it</button>') : ''),
      on: (el, close) => {
        const v = n => { const e = el.querySelector('[name=' + n + ']'); return e ? e.value.trim() : undefined; };
        el.querySelectorAll('[data-do]').forEach(b => b.addEventListener('click', async () => {
          const x = { id: c.id, rev: c.rev, sentTo: v('sentTo'), owner: v('owner'), resolution: v('resolution') };
          if (b.dataset.do === 'ack') x.ack = true;
          if (b.dataset.do === 'resolve') x.resolve = true;
          if (b.dataset.do === 'reopen') x.reopen = true;
          try {
            await JOR.call('complaint.update', x);
            close(); UI.toast({ ack: 'Acknowledged — tell them it is in hand.', resolve: c.num + ' is put right and closed.', reopen: 'Reopened.', save: 'Saved.' }[b.dataset.do]);
            history.replaceState(null, '', '#'); await load();
          } catch (e) { el.querySelector('[data-err]').textContent = e.message; if (e.stale) { close(); load(); } }
        }));
        el.closest('.scrim').addEventListener('mousedown', () => history.replaceState(null, '', '#'));
      }
    });
  }

  /* One that came by phone, email or in person. */
  $('#add').addEventListener('click', () => {
    UI.dialog({
      title: 'Log a complaint', wide: true,
      body: '<div class="g3">' + UI.field('How it came', '<select class="in" name="via">' + UI.options([['phone', 'Phone'], ['email', 'Email'], ['person', 'In person']], 'email') + '</select>') +
        UI.field('On', '<input class="in" type="date" name="receivedOn" value="' + UI.D.today() + '">') +
        UI.field('From', '<select class="in" name="role">' + UI.options(Object.keys(d.roles).map(k => [k, d.roles[k]]), 'agent') + '</select>') + '</div>' +
        '<div class="g3">' + UI.field('Reference', '<input class="in" name="ref" placeholder="27/1274" data-focus>') + UI.field('Name', '<input class="in" name="name">') + UI.field('Email or phone', '<input class="in" name="contact">') + '</div>' +
        '<div class="g2">' + UI.field('When it happened', '<input class="in" type="date" name="travelDate">') + UI.field('Where', '<input class="in" name="where" placeholder="Hotel, restaurant, coach…">') + '</div>' +
        UI.field('What happened', '<textarea class="in" name="what"></textarea>') + UI.field('What they would like', '<textarea class="in" name="wish" style="min-height:60px"></textarea>') + '<div class="err" data-err></div>',
      foot: '<button class="btn" data-x>Cancel</button><button class="btn p" data-ok>Log it</button>',
      on: (el, close) => el.querySelector('[data-ok]').addEventListener('click', async () => {
        const v = n => el.querySelector('[name=' + n + ']').value.trim(), x = {};
        ['via', 'receivedOn', 'role', 'ref', 'name', 'contact', 'travelDate', 'where', 'what', 'wish'].forEach(k => { x[k] = v(k); });
        try { const r = await JOR.call('complaint.log', { complaint: x }); close(); UI.toast(r.complaint.num + ' logged.'); await load(); }
        catch (e) { el.querySelector('[data-err]').textContent = e.message; }
      })
    });
  });

  /* The QR codes: the form for anyone, and one for each group with its reference filled in. */
  function qrSvg(text) {
    const q = qrcode(0, 'M'); q.addData(text); q.make();
    const n = q.getModuleCount(), m = 2;
    let p = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) p += 'M' + (c + m) + ' ' + (r + m) + 'h1v1h-1z';
    return '<svg viewBox="0 0 ' + (n + 2 * m) + ' ' + (n + 2 * m) + '" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="100%" height="100%" fill="#fff"/><path d="' + p + '" fill="#13251E"/></svg>';
  }
  const linkFor = ref => FORM + (ref ? '?ref=' + encodeURIComponent(ref) : '');
  const card = ref => '<div class="qcard"><img src="' + window.JOR_MARKS.logo + '" alt="JOR Ireland"><h2>Something not right? Tell us.</h2><h3>Un souci ? Dites-le-nous.</h3>' + qrSvg(linkFor(ref)) +
    (ref ? '<div class="ref">Group · Groupe ' + esc(ref) + '</div>' : '') + '<p>Scan with your phone’s camera · Scannez avec l’appareil photo de votre téléphone</p><p>' + esc(linkFor(ref)) + '</p></div>';
  function qrDialog(ref) {
    ref = RU.parseRef(ref || '') ? RU.parseRef(ref).ref : '';
    UI.dialog({
      title: 'QR codes for the complaint form', wide: true,
      body: '<div class="qrs"><div class="qrbox"><b>For anywhere</b><div class="mini">The office, the website, a welcome letter — it asks for the reference.</div>' + qrSvg(linkFor('')) + '<code>' + esc(linkFor('')) + '</code>' +
        '<div class="acts" style="justify-content:center"><button class="btn sm" data-print="">' + I('print', 'sm') + 'Print the card</button></div></div>' +
        '<div class="qrbox"><b>For one group</b><div class="mini">For the coach and the guide file: their reference is filled in, so it lands on the file.</div>' +
        '<div class="bar" style="margin:8px 0"><input class="in" name="ref" placeholder="27/1274" value="' + esc(ref) + '"><button class="btn" data-make>Make it</button></div><div data-one>' +
        (ref ? qrSvg(linkFor(ref)) + '<code>' + esc(linkFor(ref)) + '</code><div class="acts" style="justify-content:center"><button class="btn sm" data-print="' + esc(ref) + '">' + I('print', 'sm') + 'Print the card</button></div>' : '<div class="mini">Type a reference.</div>') +
        '</div></div></div>',
      on: (el, close) => {
        el.querySelector('[data-make]').addEventListener('click', () => { const r = el.querySelector('[name=ref]').value.trim(); if (!RU.parseRef(r)) { UI.toast('A reference like 27/1274.'); return; } close(); qrDialog(r); });
        el.querySelectorAll('[data-print]').forEach(b => b.addEventListener('click', () => UI.printSheet(card(b.dataset.print))));
      }
    });
  }
  $('#qr').addEventListener('click', () => qrDialog(''));

  /* The log, laid out as JOR's own Complaints Log, with what happened after. */
  $('#xl').addEventListener('click', () => {
    const head = ['Date of Complaint', 'Reference number', 'D.O.T', 'Group', 'Description of complaint', 'complaint acknowledged Y / N', 'Complaint sent to',
      'Number', 'From', 'Name', 'Contact', 'Where', 'What they would like', 'Status', 'What was done', 'Put right on', 'Came by'];
    const rows = d.complaints.slice().reverse().map(c => [UI.nice(String(c.received).slice(0, 10), true), c.ref, c.travelDate, c.agent || c.groupName, c.what, c.ackAt ? 'Y' : 'N', c.sentTo,
      c.num, d.roles[c.role] || '', c.name, c.contact, c.where, c.wish, ST[c.status], c.resolution, c.resolvedAt ? String(c.resolvedAt).slice(0, 10) : '', d.via[c.via] || '']);
    UI.download('Complaints Log ' + UI.D.today() + '.xlsx', SHEET.write([{ name: 'Complaints Log', rows: [head].concat(rows) }]));
  });

  window.addEventListener('hashchange', () => { const h = hash(); if (h.get('complaint') && d) { const c = d.complaints.find(x => x.id === h.get('complaint')); if (c && !document.querySelector('.scrim')) open(c); } });
  load();
})();
