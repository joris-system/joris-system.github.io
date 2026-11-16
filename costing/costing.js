/* ═══════════════════════════════════════════════════════════════════════
   JORIS — costing
   One standard costing per file, kept as versions (it is often redone three
   to five times). Lines come from the pink sheet and the rates list, each
   remembering where it came from, so an out-of-date rate is flagged. The
   sums are the shared calculator's, worked out as you type; the server
   saves the same result. Downloads as an Excel workbook.
   ═══════════════════════════════════════════════════════════════════════ */
(async function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = UI.esc, I = UI.icon, RU = window.JOR_RULES, C = window.JOR_COSTING;
  const me = await JOR.me();
  UI.topBar('Costing', 'JORIS', me);
  const can = (perm, f) => RU.can(Object.assign({}, me, { status: 'active' }), perm, f);
  let files = [], q = '', ref = new URLSearchParams(location.hash.slice(1)).get('ref') || '', data = null, cur = null, dirty = false, seq = 0;

  /* Only the files whose prices this person may see: their own (and any they cover), or all for management. */
  async function loadFiles() { files = (await JOR.call('register.list')).files.filter(f => f.status !== 'lost' && can('costing.view', f)); paintFiles(); }
  function paintFiles() {
    const qq = q.toLowerCase();
    const list = files.filter(f => !qq || (f.ref + ' ' + f.agent).toLowerCase().includes(qq)).sort((a, b) => ((a.am === me.id ? 0 : 1) - (b.am === me.id ? 0 : 1)) || ((a.arrival || '9') < (b.arrival || '9') ? -1 : 1)).slice(0, 60);
    $('#fl').innerHTML = list.map(f => '<button class="fi' + (f.ref === ref ? ' on' : '') + '" data-ref="' + esc(f.ref) + '"><b>' + esc(f.ref) + ' — ' + esc(f.agent) + '</b><span class="mini">' + UI.pill(f.status) + ' ' +
      esc([f.pax ? f.pax + ' pax' : '', f.arrival ? UI.nice(f.arrival) : ''].filter(Boolean).join(' · ')) + '</span></button>').join('') || '<div class="mini">No files.</div>';
  }
  $('#fq').addEventListener('input', e => { q = e.target.value; paintFiles(); });
  $('#fl').addEventListener('click', async e => {
    const b = e.target.closest('[data-ref]');
    if (!b) return;
    if (dirty && !await UI.confirm('Leave this costing?', 'You have changes that aren’t saved.', 'Leave it')) return;
    openFile(b.dataset.ref);
  });

  async function openFile(r, keepId) {
    ref = r; dirty = false; paintFiles();
    history.replaceState(null, '', '#ref=' + encodeURIComponent(r));
    $('#main').innerHTML = '<div class="card pad empty">Opening…</div>';
    try { data = await JOR.call('costing.list', { ref: r }); } catch (e) { $('#main').innerHTML = '<div class="card pad empty">' + esc(e.message) + '</div>'; return; }
    cur = (keepId && data.costings.find(c => c.id === keepId)) || data.costings.find(c => c.status === 'accepted') || data.costings[0] || null;
    paint();
  }

  /* A new costing starts with what is known: the hotels on the pink sheet. */
  function blank() {
    const f = data.file, lines = [];
    data.sources.hotels.forEach(h => {
      if (h.ppn !== '') lines.push(line({ kind: 'hotel', label: h.hotel + ', ' + h.nights + ' night' + (h.nights === 1 ? '' : 's') + (h.basis ? ' ' + h.basis : ''), basis: 'pp', unit: h.ppn, qty: h.nights, src: { type: 'booking', id: h.booking } }));
      if (h.ssupp !== '' && +h.ssupp) lines.push(line({ kind: 'hotel', label: 'Single supplement, ' + h.hotel, basis: 'single', unit: h.ssupp, qty: h.nights }));
    });
    const pax = +f.pax || 30;
    return { id: '', name: '', status: 'draft', data: { bands: [pax - 5, pax, pax + 5].filter(n => n > 0), foc: 1, markup: data.markup === '' ? 15 : data.markup, round: 5, lines: lines }, warnings: [] };
  }
  const line = o => Object.assign({ id: 'l' + Date.now().toString(36) + (seq++), kind: 'other', label: '', basis: 'pp', unit: '', qty: 1, option: false, src: null }, o);

  function paint() {
    const f = data.file, edit = can('costing.edit', { am: f.am });
    const c = cur || blank();
    const locked = c.status === 'accepted';
    let h = '<div class="card pad"><div class="head"><div><h2 class="ph" style="margin:0">' + esc(f.ref) + ' — ' + esc(f.agent) + '</h2><div class="mini">' +
      esc([f.pax ? f.pax + ' pax' : '', f.arrival ? UI.nice(f.arrival, true) + ' – ' + UI.nice(f.departure, true) : '', f.nights ? f.nights + ' nights' : '', f.type].filter(Boolean).join(' · ')) + '</div></div><div class="sp"></div>' +
      '<div class="xlinks"><a href="../register/#ref=' + encodeURIComponent(f.ref) + '">' + I('list', 'sm') + 'The file</a>' + (me.perms['res.view'] ? '<a href="../reservations/#ref=' + encodeURIComponent(f.ref) + '">' + I('bed', 'sm') + 'Pink sheet</a>' : '') + '</div></div>' +
      '<div class="vers" style="margin-top:12px">' + data.costings.map(x => '<button data-ver="' + esc(x.id) + '" class="' + (cur && cur.id === x.id ? 'on' : '') + '">' + esc(x.name || 'Version ' + x.version) +
        ' <span class="pill ' + ({ accepted: 'confirmed', sent: 'quoted', superseded: 'lost' }[x.status] || '') + '">' + esc(data.statuses[x.status]) + '</span></button>').join('') +
      (edit ? '<button data-ver="" class="' + (!cur ? 'on' : '') + '">' + I('plus', 'sm') + 'New</button>' : '') + '</div>';
    if (locked) h += '<div class="okbox">The client accepted this one — it can’t change. Copy it to make a new version.</div>';
    (c.flags || []).forEach(x => {
      h += x.ok ? '<div class="okbox flag">' + I('check', 'sm') + ' ' + esc(x.text) + ' <span class="mini">OK’d by ' + esc(x.ok.by) + ': ' + esc(x.ok.why) + '</span></div>'
        : '<div class="errbox flag">' + I('flag', 'sm') + ' <b>Flagged:</b> ' + esc(x.text) + ' ' + (me.perms['price.ok'] ? '<button class="btn sm" data-okflag="' + esc(x.key) + '">OK it</button>' : '<span class="mini">Management OK it before it goes out.</span>') + '</div>';
    });
    (c.warnings || []).forEach(w => { h += '<div class="warnbox">' + I('warn', 'sm') + ' ' + esc(w.text) + '</div>'; });
    const ro = !edit || locked ? ' disabled' : '';
    h += '<div class="set">' + UI.field('Name', '<input class="in" name="name" value="' + esc(c.name) + '" placeholder="e.g. Version ' + (data.costings.length + 1) + '"' + ro + '>') +
      UI.field('Group sizes', '<input class="in" name="bands" value="' + esc((c.data.bands || []).join(', ')) + '" placeholder="30, 35, 40"' + ro + '>', 'Priced for each.') +
      UI.field('Free places', '<input class="in" type="number" min="0" name="foc" value="' + esc(c.data.foc) + '"' + ro + '>', 'Depends on the client.') +
      UI.field('Mark-up %', '<input class="in" type="number" min="0" max="100" step="0.5" name="markup" value="' + esc(c.data.markup) + '"' + ro + '>', 'Round up to €<select class="in" name="round" style="width:auto;display:inline-block;min-height:28px;padding:2px 6px"' + ro + '>' + UI.options([['0', 'none'], ['1', '€1'], ['5', '€5'], ['10', '€10'], ['50', '€50']].concat([0, 1, 5, 10, 50].indexOf(+c.data.round || 0) < 0 ? [[String(c.data.round), '€' + c.data.round]] : []), String(+c.data.round || 0)) + '</select>') + '</div>';
    h += '<div class="tw"><table class="lines"><thead><tr><th>What</th><th>Kind</th><th>Charged</th><th class="num">Price €</th><th>×</th><th>Extra?</th><th></th></tr></thead><tbody id="lines"></tbody></table></div>' +
      (edit && !locked ? '<div class="acts"><button class="btn sm" data-add="pink">' + I('bed', 'sm') + 'From the pink sheet</button><button class="btn sm" data-add="rate">' + I('tag', 'sm') + 'From the rates</button><button class="btn sm" data-add="blank">' + I('plus', 'sm') + 'A line</button></div>' : '') +
      UI.field('Notes', '<textarea class="in" name="notes"' + ro + '>' + esc(c.data.notes || '') + '</textarea>') + '</div>';
    h += '<div class="card pad" style="margin-top:14px" id="res"></div>';
    h += '<div class="acts" style="margin-top:12px">' + (edit && !locked ? '<button class="btn p" data-do="save">Save</button>' : '') + (edit && cur ? '<button class="btn" data-do="copy">' + I('copy', 'sm') + 'Copy as a new version</button>' : '') +
      (edit && cur && cur.status === 'draft' ? '<button class="btn" data-do="sent">Sent with the proposal</button>' : '') + (edit && cur && cur.status !== 'accepted' ? '<button class="btn" data-do="accepted">The client took this one</button>' : '') +
      '<button class="btn" data-do="xlsx">' + I('down', 'sm') + 'Excel</button></div><div class="err" id="cerr"></div>';
    $('#main').innerHTML = h;
    work = JSON.parse(JSON.stringify(c));
    paintLines(); results();
    const m = $('#main');
    m.querySelectorAll('.set input, [name=notes]').forEach(i => i.addEventListener('input', () => { readTop(); dirty = true; results(); }));
    m.querySelectorAll('[data-ver]').forEach(b => b.addEventListener('click', async () => {
      if (dirty && !await UI.confirm('Leave this version?', 'You have changes that aren’t saved.', 'Leave it')) return;
      dirty = false; cur = b.dataset.ver ? data.costings.find(x => x.id === b.dataset.ver) : null; paint();
    }));
    m.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => ({ pink: pickPink, rate: pickRate, blank: () => { work.data.lines.push(line({})); dirty = true; paintLines(); results(); } })[b.dataset.add]()));
    m.querySelectorAll('[data-do]').forEach(b => b.addEventListener('click', () => doIt(b.dataset.do)));
    m.querySelectorAll('[data-okflag]').forEach(b => b.addEventListener('click', () => okFlag(c.flags.find(x => x.key === b.dataset.okflag))));
  }

  /* Management say why a flagged price is right; it goes in the log. */
  function okFlag(x) {
    UI.dialog({ title: 'OK a flagged price', body: '<p>' + esc(x.text) + '</p>' + UI.field('Why is it right?', '<textarea class="in" name="why" data-focus placeholder="e.g. Agreed with the client at this price — a repeat booking"></textarea>') + '<div class="err" data-err></div>',
      foot: '<button class="btn" data-x>Cancel</button><button class="btn p" data-ok>OK it</button>',
      on: (el, close) => el.querySelector('[data-ok]').addEventListener('click', async () => {
        try { await JOR.call('costing.okFlag', { id: cur.id, key: x.key, why: el.querySelector('[name=why]').value }); close(); UI.toast('OK’d — it’s in the log.'); await openFile(data.file.ref, cur.id); }
        catch (e) { el.querySelector('[data-err]').textContent = e.message; }
      }) });
  }
  let work = null;
  function readTop() {
    const m = $('#main'), g = n => m.querySelector('[name=' + n + ']').value;
    work.name = g('name');
    work.data.bands = g('bands').split(/[^\d]+/).map(Number).filter(n => n > 0);
    work.data.foc = +g('foc') || 0; work.data.markup = +g('markup') || 0; work.data.round = +g('round') || 0; work.data.notes = g('notes');
  }

  function paintLines() {
    const ro = !can('costing.edit', { am: data.file.am }) || work.status === 'accepted';
    const order = Object.keys(C.KINDS);
    const lines = work.data.lines.slice().sort((a, b) => (a.option ? 1 : 0) - (b.option ? 1 : 0) || order.indexOf(a.kind) - order.indexOf(b.kind));
    let lastKind = null;
    $('#lines').innerHTML = lines.map(l => {
      const head = !l.option && l.kind !== lastKind ? '<tr class="kind"><td colspan="7">' + esc(C.KINDS[l.kind]) + '</td></tr>' : l.option && lastKind !== '_opt' ? '<tr class="kind"><td colspan="7">Extras — offered as options, never in the price</td></tr>' : '';
      lastKind = l.option ? '_opt' : l.kind;
      const stale = l.src && l.src.type === 'rate' && l.src.year && l.src.year < '20' + data.file.year;
      const src = l.src ? '<span class="src' + (stale ? ' stale' : '') + '">' + (l.src.type === 'booking' ? 'from the pink sheet' : 'from the ' + esc(l.src.year || '') + ' rates' + (stale ? ' — out of date' : '')) + '</span>' : '';
      const dis = ro ? ' disabled' : '';
      return head + '<tr data-l="' + esc(l.id) + '"' + (l.option ? ' class="opt"' : '') + '><td class="lbl"><input class="in" data-f="label" value="' + esc(l.label) + '"' + dis + '>' + src + '</td>' +
        '<td><select class="in" data-f="kind"' + dis + '>' + UI.options(order.map(k => [k, C.KINDS[k]]), l.kind) + '</select></td>' +
        '<td><select class="in" data-f="basis"' + dis + '>' + UI.options(Object.keys(C.BASES).map(k => [k, C.BASES[k]]), l.basis) + '</select></td>' +
        '<td class="num"><input class="in" data-money data-f="unit" value="' + esc(l.unit === '' ? '' : UI.groupDigits(String(l.unit))) + '"' + dis + '></td>' +
        '<td><input class="in q" type="number" min="0" step="any" data-f="qty" value="' + esc(l.qty) + '"' + dis + '></td>' +
        '<td><input type="checkbox" data-f="option"' + (l.option ? ' checked' : '') + dis + ' title="An extra, priced on its own"></td>' +
        '<td>' + (ro ? '' : '<button class="btn sm ghost" data-del title="Take it out">' + I('x', 'sm') + '</button>') + '</td></tr>';
    }).join('') || '<tr><td colspan="7" class="empty">No lines yet — start from the pink sheet and the rates.</td></tr>';
    UI.money($('#lines'));
  }
  $('#main').addEventListener('input', e => {
    const tr = e.target.closest('[data-l]'), fld = e.target.dataset.f;
    if (!tr || !fld) return;
    const l = work.data.lines.find(x => x.id === tr.dataset.l);
    l[fld] = fld === 'option' ? e.target.checked : fld === 'unit' ? UI.num(e.target.value) : fld === 'qty' ? +e.target.value : e.target.value;
    dirty = true; results();
  });
  $('#main').addEventListener('change', e => {
    const tr = e.target.closest('[data-l]'), fld = e.target.dataset.f;
    if (!tr || !fld) return;
    const l = work.data.lines.find(x => x.id === tr.dataset.l);
    if (fld === 'option') l.option = e.target.checked;
    if (fld === 'kind' || fld === 'option') paintLines();
    dirty = true; results();
  });
  $('#main').addEventListener('click', e => {
    const d = e.target.closest('[data-del]');
    if (!d) return;
    const id = d.closest('[data-l]').dataset.l;
    work.data.lines = work.data.lines.filter(x => x.id !== id);
    dirty = true; paintLines(); results();
  });

  /* The sums, as you type. */
  function results() {
    const r = C.calc(work.data), e = UI.euro;
    let h = '<h3>' + I('calc', 'sm') + 'The price</h3>';
    if (!r.bands.length) { $('#res').innerHTML = h + '<div class="mini">Put in the group sizes to price it for.</div>'; return; }
    h += '<div class="tw"><table class="t res"><thead><tr><th>Group</th><th class="num">Paying</th><th class="num">Cost a head</th><th class="num">Sell a head</th><th class="num">Profit a head</th><th class="num">Margin</th><th class="num">Total sell</th><th class="num">Total profit</th></tr></thead><tbody>' +
      r.bands.map(b => '<tr><td><b>' + b.pax + ' pax</b></td><td class="num">' + b.paying + '</td><td class="num">' + esc(e(b.costPP, 2)) + '</td><td class="num big">' + esc(e(b.sellPP)) + '</td><td class="num">' + esc(e(b.profitPP, 2)) + '</td>' +
        '<td class="num">' + b.margin + '%</td><td class="num">' + esc(e(b.totalSell)) + '</td><td class="num">' + esc(e(b.totalProfit, 2)) + '</td></tr>').join('') + '</tbody></table></div>' +
      '<div class="two" style="margin-top:10px"><div>' + Object.keys(r.kinds).map(k => '<div class="log"><span style="flex:1">' + esc(C.KINDS[k]) + '</span><span>' + (r.kinds[k].pp ? esc(e(r.kinds[k].pp, 2)) + ' a head' : '') +
        (r.kinds[k].group ? (r.kinds[k].pp ? ' + ' : '') + esc(e(r.kinds[k].group, 2)) + ' for the group' : '') + (r.kinds[k].single ? ' · single ' + esc(e(r.kinds[k].single, 2)) : '') + '</span></div>').join('') + '</div>' +
      '<div>' + (r.single.cost ? '<div class="log"><span style="flex:1">Single supplement</span><b>' + esc(e(r.single.sell)) + '</b></div>' : '') +
      r.options.map(o => '<div class="log"><span style="flex:1">Extra: ' + esc(o.label) + '</span><b>' + esc(e(o.sell)) + ' a head</b></div>').join('') + '</div></div>' +
      '<details style="margin-top:10px"><summary class="mini">Each service on its own (for MICE)</summary>' + r.items.map(i => '<div class="log"><span style="flex:1">' + esc(i.label) + ' <span class="mini">' + esc(C.BASES[i.basis]) + '</span></span><span>' + esc(e(i.cost, 2)) + ' → <b>' + esc(e(i.sell, 2)) + '</b></span></div>').join('') + '</details>';
    $('#res').innerHTML = h;
  }

  function pickPink() {
    const list = data.sources.hotels;
    UI.dialog({ title: 'From the pink sheet', body: list.length ? '<div class="pick">' + list.map((h, i) => '<div class="log" data-i="' + i + '"><span style="flex:1"><b>' + esc(h.hotel) + '</b> ' + esc(h.town) + ' · ' + esc(UI.nice(h.checkIn)) + ' · ' + h.nights + ' nights · ' + esc(h.status === 'confirmed' ? 'confirmed' : 'option') + '</span><span>' + (h.ppn === '' ? '<span class="pill warn">no rate</span>' : esc(UI.euro(h.ppn)) + ' PP/PN') + '</span></div>').join('') + '</div>' : '<div class="empty">No hotels on this file’s pink sheet yet.</div>',
      on: (el, close) => el.querySelectorAll('[data-i]').forEach(r => r.addEventListener('click', () => {
        const h = list[+r.dataset.i];
        work.data.lines.push(line({ kind: 'hotel', label: h.hotel + ', ' + h.nights + ' night' + (h.nights === 1 ? '' : 's') + (h.basis ? ' ' + h.basis : ''), basis: 'pp', unit: h.ppn, qty: h.nights, src: { type: 'booking', id: h.booking } }));
        if (h.ssupp !== '' && +h.ssupp) work.data.lines.push(line({ kind: 'hotel', label: 'Single supplement, ' + h.hotel, basis: 'single', unit: h.ssupp, qty: h.nights }));
        dirty = true; close(); paintLines(); results();
      })) });
  }
  function pickRate() {
    const all = data.sources.rates;
    const kindOf = t => ({ hotel: 'hotel', visit: 'visit', restaurant: 'meal', coach: 'coach', guide: 'guide' }[t] || 'other');
    UI.dialog({ title: 'From the rates', wide: true, body: '<input class="in" id="rq" placeholder="Supplier, town, county…" data-focus><div class="pick" id="rl" style="margin-top:8px"></div>',
      on: (el, close) => {
        const paint = () => {
          const qq = el.querySelector('#rq').value.toLowerCase();
          el.querySelector('#rl').innerHTML = all.filter(r => !qq || (r.supplier + ' ' + r.town + ' ' + r.county + ' ' + r.label).toLowerCase().includes(qq)).slice(0, 80).map(r =>
            '<div class="log" data-id="' + esc(r.id) + '"><span style="flex:1"><b>' + esc(r.supplier) + '</b> ' + esc(r.town) + ' · ' + esc(r.label) + '</span><span>' + esc(UI.euro(r.amount)) + ' ' + esc(RU.RATE_UNITS[r.unit]) +
            ' · <span class="' + (r.stale ? 'late' : '') + '">' + esc(r.year) + (r.stale ? ' — out of date' : '') + '</span></span></div>').join('') || '<div class="empty">Nothing matches.</div>';
        };
        el.querySelector('#rq').addEventListener('input', paint); paint();
        el.querySelector('#rl').addEventListener('click', e => {
          const row = e.target.closest('[data-id]'); if (!row) return;
          const r = all.find(x => x.id === row.dataset.id);
          const group = r.unit === 'group' || r.unit === 'day' || r.unit === 'room';
          work.data.lines.push(line({ kind: kindOf(r.type), label: r.supplier + (r.label ? ' — ' + r.label : ''), basis: group ? 'group' : 'pp', unit: r.amount, qty: r.unit === 'ppn' || r.unit === 'day' ? (data.file.nights || 1) : 1, src: { type: 'rate', id: r.id, year: r.year } }));
          dirty = true; close(); paintLines(); results();
        });
      } });
  }

  async function doIt(what) {
    const err = $('#cerr');
    err.textContent = '';
    try {
      if (what === 'save') {
        readTop();
        const r = await JOR.call('costing.save', { costing: { id: work.id || undefined, rev: work.id ? work.rev : undefined, ref: data.file.ref, name: work.name, data: work.data } });
        dirty = false; UI.toast('Saved.'); await openFile(data.file.ref, r.costing.id);
      } else if (what === 'copy') {
        const r = await JOR.call('costing.copy', { id: cur.id });
        UI.toast('Copied as ' + r.costing.name + '.'); await openFile(data.file.ref, r.costing.id);
      } else if (what === 'sent' || what === 'accepted') {
        if (dirty) { UI.toast('Save it first.'); return; }
        await JOR.call('costing.status', { id: cur.id, status: what });
        UI.toast(what === 'accepted' ? 'Marked as the one the client took.' : 'Marked as sent.'); await openFile(data.file.ref, cur.id);
      } else if (what === 'xlsx') xlsx();
    } catch (e) { if (e.stale) { await openFile(data.file.ref, cur && cur.id); UI.toast(e.message, 6000); } else err.textContent = e.message; }
  }

  function xlsx() {
    readTop();
    const r = C.calc(work.data), f = data.file;
    const head = [['Costing', f.ref + ' ' + f.agent], ['Version', work.name || ''], ['Travel', (f.arrival || '') + ' to ' + (f.departure || '')], ['Free places', work.data.foc], ['Mark-up %', work.data.markup], []];
    const lines = [['What', 'Kind', 'Charged', 'Price', 'Times', 'Cost', 'Extra']].concat(work.data.lines.map(l => [l.label, C.KINDS[l.kind], C.BASES[l.basis], +l.unit || 0, +l.qty || 0, C.lineCost(l), l.option ? 'yes' : '']));
    const bands = [['Group', 'Paying', 'Cost a head', 'Sell a head', 'Profit a head', 'Margin %', 'Total sell', 'Total profit']].concat(r.bands.map(b => [b.pax, b.paying, b.costPP, b.sellPP, b.profitPP, b.margin, b.totalSell, b.totalProfit]));
    const blob = SHEET.write([{ name: 'Price', rows: head.concat(bands), money: [2, 3, 4, 6, 7] }, { name: 'Lines', rows: lines, money: [3, 5] }]);
    UI.download(RU.refName(f.ref) + ' ' + f.agent + ' costing' + (work.name ? ' — ' + work.name : '') + '.xlsx', blob);
  }

  window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  try { await loadFiles(); } catch (e) { $('#main').innerHTML = '<div class="card pad empty">' + esc(e.message) + '</div>'; return; }
  if (ref) openFile(ref);
  window.addEventListener('hashchange', () => { const r = new URLSearchParams(location.hash.slice(1)).get('ref'); if (r && r !== ref && !dirty) openFile(r); });
  window.JORCOST = { data: () => data, work: () => work, openFile: openFile };
})();
