/* ═══════════════════════════════════════════════════════════════════════
   JORIS — money
   The account manager raises the deposit and the final payment on the day
   the agent's terms say; accounts mark them in and tick the ops file and
   Tourplan. Suppliers' bills are checked against what was booked and what
   the guide counted, then paid. A file shows everything still owed —
   it can't close until that list is empty.
   ═══════════════════════════════════════════════════════════════════════ */
(async function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = UI.esc, I = UI.icon, RU = window.JOR_RULES, D = window.JORWF_DATES;
  const me = await JOR.me();
  UI.topBar('Money', 'JORIS', me);
  const can = (perm, f) => RU.can(Object.assign({}, me, { status: 'active' }), perm, f);
  const qs = new URLSearchParams(location.hash.slice(1));
  let view = me.role === 'accounts' ? 'debtors' : 'invoices', data = null, openRef = null;
  const filt = { pay: me.role === 'account' ? 'mine' : 'open', bill: 'open' };

  const fileOf = ref => data.files.find(f => f.ref === ref) || { ref: ref };
  const nameOf = id => (data.people.find(p => p.id === id) || {}).name || '';
  const short = id => nameOf(id).split(' ')[0];
  const PAY = RU.PAYMENTS, PS = RU.PAY_STATUS, BS = RU.BILL_STATUS;
  async function load() { data = await JOR.call('money.list'); }

  function tabs() {
    const t = [['invoices', 'Invoices to clients'], ['debtors', 'Waiting to be paid'], ['bills', 'Suppliers’ bills'], ['risk', 'At risk']];
    $('#tabs').innerHTML = t.map(x => '<button data-tab="' + x[0] + '" class="' + (view === x[0] ? 'on' : '') + '">' + x[1] + '</button>').join('');
    if (me.perms['money.bills']) { $('#newbill').classList.remove('hidden'); $('#newbill').innerHTML = I('plus', 'sm') + 'A supplier’s bill in'; }
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; view = b.dataset.tab; render(); });
  function render() { tabs(); ({ invoices: invoices, debtors: debtors, bills: bills, risk: risk })[view](); }
  const out = p => Math.round(((+p.amount || 0) - (+p.receivedAmount || 0)) * 100) / 100;

  /* ══ Invoices ═══════════════════════════════════════════════════════ */
  function invoices() {
    let list = data.payments.filter(p => p.status !== 'void');
    if (filt.pay === 'mine') list = list.filter(p => { const am = fileOf(p.ref).am; return am === me.id || (me.covers || []).indexOf(am) >= 0; });
    if (filt.pay === 'open' || filt.pay === 'mine') list = list.filter(p => p.status !== 'received');
    else if (filt.pay !== 'all') list = list.filter(p => p.status === filt.pay);
    list.sort((a, b) => (a.raiseBy || a.dueOn || '9') < (b.raiseBy || b.dueOn || '9') ? -1 : 1);
    $('#view').innerHTML = '<div class="bar"><select class="in" id="fp">' + UI.options([['open', 'Not paid yet'], ['mine', 'My files, not paid yet'], ['due', 'To invoice'], ['raised', 'Invoiced'], ['part', 'Part paid'], ['received', 'Paid'], ['all', 'Everything']], filt.pay) + '</select></div>' +
      '<div class="card tw">' + (list.length ? '<table class="t"><thead><tr><th>File</th><th>What</th><th>Status</th><th class="num">Amount</th><th>Invoice</th><th>Invoice by</th><th>Due from client</th><th class="num">Received</th><th>Ops file · T/P</th></tr></thead><tbody>' +
        list.map(p => {
          const f = fileOf(p.ref), late = p.dueOn && p.dueOn < data.today && p.status !== 'received', toRaise = p.status === 'due' && p.raiseBy && p.raiseBy <= data.today;
          return '<tr class="clk' + (toRaise ? ' amber' : '') + '" data-open="' + esc(p.ref) + '"><td class="nw"><span class="ref">' + esc(p.ref) + '</span> ' + esc(f.agent) + '<span class="mini"> ' + esc(short(f.am)) + '</span></td>' +
            '<td>' + esc(PAY[p.kind]) + (p.kind === 'other' && p.notes ? '<span class="mini"> ' + esc(p.notes) + '</span>' : '') + '</td><td>' + payPill(p) + '</td>' +
            '<td class="num">' + (p.amount === '' ? '' : esc(UI.euro(p.amount))) + '</td><td>' + esc(p.invoiceNo) + '</td>' +
            '<td class="nw' + (toRaise ? ' late' : '') + '">' + (p.status === 'due' ? (p.raiseBy ? esc(UI.nice(p.raiseBy, true)) : '<span class="pill warn">date to set</span>') : esc(UI.nice(p.raisedOn, true))) + '</td>' +
            '<td class="nw' + (late ? ' late' : '') + '">' + esc(UI.nice(p.dueOn, true)) + '</td><td class="num">' + (p.receivedAmount ? esc(UI.euro(p.receivedAmount)) : '') + '</td>' +
            '<td class="ticks">' + (p.status === 'received' || p.status === 'part' ? (p.opsFile ? I('check', 'sm') : '—') + ' · ' + (p.tpUpdated ? I('check', 'sm') : '—') : '') + '</td></tr>';
        }).join('') + '</tbody></table>' : '<div class="empty">Nothing here.</div>') + '</div>';
    $('#fp').addEventListener('change', e => { filt.pay = e.target.value; invoices(); });
  }
  function payPill(p) {
    if (p.status === 'due') return '<span class="pill warn">' + esc(PS.due) + '</span>';
    if (p.status === 'received') return '<span class="pill confirmed">' + esc(PS.received) + '</span>';
    if (p.status === 'void') return '<span class="pill lost">' + esc(PS.void) + '</span>';
    const late = p.dueOn && p.dueOn < data.today;
    return '<span class="pill ' + (late ? 'err' : 'quoted') + '">' + esc(PS[p.status]) + (late ? ' — ' + D.diffDays(p.dueOn, data.today) + ' days late' : '') + '</span>';
  }

  /* ══ Debtors: invoiced, not paid ════════════════════════════════════ */
  function debtors() {
    const list = data.payments.filter(p => p.status === 'raised' || p.status === 'part').sort((a, b) => (a.dueOn || '9') < (b.dueOn || '9') ? -1 : 1);
    const total = list.reduce((a, p) => a + out(p), 0), late = list.filter(p => p.dueOn && p.dueOn < data.today), lateSum = late.reduce((a, p) => a + out(p), 0);
    $('#view').innerHTML = '<div class="tiles"><div class="tile"><div class="k">Invoiced, not paid</div><div class="v">' + esc(UI.euro(total)) + '</div><div class="s">' + list.length + ' invoice' + (list.length === 1 ? '' : 's') + '</div></div>' +
      '<div class="tile ' + (late.length ? 'err' : '') + '"><div class="k">Past their due date</div><div class="v">' + esc(UI.euro(lateSum)) + '</div><div class="s">' + late.length + ' invoice' + (late.length === 1 ? '' : 's') + '</div></div></div>' +
      '<div class="card tw">' + (list.length ? '<table class="t"><thead><tr><th>File</th><th>What</th><th>Invoice</th><th>Raised</th><th class="num">Days out</th><th>Due</th><th class="num">Outstanding</th><th></th></tr></thead><tbody>' +
        list.map(p => {
          const f = fileOf(p.ref), lt = p.dueOn && p.dueOn < data.today;
          return '<tr class="clk' + (lt ? ' amber' : '') + '" data-open="' + esc(p.ref) + '"><td class="nw"><span class="ref">' + esc(p.ref) + '</span> ' + esc(f.agent) + '</td><td>' + esc(PAY[p.kind]) + '</td><td>' + esc(p.invoiceNo) + '</td>' +
            '<td class="nw">' + esc(UI.nice(p.raisedOn, true)) + '</td><td class="num">' + (p.raisedOn ? D.diffDays(p.raisedOn, data.today) : '') + '</td><td class="nw' + (lt ? ' late' : '') + '">' + esc(UI.nice(p.dueOn, true)) + '</td>' +
            '<td class="num"><b>' + esc(UI.euro(out(p))) + '</b></td><td>' + (can('money.receive') ? '<button class="btn sm p" data-recv="' + esc(p.id) + '">Money in</button>' : '') + '</td></tr>';
        }).join('') + '</tbody></table>' : '<div class="empty">Every invoice is paid.</div>') + '</div>';
  }

  /* ══ Suppliers' bills ═══════════════════════════════════════════════ */
  function bills() {
    let list = data.bills.slice();
    if (filt.bill === 'open') list = list.filter(b => b.status !== 'paid');
    else if (filt.bill !== 'all') list = list.filter(b => b.status === filt.bill);
    list.sort((a, b) => a.receivedOn < b.receivedOn ? -1 : 1);
    $('#view').innerHTML = '<div class="bar"><select class="in" id="fb">' + UI.options([['open', 'Not paid yet'], ['tocheck', 'To check'], ['query', 'In query'], ['ok', 'Checked — to pay'], ['paid', 'Paid'], ['all', 'Everything']], filt.bill) + '</select></div>' +
      '<div class="card tw">' + (list.length ? '<table class="t"><thead><tr><th>File</th><th>Supplier</th><th>Invoice</th><th>In</th><th class="num">Amount</th><th>Status</th><th>Checked</th></tr></thead><tbody>' +
        list.map(b => '<tr class="clk" data-open="' + esc(b.ref) + '"><td class="nw"><span class="ref">' + esc(b.ref) + '</span> ' + esc(fileOf(b.ref).agent) + '</td><td>' + esc(b.supplier) + '</td><td>' + esc(b.invoiceNo) + '</td>' +
          '<td class="nw">' + esc(UI.nice(b.receivedOn, true)) + '</td><td class="num">' + esc(UI.euro(b.amount)) + '</td><td>' + billPill(b) + '</td><td class="nw">' + esc(b.checkedBy ? short(b.checkedBy) + ' ' + UI.when(b.checkedAt) : '') + '</td></tr>').join('') +
        '</tbody></table>' : '<div class="empty">Nothing here.</div>') + '</div>';
    $('#fb').addEventListener('change', e => { filt.bill = e.target.value; bills(); });
  }
  const billPill = b => '<span class="pill ' + ({ tocheck: 'warn', query: 'err', ok: 'quoted', paid: 'confirmed' }[b.status] || '') + '">' + esc(BS[b.status]) + '</span>' +
    (b.flag && !b.ok && (b.status === 'tocheck' || b.status === 'query') ? ' <span class="pill err">Flagged</span>' : '');

  /* ══ At risk: rooms JOR would pay for, and no deposit in ════════════ */
  function risk() {
    $('#view').innerHTML = '<p class="sub">Confirmed files where cancelling the hotels today would cost JOR money, and the client’s deposit isn’t in yet.</p><div class="card tw">' + (data.risk.length ? '<table class="t"><thead><tr><th>File</th><th>Arrives</th><th>Account manager</th><th>Deposit</th><th class="num">JOR would owe the hotels</th></tr></thead><tbody>' +
      data.risk.map(x => '<tr class="clk" data-open="' + esc(x.ref) + '"><td class="nw"><span class="ref">' + esc(x.ref) + '</span> ' + esc(x.agent) + '</td><td class="nw">' + esc(UI.nice(x.arrival, true)) + '</td><td>' + esc(nameOf(x.am)) + '</td>' +
        '<td>' + (x.deposit === 'none' ? '<span class="pill err">none set up</span>' : '<span class="pill warn">' + esc(PS[x.deposit] || x.deposit) + '</span>') + '</td><td class="num late">' + esc(UI.euro(x.exposure)) + '</td></tr>').join('') + '</tbody></table>' : '<div class="empty">Nothing at risk.</div>') + '</div>';
  }

  $('#view').addEventListener('click', e => {
    const r = e.target.closest('[data-recv]');
    if (r) { e.stopPropagation(); received(data.payments.find(p => p.id === r.dataset.recv)); return; }
    const o = e.target.closest('[data-open]'); if (o) openFile(o.dataset.open);
  });

  /* ══ One file's money ═══════════════════════════════════════════════ */
  let fileData = null;
  async function openFile(ref) {
    openRef = ref;
    history.replaceState(null, '', '#ref=' + encodeURIComponent(ref));
    const side = $('#side');
    side.classList.remove('hidden');
    side.innerHTML = '<div class="sh"><div class="tt"><b>' + esc(ref) + '</b></div><button class="btn ghost" data-close>' + I('x') + '</button></div><div class="sb"><div class="empty">Opening…</div></div>';
    side.querySelector('[data-close]').addEventListener('click', closeFile);
    try { fileData = await JOR.call('money.file', { ref: ref }); } catch (e) { side.querySelector('.sb').innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; return; }
    if (openRef === ref) paintFile();
  }
  function closeFile() { openRef = null; $('#side').classList.add('hidden'); $('#side').innerHTML = ''; history.replaceState(null, '', '#'); }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && openRef && !document.querySelector('.scrim')) closeFile(); });

  function paintFile() {
    const f = fileOf(openRef), r = fileData, side = $('#side');
    const raise = can('money.raise', f), recv = can('money.receive', f), billIn = can('money.bills', f), check = can('money.check', f);
    let h = '<div class="sh"><div class="tt"><b>' + esc(f.ref) + ' — ' + esc(f.agent || '') + '</b><span class="mini">' + UI.pill(f.status) + ' · ' +
      esc([f.pax ? f.pax + ' pax' : '', f.arrival ? UI.nice(f.arrival, true) + (f.departure ? ' – ' + UI.nice(f.departure, true) : '') : '', f.am ? 'with ' + nameOf(f.am) : ''].filter(Boolean).join(' · ')) + '</span></div>' +
      '<button class="btn ghost" data-close title="Close">' + I('x') + '</button></div><div class="sb">' +
      '<div class="xlinks"><a href="../register/#ref=' + encodeURIComponent(f.ref) + '">' + I('list', 'sm') + 'The file</a>' + (me.perms['res.view'] ? '<a href="../reservations/#ref=' + encodeURIComponent(f.ref) + '">' + I('bed', 'sm') + 'Reservations</a>' : '') +
      (me.perms['costing.view'] ? '<a href="../costing/#ref=' + encodeURIComponent(f.ref) + '">' + I('calc', 'sm') + 'Costing</a>' : '') + '</div>';
    h += r.owing.length ? '<div class="warnbox"><b>Still owed, in or out — the file can’t close until this is clear:</b><br>' + r.owing.map(esc).join('<br>') + '</div>' : (f.status === 'confirmed' || f.status === 'closed') ? '<div class="okbox">Nothing owed either way.</div>' : '';
    h += '<h4>From the client</h4>' + (r.payments.length ? r.payments.map(p => payCard(p, raise, recv)).join('') : '<div class="mini">Nothing yet — the deposit and final payment are set up when the file is confirmed.</div>') +
      (raise ? '<div class="acts"><button class="btn sm" data-act="addpay">' + I('plus', 'sm') + 'Something else to invoice</button></div>' : '');
    h += '<h4>Suppliers’ bills</h4>' + (r.bills.length ? r.bills.map(b => billCard(b, check, recv, billIn)).join('') : '<div class="mini">None in yet.</div>') +
      (billIn ? '<div class="acts"><button class="btn sm" data-act="addbill">' + I('plus', 'sm') + 'A bill in</button></div>' : '');
    const exp = Object.keys(r.expected).map(k => r.expected[k]);
    if (exp.length) h += '<h4>What each supplier should bill</h4>' + exp.map(x => '<div class="exp"><b>' + esc(x.supplier) + '</b>' + (x.booked ? ' — booked ' + esc(UI.euro(x.booked)) + ' (' + x.rooms + ' rooms)' :
      x.rooms ? ' — ' + x.rooms + ' rooms booked, but no PP/PN rate on the pink sheet to check the bill against' : '') +
      (x.cancelCost ? ' · cancellation ' + esc(UI.euro(x.cancelCost)) : '') + x.counts.map(c => '<div>' + esc(c.voucher) + ': the guide counted <b>' + c.pax + '</b>' + (c.booked !== '' ? ' of ' + c.booked + ' booked' : '') + ' on ' + esc(UI.when(c.at)) + (c.note ? ' — ' + esc(c.note) : '') + '</div>').join('') + '</div>').join('');
    side.innerHTML = h + '</div>';
    side.querySelector('[data-close]').addEventListener('click', closeFile);
    side.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
      const p = r.payments.find(x => x.id === b.dataset.p), bill = r.bills.find(x => x.id === b.dataset.b), a = b.dataset.act;
      if (a === 'raise') raiseForm(p, f);
      else if (a === 'dates') datesForm(p);
      else if (a === 'recv') received(p);
      else if (a === 'ops' || a === 'tp') act(() => JOR.call('payment.tick', { id: p.id, key: a === 'ops' ? 'opsFile' : 'tpUpdated', on: !(a === 'ops' ? p.opsFile : p.tpUpdated) }), 'Ticked.');
      else if (a === 'addpay') addPay(f);
      else if (a === 'addbill') billForm({ ref: f.ref });
      else if (a === 'editbill') billForm(bill);
      else if (a === 'check') checkForm(bill);
      else if (a === 'okflag') ask('OK a flagged bill', '<p>' + esc(bill.flag.text) + '</p>' + UI.field('Why is it right?', '<textarea class="in" name="why" data-focus placeholder="e.g. Extra night agreed with the client"></textarea>'), 'OK it',
        el => JOR.call('bill.okFlag', { id: bill.id, why: v(el, 'why') }).then(() => 'OK’d — it’s in the log.'));
      else if (a === 'paid') ask('Paid ' + bill.supplier + '?', UI.field('Paid on', '<input class="in" type="date" name="d" value="' + data.today + '" data-focus>'), 'Mark it paid',
        el => JOR.call('bill.paid', { id: bill.id, paidOn: el.querySelector('[name=d]').value }).then(() => 'Marked paid.'));
    }));
  }
  function payCard(p, raise, recv) {
    const bits = [p.amount !== '' ? UI.euro(p.amount) : '', p.invoiceNo ? 'invoice ' + p.invoiceNo : '', p.status === 'due' ? (p.raiseBy ? 'invoice by ' + UI.nice(p.raiseBy, true) : 'no date set yet') : 'raised ' + UI.nice(p.raisedOn, true) + ' by ' + short(p.raisedBy),
      p.dueOn ? 'due ' + UI.nice(p.dueOn, true) : '', p.receivedAmount ? UI.euro(p.receivedAmount) + ' in ' + UI.nice(p.receivedOn, true) : ''].filter(Boolean);
    const b = (a, label, cls) => '<button class="btn sm ' + (cls || '') + '" data-act="' + a + '" data-p="' + esc(p.id) + '">' + label + '</button>';
    return '<div class="pay"><div class="top2"><b>' + esc(PAY[p.kind]) + '</b>' + (p.notes ? '<span class="mini">' + esc(p.notes) + '</span>' : '') + '<span class="sp"></span>' + payPill(p) + '</div><div class="mini">' + esc(bits.join(' · ')) + '</div>' +
      '<div class="acts">' + (p.status === 'due' && raise ? b('raise', 'Invoice raised', 'p') + b('dates', 'Dates') : '') + ((p.status === 'raised' || p.status === 'part') && raise ? b('dates', 'Due date') : '') +
      ((p.status === 'raised' || p.status === 'part') && recv ? b('recv', 'Money in', 'p') : '') +
      ((p.status === 'received' || p.status === 'part') && recv ? b('ops', (p.opsFile ? I('check', 'sm') : '') + 'Ops file updated') + b('tp', (p.tpUpdated ? I('check', 'sm') : '') + 'Tourplan updated') : '') + '</div></div>';
  }
  function billCard(bl, check, recv, billIn) {
    const b = (a, label, cls) => '<button class="btn sm ' + (cls || '') + '" data-act="' + a + '" data-b="' + esc(bl.id) + '">' + label + '</button>';
    return '<div class="pay"><div class="top2"><b>' + esc(bl.supplier) + '</b><span class="mini">' + esc(bl.invoiceNo) + '</span><span class="sp"></span>' + billPill(bl) + '</div>' +
      '<div class="mini">' + esc(UI.euro(bl.amount)) + ' · in ' + esc(UI.nice(bl.receivedOn, true)) + (bl.checkedBy ? ' · checked by ' + esc(short(bl.checkedBy)) : '') + (bl.paidOn ? ' · paid ' + esc(UI.nice(bl.paidOn, true)) : '') + (bl.notes ? ' · ' + esc(bl.notes) : '') + '</div>' +
      (bl.status === 'query' ? '<div class="warnbox">Query: ' + esc(bl.query) + '</div>' : '') +
      (bl.flag && bl.ok ? '<div class="okbox flag">' + I('check', 'sm') + ' ' + esc(bl.flag.text) + ' <span class="mini">OK’d by ' + esc(bl.ok.by) + ': ' + esc(bl.ok.why) + '</span></div>'
        : bl.flag && bl.status !== 'paid' && bl.status !== 'ok' ? '<div class="errbox flag">' + I('flag', 'sm') + ' <b>Flagged:</b> ' + esc(bl.flag.text) + (me.perms['price.ok'] ? '' : ' <span class="mini">Management OK it before it is passed.</span>') + '</div>' : '') +
      '<div class="acts">' + (bl.flag && !bl.ok && (bl.status === 'tocheck' || bl.status === 'query') && me.perms['price.ok'] ? b('okflag', 'OK it') : '') + ((bl.status === 'tocheck' || bl.status === 'query') && check ? b('check', 'Check it', 'p') : '') + (bl.status === 'ok' && recv ? b('paid', 'Paid', 'p') : '') +
      ((bl.status === 'tocheck' || bl.status === 'query') && billIn ? b('editbill', 'Change') : '') + '</div></div>';
  }

  async function refresh(msg) { await load(); render(); if (openRef) { fileData = await JOR.call('money.file', { ref: openRef }); paintFile(); } if (msg) UI.toast(msg); }
  async function act(fn, msg) { try { await fn(); await refresh(msg); } catch (e) { if (e.stale) { await refresh(); UI.toast(e.message, 6000); } else UI.toast(e.message, 5000); } }
  const ask = (title, body, ok, run, danger) => UI.dialog({
    title: title, body: body + '<div class="err" data-err></div>', foot: '<button class="btn" data-x>Cancel</button><button class="btn ' + (danger ? 'dngr' : 'p') + '" data-ok>' + esc(ok) + '</button>',
    on: (el, close) => { UI.money(el); el.querySelector('[data-ok]').addEventListener('click', async () => {
      try { const m = await run(el); close(); await refresh(m); } catch (e) { if (e.stale) { close(); await refresh(); UI.toast(e.message, 6000); } else el.querySelector('[data-err]').textContent = e.message; }
    }); }
  });
  const v = (el, n) => el.querySelector('[name=' + n + ']').value.trim();

  function raiseForm(p, f) {
    ask(PAY[p.kind] + ' invoice — ' + f.ref, '<div class="g2">' + UI.field('Tourplan invoice number', '<input class="in" name="inv" data-focus>') + UI.field('Amount (€)', UI.moneyIn('amt', p.amount)) +
      UI.field('Raised on', '<input class="in" type="date" name="on" value="' + data.today + '">') + UI.field('Due from the client', '<input class="in" type="date" name="due" value="' + esc(p.dueOn || D.addDays(data.today, +data.settings.depositPayDays || 14)) + '">') + '</div>',
      'Invoice raised', el => JOR.call('payment.raise', { id: p.id, rev: p.rev, invoiceNo: v(el, 'inv'), amount: UI.num(v(el, 'amt')), raisedOn: v(el, 'on'), dueOn: v(el, 'due') }).then(() => 'Raised — accounts will see it come in.'));
  }
  function datesForm(p) {
    ask(PAY[p.kind] + ' — dates', '<div class="g2">' + (p.status === 'due' ? UI.field('Invoice goes out by', '<input class="in" type="date" name="rb" value="' + esc(p.raiseBy) + '" data-focus>') : '') +
      UI.field('Due from the client', '<input class="in" type="date" name="due" value="' + esc(p.dueOn) + '">') + '</div>' + UI.field('Why (e.g. the operator’s contract says 8 weeks)', '<input class="in" name="notes" value="' + esc(p.notes) + '">'),
      'Save', el => JOR.call('payment.dates', { id: p.id, rev: p.rev, raiseBy: p.status === 'due' ? v(el, 'rb') : undefined, dueOn: v(el, 'due'), notes: v(el, 'notes') }).then(() => 'Dates saved — they won’t move by themselves now.'));
  }
  function received(p) {
    ask('Money in — ' + p.ref + ' ' + PAY[p.kind], '<div class="g2">' + UI.field('Amount (€)', UI.moneyIn('amt', out(p), 'data-focus')) + UI.field('Received on', '<input class="in" type="date" name="on" value="' + data.today + '">') + '</div>' +
      '<p class="mini">Then tick the ops file and Tourplan as updated.</p>', 'Mark it in',
      el => JOR.call('payment.received', { id: p.id, rev: p.rev, amount: UI.num(v(el, 'amt')), receivedOn: v(el, 'on') }).then(r => r.payment.status === 'part' ? 'Part paid — the rest is still due.' : 'Paid in full.'));
  }
  function addPay(f) {
    ask('Something else to invoice — ' + f.ref, UI.field('What for', '<input class="in" name="notes" data-focus placeholder="e.g. Extra night in Dublin">') + '<div class="g3">' + UI.field('Amount (€)', UI.moneyIn('amt', '')) +
      UI.field('Invoice by', '<input class="in" type="date" name="rb" value="' + data.today + '">') + UI.field('Due', '<input class="in" type="date" name="due">') + '</div>', 'Add it',
      el => JOR.call('payment.add', { ref: f.ref, kind: 'other', notes: v(el, 'notes'), amount: UI.num(v(el, 'amt')), raiseBy: v(el, 'rb'), dueOn: v(el, 'due') }).then(() => 'Added.'));
  }
  function billForm(bl) {
    const live = data.files.filter(f => f.status === 'confirmed' || f.status === 'closed' || f.ref === bl.ref);
    ask(bl.id ? 'Change the bill' : 'A supplier’s bill in', ''+
      '<div class="g2">' + UI.field('File', '<select class="in" name="ref"' + (bl.id ? ' disabled' : '') + '>' + UI.options(live.map(f => [f.ref, f.ref + ' ' + f.agent]), bl.ref || '') + '</select>') +
      UI.field('Supplier', UI.pick('sup', data.suppliers.map(s => ({ v: s.name, t: s.name, h: s.town || '' })).concat(bl.supplier && !data.suppliers.some(s => s.name === bl.supplier) ? [{ v: bl.supplier, t: bl.supplier, h: '' }] : []), bl.supplier || '', { focus: true, free: true, placeholder: 'Start typing the supplier' }), 'Pick it from the list — one that isn’t there yet goes in as typed.') + UI.field('Their invoice number', '<input class="in" name="inv" value="' + esc(bl.invoiceNo || '') + '">') +
      UI.field('Amount (€)', UI.moneyIn('amt', bl.amount)) + UI.field('Received on', '<input class="in" type="date" name="on" value="' + esc(bl.receivedOn || data.today) + '">') + UI.field('Note', '<input class="in" name="notes" value="' + esc(bl.notes || '') + '">') + '</div>',
      bl.id ? 'Save' : 'Put it in', el => {
        const sup = data.suppliers.find(s => s.name.toLowerCase() === v(el, 'sup').toLowerCase());
        return JOR.call('bill.save', { bill: { id: bl.id, rev: bl.rev, ref: bl.ref || v(el, 'ref'), supplierId: sup ? sup.id : '', supplier: v(el, 'sup'), invoiceNo: v(el, 'inv'), amount: UI.num(v(el, 'amt')), receivedOn: v(el, 'on'), notes: v(el, 'notes') } })
          .then(r => { openRef = r.bill.ref; return 'In — the account manager checks it against the vouchers.'; });
      });
  }
  function checkForm(bl) {
    const x = fileData.expected[bl.supplierId] || Object.values(fileData.expected).find(e => e.supplier === bl.supplier);
    UI.dialog({
      title: 'Check the bill — ' + bl.supplier, body: '<p>Billed <b>' + esc(UI.euro(bl.amount)) + '</b>, invoice ' + esc(bl.invoiceNo) + '.</p>' +
        (x ? '<div class="exp">' + (x.booked ? 'Booked with them on this file: <b>' + esc(UI.euro(x.booked)) + '</b>' + (Math.abs(x.booked - bl.amount) > 0.5 ? ' — <b class="late">' + esc(UI.euro(bl.amount - x.booked)) + ' different</b>' : ' — the same') : '') +
          x.counts.map(c => '<div>' + esc(c.voucher) + ': the guide counted <b>' + c.pax + '</b>' + (c.booked !== '' ? ' of ' + c.booked : '') + '</div>').join('') + '</div>' : '<div class="mini">Nothing booked with them through JORIS — check it against the vouchers.</div>') +
        UI.field('If something’s wrong, what?', '<textarea class="in" name="q" placeholder="e.g. Charged 20 twins, we had 15"></textarea>') + '<div class="err" data-err></div>',
      foot: '<button class="btn" data-x>Cancel</button><button class="btn dngr" data-query>Query it</button><button class="btn p" data-okb>It’s right</button>',
      on: (el, close) => {
        const go = async ok => { try { await JOR.call('bill.check', { id: bl.id, rev: bl.rev, ok: ok, query: el.querySelector('[name=q]').value }); close(); await refresh(ok ? 'Checked — accounts can pay it.' : 'Queried.'); } catch (e) { el.querySelector('[data-err]').textContent = e.message; } };
        el.querySelector('[data-okb]').addEventListener('click', () => go(true));
        el.querySelector('[data-query]').addEventListener('click', () => go(false));
      }
    });
  }
  $('#newbill').addEventListener('click', () => billForm({}));

  try { await load(); } catch (e) { $('#view').innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; return; }
  render();
  if (qs.get('ref')) openFile(qs.get('ref'));
  window.addEventListener('hashchange', () => { const r = new URLSearchParams(location.hash.slice(1)).get('ref'); if (r && r !== openRef) openFile(r); });
  window.JORMONEY = { data: () => data, openFile: openFile };
})();
