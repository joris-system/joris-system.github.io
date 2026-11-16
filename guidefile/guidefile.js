/* ═══════════════════════════════════════════════════════════════════════
   JORIS — guide files, the office side
   A confirmed group gets a guide file: the guide's name and phone, a note,
   and a code. Documents dropped in go into sections by their names (JOR's
   own: "26 1066 Final RL", "Guide Notes 26 1066…"), Word and Excel become
   PDFs, and of the arrivals workbook only this group's tab goes in. A
   voucher is tied to its supplier and how many it was for, so the numbers
   the guide puts in on the day reach the bill check.
   ═══════════════════════════════════════════════════════════════════════ */
(async function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = UI.esc, I = UI.icon, RU = window.JOR_RULES, D = window.JORWF_DATES;
  const me = await JOR.me();
  UI.topBar('Guide files', 'JORIS', me);
  let list = [], people = [], cats = [], cur = null, docs = [], acts = [], counts = [], sups = [];
  const want = new URLSearchParams(location.hash.slice(1)).get('ref') || '';
  const nameOf = id => (people.find(p => p.id === id) || {}).name || '';
  const guideLink = code => new URL('../g/', location.href).href + '#c=' + code;
  const pretty = c => c ? c.slice(0, 4) + ' ' + c.slice(4) : '';
  const intl = p => { p = String(p || '').replace(/[^\d+]/g, ''); return p.startsWith('+') ? p.slice(1) : p.startsWith('00') ? p.slice(2) : p.startsWith('0') ? '353' + p.slice(1) : p; };
  const size = n => !n ? '' : n < 1048576 ? Math.max(1, Math.round(n / 1024)) + ' KB' : (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + ' MB';
  function message(g) {
    return 'Hi' + (g.guideName ? ' ' + g.guideName.split(' ')[0] : '') + ', your JOR guide file for ' + g.ref + ' ' + (g.tourName || g.agent) + ' is ready. Open this on your phone: ' + guideLink(g.code) +
      '\nIf it asks, the code is ' + pretty(g.code) + '. Everything saves to your phone, so it works with no signal. Add it to your home screen to keep it handy.';
  }

  async function load(select) {
    const r = await JOR.call('guide.list');
    list = r.files; people = r.people; cats = r.cats;
    paintList();
    const ref = select || (cur && cur.ref);
    if (ref && list.some(f => f.ref === ref)) await openGroup(ref);
  }
  function paintList() {
    const made = list.filter(f => f.code || f.guideStatus), todo = list.filter(f => !f.guideStatus && f.status === 'confirmed');
    const today = D.today();
    const item = f => '<button class="gi' + (cur && cur.ref === f.ref ? ' on' : '') + (f.guideStatus === 'closed' ? ' closed' : '') + '" data-g="' + esc(f.ref) + '"><b>' + esc(f.ref) + ' — ' + esc(f.tourName || f.agent) + '</b>' +
      '<span class="mini">' + esc([f.arrival ? UI.nice(f.arrival) + (f.departure ? ' – ' + UI.nice(f.departure) : '') : '', f.guideName].filter(Boolean).join(' · ')) + '</span>' +
      (f.guideStatus ? '<span class="mini">' + f.docCount + ' document' + (f.docCount === 1 ? '' : 's') + ' · ' + (f.lastGuide ? 'guide seen ' + esc(UI.when(f.lastGuide.when)) : 'guide not in yet') +
        (f.messages ? ' · <b style="color:var(--gold)">' + f.messages + ' message' + (f.messages === 1 ? '' : 's') + '</b>' : '') + '</span>' :
        '<span class="mini">' + (!f.arrival ? 'no guide file yet' : f.departure && f.departure < today ? 'went home ' + esc(UI.nice(f.departure)) + ' — no guide file'
          : f.arrival <= today ? '<b class="late">on tour now — no guide file</b>' : D.diffDays(today, f.arrival) <= 14 ? '<b class="late">arrives in ' + D.diffDays(today, f.arrival) + ' day' + (D.diffDays(today, f.arrival) === 1 ? '' : 's') + '</b>' : 'no guide file yet') + '</span>') + '</button>';
    $('#glist').innerHTML = (made.length ? '<h4>Guide files</h4><div class="gl">' + made.map(item).join('') + '</div>' : '') +
      (todo.length ? '<h4>Confirmed, no guide file yet</h4><div class="gl">' + todo.map(item).join('') + '</div>' : '') + (!made.length && !todo.length ? '<div class="mini">No confirmed groups yet.</div>' : '');
  }
  $('#glist').addEventListener('click', e => { const b = e.target.closest('[data-g]'); if (b) openGroup(b.dataset.g); });

  async function openGroup(ref) {
    cur = list.find(f => f.ref === ref);
    history.replaceState(null, '', '#ref=' + encodeURIComponent(ref));
    paintList();
    if (!cur.guideStatus) { docs = []; acts = []; paintGroup(); return; }
    if (!cur.mine) { docs = []; acts = []; paintGroup(); return; }
    $('#pane').innerHTML = '<div class="card pad empty">Opening…</div>';
    try {
      const [d, a] = await Promise.all([JOR.call('guide.docs', { ref: ref }), JOR.call('guide.activity', { ref: ref })]);
      if (!cur || cur.ref !== ref) return;
      docs = d.docs; sups = d.suppliers; acts = a.activity; counts = a.counts;
    } catch (e) { $('#pane').innerHTML = '<div class="card pad empty">' + esc(e.message) + '</div>'; return; }
    paintGroup();
  }

  function paintGroup() {
    const g = cur;
    const meta = [['Arrives', g.arrival ? UI.nice(g.arrival, true) : '—'], ['Goes home', g.departure ? UI.nice(g.departure, true) : '—'], ['Guide', [g.guideName, g.guidePhone].filter(Boolean).join(' · ') || '—'],
      ['Office contact', nameOf(g.guideContact || g.am) || '—'], ['Account manager', nameOf(g.am) || '—']];
    let h = '<div class="card pad"><h2 class="ph" style="margin:0">' + esc(g.ref) + ' — ' + esc(g.tourName || g.agent) + '</h2>' +
      (g.guideStatus ? '<span class="pill ' + (g.guideStatus === 'open' ? 'confirmed' : 'warn') + '">' + (g.guideStatus === 'open' ? 'Open — the guide can see it' : 'Closed — the guide can’t open it') + '</span>' : '<span class="pill warn">No guide file yet</span>') +
      '<div class="kv" style="margin-top:12px">' + meta.map(m => '<div><span>' + esc(m[0]) + '</span>' + esc(m[1]) + '</div>').join('') + '</div>' +
      (g.guideNotes ? '<div class="mini" style="margin-top:10px;white-space:pre-wrap">' + esc(g.guideNotes) + '</div>' : '') +
      '<div class="xlinks" style="margin-top:12px"><a href="../register/#ref=' + encodeURIComponent(g.ref) + '">' + I('list', 'sm') + 'The file</a></div>' +
      (g.mine ? '<div class="acts">' + (g.guideStatus ? '<button class="btn" data-act="edit">Edit details</button>' + (g.guideStatus === 'open' ? '<button class="btn dngr" data-act="close">Close the guide file</button>' : '<button class="btn" data-act="reopen">Open it again</button>')
        : '<button class="btn p" data-act="make">' + I('plus', 'sm') + 'Make the guide file</button>') + '</div>' : '<p class="mini">Only ' + esc(nameOf(g.am)) + ', operations and management work on this one.</p>') + '</div>';
    if (g.guideStatus && g.mine) {
      h += '<div class="card pad"><h3>' + I('lock', 'sm') + 'The guide’s link</h3><div class="access"><div><div class="code">' + esc(pretty(g.code)) + '</div><div class="link">' + esc(guideLink(g.code)) + '</div>' +
        '<div class="acts"><button class="btn p" data-act="copy">' + I('copy', 'sm') + 'Copy the message</button>' +
        (g.guidePhone ? '<a class="btn" target="_blank" rel="noopener" href="https://wa.me/' + esc(intl(g.guidePhone)) + '?text=' + encodeURIComponent(message(g)) + '">WhatsApp ' + esc(g.guideName ? g.guideName.split(' ')[0] : 'the guide') + '</a>' +
          '<a class="btn" href="sms:+' + esc(intl(g.guidePhone)) + '?&body=' + encodeURIComponent(message(g)) + '">Text message</a>' : '') + '<button class="btn" data-act="newcode">New code</button></div>' +
        '<p class="mini">The link opens the guide file straight away; the code is there if they type the address instead. It stops working when you close the guide file, and a week after the group goes home' +
        (g.departure ? ' (' + esc(UI.nice(D.addDays(g.departure, 7), true)) + ')' : '') + '.</p></div><div class="qr" title="The guide can scan this with their phone’s camera">' + qrSvg(guideLink(g.code)) + '<div class="mini" style="text-align:center">Scan with the phone camera</div></div></div></div>';
      h += '<div class="card pad"><h3>' + I('doc', 'sm') + 'Documents <span class="mini">' + docs.length + '</span></h3>' +
        '<div class="drop" id="drop">' + I('upload') + '<div><b>Drop files here</b> or click to choose — PDF, Word, Excel, PowerPoint or photos</div><div class="mini">Name them as you usually do. Each goes into a section by its name; change it below if it guessed wrong.</div></div>' +
        '<div class="q" id="queue"></div>' + docTable() + '</div>';
      const shown = acts.slice(0, 120);
      h += '<div class="card pad"><h3>' + I('eye', 'sm') + 'What the guide has seen and sent <span class="sp"></span><button class="btn sm" data-act="refresh">' + I('refresh', 'sm') + 'Refresh</button></h3>' +
        (shown.length ? shown.map(a => '<div class="act' + (a.who === 'guide' ? ' guide' : '') + (a.what === 'message' ? ' msg' : '') + '"><span class="t">' + esc(UI.when(a.when)) + '</span><span>' +
          (a.who === 'guide' ? '<b>Guide</b> ' : esc(a.who) + ' · ') + (a.what === 'message' ? 'sent a note: <b>' + esc(a.detail) + '</b>' : esc(a.what) + (a.detail ? ' — ' + esc(a.detail) : '')) + '</span></div>').join('') : '<div class="mini">Nothing yet.</div>') + '</div>';
    }
    $('#pane').innerHTML = h;
    wireDrop();
  }
  function docTable() {
    if (!docs.length) return '<div class="mini" style="margin-top:10px">No documents yet.</div>';
    let rows = '';
    cats.forEach(c => {
      const ls = docs.filter(d => d.category === c);
      if (!ls.length) return;
      rows += '<tr class="cat"><td colspan="5">' + esc(c) + '</td></tr>' + ls.map(d => '<tr data-d="' + esc(d.id) + '"><td><input class="in" data-f="name" value="' + esc(d.name) + '">' +
        '<div class="mini">' + esc(size(d.size)) + ' · ' + esc(UI.when(d.uploaded)) + (d.converted === 'yes' ? ' · <span class="pill">turned into a PDF</span>' : d.converted === 'failed' ? ' · <span class="pill err">couldn’t be turned into a PDF — save it as a PDF and upload again</span>' : '') +
        (d.note ? '<div><span class="pill ' + (/check/.test(d.note) ? 'warn' : 'quoted') + '">' + esc(d.note) + '</span></div>' : '') +
        (d.counted ? '<div class="mini"><b>On the day: ' + d.counted.pax + '</b>' + (d.booked !== '' ? ' of ' + d.booked + ' booked' : '') + ' · ' + esc(UI.when(d.counted.at)) + (d.counted.note ? ' — ' + esc(d.counted.note) : '') + '</div>' : '') + '</div></td>' +
        '<td><select class="in" data-f="category">' + UI.options(cats, d.category) + '</select></td>' +
        '<td><input class="in day" data-f="day" type="number" min="1" max="59" placeholder="Day" title="Which day of the tour — it shows under Today on the guide’s phone" value="' + (d.day || '') + '"></td>' +
        '<td>' + (d.category === 'Vouchers' ? '<select class="in" data-f="supplierId" title="Which supplier the voucher is for">' + UI.options([['', 'Supplier…']].concat(sups.map(s => [s.id, s.name + (s.onFile ? ' ★' : '')])), d.supplierId) + '</select>' +
          '<input class="in bk" data-f="booked" type="number" min="0" placeholder="For" title="How many the voucher is for" value="' + esc(d.booked) + '">' : '') + '</td>' +
        '<td class="acts"><button class="btn sm" data-act="view" title="Open it">' + I('eye', 'sm') + '</button><button class="btn sm dngr" data-act="del" title="Remove it">' + I('trash', 'sm') + '</button></td></tr>').join('');
    });
    return '<table class="docs"><thead><tr><th>Name</th><th>Section</th><th>Day</th><th>Voucher for</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>';
  }
  function qrSvg(text) {
    try {
      const q = qrcode(0, 'M'); q.addData(text); q.make();
      const n = q.getModuleCount(), m = 2;
      let p = '';
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) p += 'M' + (c + m) + ' ' + (r + m) + 'h1v1h-1z';
      return '<svg viewBox="0 0 ' + (n + 2 * m) + ' ' + (n + 2 * m) + '" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="' + p + '" fill="#13251E"/></svg>';
    } catch (e) { return ''; }
  }

  function detailsForm(g, make) {
    const office = people.filter(p => p.status !== 'left');
    UI.dialog({
      title: (make ? 'Make the guide file — ' : 'Edit — ') + g.ref, wide: true,
      body: '<div class="g2">' + UI.field('Tour name', '<input class="in" name="tourName" value="' + esc(g.tourName || '') + '" placeholder="e.g. L’Essentiel de l’Irlande" data-focus>') +
        UI.field('Office contact for the guide', '<select class="in" name="guideContact">' + UI.options([['', (nameOf(g.am) || 'The account manager') + ' (account manager)']].concat(office.map(p => [p.id, p.name])), g.guideContact || '') + '</select>', 'Their name and phone show on the guide’s phone; notes from the guide go to them.') +
        UI.field('Guide', '<input class="in" name="guideName" value="' + esc(g.guideName || '') + '">') + UI.field('Guide’s mobile', '<input class="in" type="tel" name="guidePhone" value="' + esc(g.guidePhone || '') + '" placeholder="087 123 4567">') + '</div>' +
        UI.field('A note for the guide', '<textarea class="in" name="guideNotes" placeholder="Shown on the guide’s phone, e.g. driver’s number, anything to know">' + esc(g.guideNotes || '') + '</textarea>') + '<div class="err" data-err></div>',
      foot: '<button class="btn" data-x>Cancel</button><button class="btn p" data-ok>' + (make ? 'Make it' : 'Save') + '</button>',
      on: (el, close) => el.querySelector('[data-ok]').addEventListener('click', async () => {
        const v = n => el.querySelector('[name=' + n + ']').value.trim();
        try {
          await JOR.call('guide.save', { ref: g.ref, guide: { tourName: v('tourName'), guideContact: v('guideContact'), guideName: v('guideName'), guidePhone: v('guidePhone'), guideNotes: v('guideNotes') } });
          close(); await load(g.ref); UI.toast(make ? 'Made. Add the documents, then send the guide the link.' : 'Saved.');
        } catch (e) { el.querySelector('[data-err]').textContent = e.message; }
      })
    });
  }

  /* Which section a file belongs in, from the name the office already gives it. */
  const plain = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’'`]/g, "'");
  function guess(name, g) {
    const n = plain(name).replace(/\.[a-z0-9]+$/, '');
    if (/vouch|bon d/.test(n)) return 'Vouchers';
    if (/\brl\b|rooming|room ?list|liste des chambres/.test(n)) return 'Rooming lists';
    if (/guide ?notes?|notes? (for|to) (the )?guide|briefing|consignes/.test(n)) return 'Guide notes';
    if (/hotel ?list|hotels? list|list of hotels|liste des hotels/.test(n)) return 'Hotels';
    if (/arrivals?\b|departures?\b|flights?\b|\bvols?\b/.test(n)) return 'Flights';
    if (/itiner|programme|program\b/.test(n)) return 'Itinerary';
    if (/contacts?\b|phone ?list|emergency/.test(n)) return 'Contacts';
    const tour = g ? plain(g.tourName || '').replace(/^(l'|le |la |les )/, '').replace(/[^a-z0-9]+/g, ' ').trim() : '';
    if (tour.length > 4 && n.replace(/[^a-z0-9]+/g, ' ').includes(tour)) return 'Itinerary';
    return 'Other';
  }
  const guessDay = name => { const m = plain(name).match(/\b(?:day|jour)\s*(\d{1,2})\b/); return m ? +m[1] : ''; };
  function wireDrop() {
    const d = $('#drop');
    if (!d) return;
    d.onclick = () => $('#pick').click();
    d.ondragover = e => { e.preventDefault(); d.classList.add('over'); };
    d.ondragleave = () => d.classList.remove('over');
    d.ondrop = e => { e.preventDefault(); d.classList.remove('over'); upload([...e.dataTransfer.files]); };
  }
  $('#pick').onchange = e => { upload([...e.target.files]); e.target.value = ''; };
  const b64 = buf => { const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
  async function upload(files) {
    if (!cur || !files.length) return;
    const g = cur, q = $('#queue');
    const lines = files.map(f => { const el = document.createElement('div'); el.innerHTML = I('upload', 'sm') + '<span>' + esc(f.name) + ' — waiting</span>'; q.appendChild(el); return el; });
    let done = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i], el = lines[i];
      if (f.size > 20 * 1024 * 1024) { el.innerHTML = '<span class="bad">' + esc(f.name) + ' is over 20 MB — save a smaller copy.</span>'; continue; }
      el.innerHTML = I('upload', 'sm') + '<span>' + esc(f.name) + ' — sending' + (/\.(docx?|xlsx?|pptx?|odt|ods|odp|rtf|txt|csv)$/i.test(f.name) ? ' and turning it into a PDF' : '') + '…</span>';
      try {
        const r = await JOR.call('guide.upload', { ref: g.ref, name: f.name, type: f.type, category: guess(f.name, g), day: guessDay(f.name), data: b64(await f.arrayBuffer()) });
        el.innerHTML = I('check', 'sm') + '<span>' + esc(f.name) + ' — in ' + esc(r.doc.category) + (r.doc.converted === 'failed' ? ' <span class="bad">(couldn’t be turned into a PDF)</span>' : '') + (r.doc.note ? ' — ' + esc(r.doc.note) : '') + '</span>';
        done++;
      } catch (e) { el.innerHTML = '<span class="bad">' + esc(f.name) + ' — ' + esc(e.message) + '</span>'; }
    }
    if (cur && cur.ref === g.ref) {
      const keep = $('#queue').innerHTML;
      await load(g.ref);
      const qq = $('#queue'); if (qq) qq.innerHTML = keep;
      setTimeout(() => { const x = $('#queue'); if (x) x.innerHTML = ''; }, 12000);
    }
    if (done) UI.toast(done + ' document' + (done === 1 ? '' : 's') + ' added. The guide’s phone picks them up next time it has signal.');
  }

  $('#pane').addEventListener('click', async e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const a = b.dataset.act, row = b.closest('[data-d]'), docId = row && row.dataset.d;
    try {
      if (a === 'make') detailsForm(cur, true);
      else if (a === 'edit') detailsForm(cur, false);
      else if (a === 'refresh') await openGroup(cur.ref);
      else if (a === 'copy') { await navigator.clipboard.writeText(message(cur)); UI.toast('Copied — paste it into WhatsApp, a text or an email to the guide.'); }
      else if (a === 'newcode') {
        if (!await UI.confirm('Give this guide file a new code?', 'The old link and code stop working straight away, and the guide will need the new one.', 'New code')) return;
        await JOR.call('guide.code', { ref: cur.ref }); await load(cur.ref); UI.toast('New code made. Send the guide the new message.');
      } else if (a === 'close') {
        if (!await UI.confirm('Close this guide file?', 'The guide can’t open it any more, and it comes off their phone the next time it has signal.', 'Close it', true)) return;
        await JOR.call('guide.status', { ref: cur.ref, status: 'closed' }); await load(cur.ref);
      } else if (a === 'reopen') { await JOR.call('guide.status', { ref: cur.ref, status: 'open' }); await load(cur.ref); }
      else if (a === 'del') {
        const d = docs.find(x => x.id === docId);
        if (!await UI.confirm('Remove “' + d.name + '”?', 'It comes off the guide’s phone too.', 'Remove it', true)) return;
        await JOR.call('guide.docDelete', { docId: docId }); await load(cur.ref); UI.toast('Removed.');
      } else if (a === 'view') {
        const w = window.open('', '_blank');
        const r = await JOR.call('guide.docFile', { docId: docId });
        const bin = atob(r.data), u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        if (r.type !== 'application/pdf' && !/^image\/(jpeg|png|gif|webp)$/.test(r.type)) {
          if (w) w.close();
          UI.download(r.name || 'document', new Blob([u8], { type: 'application/octet-stream' }));
          return;
        }
        const u = URL.createObjectURL(new Blob([u8], { type: r.type }));
        if (w) w.location = u; else location.href = u;
      }
    } catch (err) { UI.toast(err.message, 5000); }
  });
  $('#pane').addEventListener('change', async e => {
    const el = e.target.closest('[data-f]');
    if (!el) return;
    const docId = el.closest('[data-d]').dataset.d, f = el.dataset.f;
    const extra = { docId: docId }; extra[f] = el.value.trim();
    try {
      const r = await JOR.call('guide.docUpdate', extra);
      docs = docs.map(d => d.id === docId ? r.doc : d);
      if (f === 'category') paintGroup();
      UI.toast('Saved.', 1500);
    } catch (err) { UI.toast(err.message, 5000); }
  });

  try { await load(want); } catch (e) { $('#glist').innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; return; }
  if (!want) $('#pane').innerHTML = '<div class="card pad"><h3>' + I('doc', 'sm') + 'Guide files</h3><p>Pick a confirmed group on the left. Make its guide file, drop in its documents — vouchers, rooming lists, the final itinerary, guide notes — and send the guide their link.</p></div>';
  window.addEventListener('hashchange', () => { const r = new URLSearchParams(location.hash.slice(1)).get('ref'); if (r && (!cur || r !== cur.ref) && list.some(f => f.ref === r)) openGroup(r); });
  window.JORGUIDE = { list: () => list, docs: () => docs, openGroup: openGroup };
})();
