/* ═══════════════════════════════════════════════════════════════════════
   JORIS — suppliers and rates
   Every supplier with its cancellation terms, every rate with the year it
   is for and the day it came in, and each spring the list of suppliers
   still to send next year's — with the email to send them ready to go.
   ═══════════════════════════════════════════════════════════════════════ */
(async function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = UI.esc, I = UI.icon, RU = window.JOR_RULES, D = window.JORWF_DATES;
  const me = await JOR.me();
  UI.topBar('Suppliers & rates', 'JORIS', me);
  const edit = !!me.perms['rates.edit'];
  let view = location.hash === '#chase' ? 'chase' : 'suppliers', data = null, openId = null;
  const thisYear = +D.today().slice(0, 4);
  const filt = { q: '', type: '', year: String(thisYear + 1) };
  async function load() { data = await JOR.call('suppliers.list'); JOR.keep('suppliers.list', null, data); }
  const ratesOf = id => data.rates.filter(r => r.supplierId === id).sort((a, b) => b.year.localeCompare(a.year) || a.label.localeCompare(b.label));
  const latest = id => { const r = ratesOf(id); return r.length ? r[0].year : ''; };

  function tabs() {
    $('#tabs').innerHTML = [['suppliers', 'Suppliers'], ['rates', 'Every rate'], ['chase', 'Next year’s rates']].map(x => '<button data-tab="' + x[0] + '" class="' + (view === x[0] ? 'on' : '') + '">' + x[1] + '</button>').join('');
    $('#add').classList.toggle('hidden', !edit);
    $('#add').innerHTML = I('plus', 'sm') + 'A supplier';
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; view = b.dataset.tab; render(); });
  function render() { tabs(); ({ suppliers: suppliers, rates: rates, chase: chase })[view](); }

  function suppliers() {
    let list = data.suppliers.slice();
    if (filt.type) list = list.filter(s => s.type === filt.type);
    if (filt.q) { const q = filt.q.toLowerCase(); list = list.filter(s => (s.name + ' ' + s.town + ' ' + s.county + ' ' + s.contact).toLowerCase().includes(q)); }
    list.sort((a, b) => a.name.localeCompare(b.name));
    $('#view').innerHTML = '<div class="bar"><input class="in srch" id="q" placeholder="Name, town, county…" value="' + esc(filt.q) + '"><select class="in" id="ft">' +
      UI.options([['', 'Every kind']].concat(Object.keys(RU.SUPPLIERS).map(k => [k, RU.SUPPLIERS[k]])), filt.type) + '</select></div>' +
      '<div class="card tw">' + (list.length ? '<table class="t"><thead><tr><th>Supplier</th><th>Kind</th><th>Where</th><th>Contact</th><th>Cancellation terms</th><th>Latest rates</th></tr></thead><tbody>' +
        list.map(s => { const y = latest(s.id); return '<tr class="clk' + (s.status === 'closed' ? ' dim' : '') + '" data-id="' + esc(s.id) + '"><td><b>' + esc(s.name) + '</b>' + (s.star ? ' <span class="mini">' + '★'.repeat(s.star) + '</span>' : '') + '</td><td>' + esc(RU.SUPPLIERS[s.type]) + '</td>' +
          '<td>' + esc([s.town, s.county].filter(Boolean).join(', ')) + '</td><td>' + esc([s.contact, s.email].filter(Boolean).join(' · ')) + '</td><td>' + (s.terms ? esc(s.terms.name) : s.type === 'hotel' ? '<span class="pill warn">none</span>' : '') + '</td>' +
          '<td>' + (y ? '<span class="pill ' + (+y < thisYear + 1 ? 'warn' : 'confirmed') + '">' + esc(y) + '</span>' : '<span class="pill err">none</span>') + '</td></tr>'; }).join('') + '</tbody></table>' : '<div class="empty">Nothing matches.</div>') + '</div>';
    const q = $('#q');
    q.addEventListener('input', () => { filt.q = q.value; clearTimeout(q._t); q._t = setTimeout(() => { const p = q.selectionStart; suppliers(); const n = $('#q'); n.focus(); n.setSelectionRange(p, p); }, 200); });
    $('#ft').addEventListener('change', e => { filt.type = e.target.value; suppliers(); });
  }

  function rates() {
    const sup = {};
    data.suppliers.forEach(s => { sup[s.id] = s; });
    const list = data.rates.filter(r => sup[r.supplierId]).sort((a, b) => sup[a.supplierId].name.localeCompare(sup[b.supplierId].name) || b.year.localeCompare(a.year));
    $('#view').innerHTML = '<div class="card tw">' + (list.length ? '<table class="t"><thead><tr><th>Supplier</th><th>Year</th><th>What</th><th>Charged</th><th class="num">Rate</th><th class="num">Single</th><th>Came in</th><th>Where from</th></tr></thead><tbody>' +
      list.map(r => '<tr class="clk" data-id="' + esc(r.supplierId) + '"><td><b>' + esc(sup[r.supplierId].name) + '</b> <span class="mini">' + esc(sup[r.supplierId].town) + '</span></td><td><span class="pill ' + (+r.year < thisYear ? 'warn' : '') + '">' + esc(r.year) + '</span></td>' +
        '<td>' + esc(r.label) + (r.sell !== '' && r.sell !== undefined ? '<div class="mini">sold at ' + esc(UI.euro(r.sell)) + '</div>' : '') + '</td><td>' + esc(RU.RATE_UNITS[r.unit]) + '</td><td class="num">' + esc(UI.euro(r.amount)) + '</td><td class="num">' + (r.single !== '' ? esc(UI.euro(r.single)) : '') + '</td>' +
        '<td class="nw">' + esc(UI.when(r.enteredAt)) + '</td><td class="mini">' + esc(r.source) + '</td></tr>').join('') + '</tbody></table>' : '<div class="empty">No rates yet.</div>') + '</div>';
  }

  /* Each spring: who still has to send next year's rates, and the email to them. */
  async function chase() {
    $('#view').innerHTML = '<div class="empty">Checking…</div>';
    let r;
    try { r = await JOR.call('rates.chase', { year: filt.year }); } catch (e) { $('#view').innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; return; }
    if (view !== 'chase') return;
    const withEmail = r.suppliers.filter(s => s.email), noEmail = r.suppliers.filter(s => !s.email);
    const body = 'Dear colleague,\n\nWe are now planning our ' + r.year + ' programmes. Could you please send us your ' + r.year + ' group rates, with your cancellation terms, at your earliest convenience?\n\nKind regards,\n' + me.name + '\nJOR Ireland';
    $('#view').innerHTML = '<div class="bar"><span>Rates for</span><select class="in" id="fy">' + UI.options([0, 1, 2].map(i => String(thisYear + i)), filt.year) + '</select><span class="mini">' + r.suppliers.length + ' supplier' + (r.suppliers.length === 1 ? '' : 's') + ' still to send them</span></div>' +
      (r.suppliers.length ? '<div class="two"><div class="card pad"><h3>' + I('mail', 'sm') + 'The email</h3><div class="mailbox" id="mb">' + esc(body) + '</div><div class="acts">' +
        (withEmail.length ? '<a class="btn p" href="mailto:?bcc=' + encodeURIComponent(withEmail.map(s => s.email).join(',')) + '&subject=' + encodeURIComponent('JOR Ireland — your ' + r.year + ' group rates') + '&body=' + encodeURIComponent(body) + '">' + I('mail', 'sm') + 'Open it in Outlook (' + withEmail.length + ' in Bcc)</a>' : '') +
        '<button class="btn" id="cpe">' + I('copy', 'sm') + 'Copy the addresses</button></div><p class="mini">Nothing is sent from here: it opens in your own email, every supplier in Bcc so none sees the others.</p></div>' +
        '<div class="card pad"><h3>Still to send ' + esc(r.year) + ' rates</h3>' + r.suppliers.map(s => '<div class="log" style="cursor:pointer" data-id="' + esc(s.id) + '"><span style="flex:1"><b>' + esc(s.name) + '</b> <span class="mini">' + esc(RU.SUPPLIERS[s.type]) + ' · ' + esc(s.town) + '</span></span>' +
          (s.email ? '<span class="mini">' + esc(s.email) + '</span>' : '<span class="pill warn">no email</span>') + '</div>').join('') + '</div></div>' : '<div class="card pad okbox">Every supplier has sent their ' + esc(r.year) + ' rates.</div>') +
      (noEmail.length ? '<p class="mini">' + noEmail.length + ' have no email on file — add one, or phone them.</p>' : '');
    $('#fy').addEventListener('change', e => { filt.year = e.target.value; chase(); });
    const cp = $('#cpe'); if (cp) cp.addEventListener('click', async () => { try { await navigator.clipboard.writeText(withEmail.map(s => s.email).join('; ')); UI.toast('Copied.'); } catch (e) { UI.toast('Select them and copy.'); } });
  }
  $('#view').addEventListener('click', e => { const r = e.target.closest('[data-id]'); if (r) openSupplier(r.dataset.id); });

  /* ── One supplier ── */
  function openSupplier(id) { openId = id; paintSupplier(); }
  function closeSide() { openId = null; $('#side').classList.add('hidden'); $('#side').innerHTML = ''; }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && openId && !document.querySelector('.scrim')) closeSide(); });
  function paintSupplier() {
    const s = data.suppliers.find(x => x.id === openId), side = $('#side');
    if (!s) { closeSide(); return; }
    side.classList.remove('hidden');
    const rs = ratesOf(s.id);
    let h = '<div class="sh"><div class="tt"><b>' + esc(s.name) + '</b><span class="mini">' + esc(RU.SUPPLIERS[s.type]) + ' · ' + esc([s.town, s.county].filter(Boolean).join(', ')) + (s.status === 'closed' ? ' · no longer used' : '') + '</span></div>' +
      '<button class="btn ghost" data-close>' + I('x') + '</button></div><div class="sb"><div class="kv">' +
      [['Contact', s.contact], ['Email', s.email], ['Phone', s.phone], ['Stars', s.star ? '★'.repeat(s.star) : '']].filter(x => x[1]).map(x => '<div><span>' + esc(x[0]) + '</span>' + esc(x[1]) + '</div>').join('') + '</div>' +
      (s.notes ? '<div class="note" style="margin-top:10px;white-space:pre-wrap">' + esc(s.notes) + '</div>' : '') +
      '<h4>Cancellation terms</h4>' + (s.terms ? '<div><b>' + esc(s.terms.name) + '</b></div>' + s.terms.tiers.map(t => '<div class="mini">' + (t.from > 3000 ? 'From confirmation' : 'Within ' + t.from + ' days of arrival') + ': ' + t.pct + '% payable</div>').join('') : '<div class="mini">None recorded.' + (s.type === 'hotel' ? ' A booking made without terms is flagged once it is confirmed.' : '') + '</div>') +
      '<p class="mini">A booking keeps the terms it was made on; changing them here changes the next booking, not the ones already made.</p>' +
      '<h4>Rates</h4>' + (rs.length ? '<table class="t"><thead><tr><th>Year</th><th>What</th><th class="num">Rate</th><th>Came in</th><th></th></tr></thead><tbody>' + rs.map(r => '<tr><td>' + esc(r.year) + '</td><td>' + esc(r.label) + '<div class="mini">' + esc(RU.RATE_UNITS[r.unit]) + (r.single !== '' ? ' · single ' + esc(UI.euro(r.single)) : '') + (r.sell !== '' && r.sell !== undefined ? ' · sold at ' + esc(UI.euro(r.sell)) + ' in programmes' : '') + (r.source ? ' · ' + esc(r.source) : '') + '</div></td>' +
        '<td class="num">' + esc(UI.euro(r.amount)) + '</td><td class="nw">' + esc(UI.when(r.enteredAt)) + '</td><td>' + (edit ? '<button class="btn sm" data-rate="' + esc(r.id) + '">Change</button>' : '') + '</td></tr>').join('') + '</tbody></table>' : '<div class="mini">None yet.</div>') +
      (edit ? '<div class="acts"><button class="btn p sm" data-act="rate">' + I('plus', 'sm') + 'A rate</button><button class="btn sm" data-act="edit">Edit the supplier</button></div>' : '') + '</div>';
    side.innerHTML = h;
    side.querySelector('[data-close]').addEventListener('click', closeSide);
    side.querySelectorAll('[data-rate]').forEach(b => b.addEventListener('click', () => rateForm(s, data.rates.find(r => r.id === b.dataset.rate))));
    const a = side.querySelector('[data-act=rate]'); if (a) a.addEventListener('click', () => rateForm(s));
    const ed = side.querySelector('[data-act=edit]'); if (ed) ed.addEventListener('click', () => supplierForm(s));
  }
  async function refresh(msg) { await load(); render(); if (openId) paintSupplier(); if (msg) UI.toast(msg); }

  function supplierForm(s) {
    s = s || { type: 'hotel', status: 'active' };
    const tpl = s.terms ? Object.keys(data.terms).find(k => data.terms[k].name === s.terms.name) || 'own' : '';
    const tierRows = t => (t || [{ from: '', pct: '' }]).map(x => '<tr><td>Within <input class="in" type="number" min="0" name="tf" value="' + esc(x.from) + '" style="width:80px;display:inline-block"> days</td><td><input class="in" type="number" min="0" max="100" name="tp" value="' + esc(x.pct) + '" style="width:80px;display:inline-block"> %</td></tr>').join('');
    UI.dialog({
      title: s.id ? 'Edit ' + s.name : 'A supplier', wide: true,
      body: '<div class="g3">' + UI.field('Kind', '<select class="in" name="type">' + UI.options(Object.keys(RU.SUPPLIERS).map(k => [k, RU.SUPPLIERS[k]]), s.type) + '</select>') + UI.field('Name', '<input class="in" name="name" value="' + esc(s.name || '') + '" data-focus>') +
        UI.field('Stars', '<select class="in" name="star">' + UI.options([['', '—'], 1, 2, 3, 4, 5], s.star) + '</select>') + UI.field('Town', '<input class="in" name="town" value="' + esc(s.town || '') + '">') + UI.field('County', '<select class="in" name="county">' + UI.options([['', '—']].concat(RU.COUNTIES, [['Outside Ireland', 'Outside Ireland']], s.county && RU.COUNTIES.indexOf(s.county) < 0 && s.county !== 'Outside Ireland' ? [s.county] : []), s.county || '') + '</select>') +
        UI.field('Status', '<select class="in" name="status">' + UI.options([['active', 'In use'], ['closed', 'No longer used']], s.status) + '</select>') + UI.field('Contact', '<input class="in" name="contact" value="' + esc(s.contact || '') + '">') +
        UI.field('Email', '<input class="in" type="email" name="email" value="' + esc(s.email || '') + '">') + UI.field('Phone', '<input class="in" name="phone" value="' + esc(s.phone || '') + '">') + '</div>' +
        UI.field('Cancellation terms', '<select class="in" name="tpl">' + UI.options([['', 'None recorded']].concat(Object.keys(data.terms).map(k => [k, data.terms[k].name])).concat([['own', 'Their own terms…']]), tpl) + '</select>') +
        '<div data-own class="' + (tpl === 'own' ? '' : 'hidden') + '"><table class="tiers"><tbody data-tiers>' + tierRows(tpl === 'own' ? s.terms.tiers : null) + '</tbody></table><button class="btn sm" data-addtier>Another step</button></div>' +
        UI.field('Notes', '<textarea class="in" name="notes">' + esc(s.notes || '') + '</textarea>') + '<div class="err" data-err></div>',
      foot: '<button class="btn" data-x>Cancel</button><button class="btn p" data-ok>Save</button>',
      on: (el, close) => {
        const own = el.querySelector('[data-own]');
        el.querySelector('[name=tpl]').addEventListener('change', e => own.classList.toggle('hidden', e.target.value !== 'own'));
        el.querySelector('[data-addtier]').addEventListener('click', () => { const t = document.createElement('tbody'); t.innerHTML = tierRows(); el.querySelector('[data-tiers]').appendChild(t.firstElementChild); });
        el.querySelector('[data-ok]').addEventListener('click', async () => {
          const v = n => el.querySelector('[name=' + n + ']').value.trim();
          const tp = v('tpl');
          const terms = tp === 'own' ? { name: s.name ? s.name + ' terms' : 'Own terms', tiers: Array.from(el.querySelectorAll('[data-tiers] tr')).map(tr => ({ from: tr.querySelector('[name=tf]').value, pct: tr.querySelector('[name=tp]').value })).filter(x => x.from !== '' || x.pct !== '') } : tp || null;
          try {
            const r = await JOR.call('suppliers.save', { supplier: { id: s.id, type: v('type'), name: v('name'), star: v('star'), town: v('town'), county: v('county'), status: v('status'), contact: v('contact'), email: v('email'), phone: v('phone'), notes: v('notes'), terms: terms } });
            close(); openId = r.supplier.id; await refresh('Saved.');
          } catch (e) { el.querySelector('[data-err]').textContent = e.message; }
        });
      }
    });
  }
  function rateForm(s, r) {
    r = r || { year: String(thisYear + 1), unit: s.type === 'hotel' ? 'ppn' : s.type === 'coach' || s.type === 'guide' ? 'day' : 'pp' };
    UI.dialog({
      title: (r.id ? 'Change a rate — ' : 'A rate — ') + s.name,
      body: '<div class="g2">' + UI.field('For the year', '<input class="in" name="year" value="' + esc(r.year) + '" maxlength="4" data-focus>') + UI.field('Charged', '<select class="in" name="unit">' + UI.options(Object.keys(RU.RATE_UNITS).map(k => [k, RU.RATE_UNITS[k]]), r.unit) + '</select>') + '</div>' +
        UI.field('What', '<input class="in" name="label" value="' + esc(r.label || '') + '" placeholder="e.g. Group admission, Friday rate">', 'A hotel can have several — weekday, Friday, Saturday.') +
        '<div class="g2">' + UI.field('Rate (€)', UI.moneyIn('amount', r.amount)) + UI.field('Single supplement (€)', UI.moneyIn('single', r.single)) +
        UI.field('Valid from', '<input class="in" type="date" name="validFrom" value="' + esc(r.validFrom || '') + '">') + UI.field('Valid to', '<input class="in" type="date" name="validTo" value="' + esc(r.validTo || '') + '">') + '</div>' +
        UI.field('Where it came from', '<input class="in" name="source" value="' + esc(r.source || '') + '" placeholder="e.g. Email from Aoife, 3 Dec · Rates 27 › Visits › Galway">') + '<div class="err" data-err></div>',
      foot: (r.id ? '<button class="btn dngr" data-del>Remove</button>' : '') + '<button class="btn" data-x>Cancel</button><button class="btn p" data-ok>Save</button>',
      on: (el, close) => {
        UI.money(el);
        const v = n => el.querySelector('[name=' + n + ']').value.trim();
        el.querySelector('[data-ok]').addEventListener('click', async () => {
          try { await JOR.call('rates.save', { rate: { id: r.id, supplierId: s.id, year: v('year'), unit: v('unit'), label: v('label'), amount: UI.num(v('amount')), single: UI.num(v('single')), validFrom: v('validFrom'), validTo: v('validTo'), source: v('source') } }); close(); await refresh('Saved, dated today.'); }
          catch (e) { el.querySelector('[data-err]').textContent = e.message; }
        });
        const d = el.querySelector('[data-del]');
        if (d) d.addEventListener('click', async () => { try { await JOR.call('rates.delete', { id: r.id }); close(); await refresh('Removed.'); } catch (e) { el.querySelector('[data-err]').textContent = e.message; } });
      }
    });
  }
  $('#add').addEventListener('click', () => supplierForm());

  try { await JOR.live('suppliers.list', null, r => { data = r; render(); }); } catch (e) { $('#view').innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; return; }
  window.JORRATES = { data: () => data, openSupplier: openSupplier };
})();
