/* JORIS — people and access, reference numbers, and the log. */
(async function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = UI.esc, I = UI.icon, RU = window.JOR_RULES;
  const me = await JOR.me();
  UI.topBar('People & settings', 'JORIS', me);
  const isAdmin = !!me.perms['people.manage'];
  const VIEWS = ['people', 'numbers', 'settings', 'history', 'import', 'export'];
  let view = location.hash === '#bin' && me.perms['bin.view'] ? 'bin' : location.hash === '#log' || !isAdmin ? 'log' : VIEWS.indexOf(location.hash.slice(1)) >= 0 ? location.hash.slice(1) : 'people';
  if (!isAdmin && !me.perms['audit.view'] && !me.perms['bin.view']) { $('#view').innerHTML = '<div class="empty">This page is for admins.</div>'; return; }

  function tabs() {
    const t = (isAdmin ? [['people', 'People'], ['numbers', 'Reference numbers'], ['settings', 'Settings']].concat(me.perms['history.import'] ? [['history', 'JOR’s history']] : [])
      .concat([['import', 'Bring in a spreadsheet']]).concat(me.perms['export.all'] ? [['export', 'Export & backup']] : []) : []).concat(me.perms['audit.view'] ? [['log', 'Who changed what']] : []).concat(me.perms['bin.view'] ? [['bin', 'Bin']] : []);
    $('#tabs').innerHTML = t.map(x => '<button data-tab="' + x[0] + '" class="' + (view === x[0] ? 'on' : '') + '">' + x[1] + '</button>').join('');
    $('#add').classList.toggle('hidden', !(isAdmin && view === 'people'));
    $('#add').innerHTML = I('plus', 'sm') + 'Add a person';
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; view = b.dataset.tab; history.replaceState(null, '', '#' + view); render(); });
  function render() { tabs(); ({ people: people, numbers: numbers, log: log, bin: bin, settings: settings, history: historyView, import: importer, export: exporter })[view]({ quick: true }); typing = false; }
  /* Clicking a tab: what this browser tab last saw of it is drawn at once, the server is asked behind it, and the
     tab is drawn again if the answer is different (and the person is still on it, and hasn't begun typing). After
     a change — a person added, a number set — only the server's own answer is drawn: o.quick is not set. */
  const turn = {};
  let typing = false;
  async function seenOr(v, a, extra, o, redraw) {
    if (o && o.data) return o.data;
    const seen = o && o.quick ? JOR.last(a, extra) : null;
    const n = turn[v] = (turn[v] || 0) + 1;
    if (!seen) { const r = await JOR.call(a, extra); JOR.keep(a, extra, r); return r; }
    JOR.call(a, extra).then(r => {
      const changed = JSON.stringify(r) !== JSON.stringify(seen);
      JOR.keep(a, extra, r);
      if (changed && view === v && turn[v] === n && !typing) redraw({ data: r });
    }).catch(() => { });
    return seen;
  }
  $('#view').addEventListener('input', () => { typing = true; });
  /* The other tabs' lists, fetched quietly once this one is drawn. */
  if (isAdmin) setTimeout(() => JOR.warm(['people.list', 'numbers.list'].concat(me.perms['audit.view'] ? [['audit.list', { limit: 500 }]] : []).concat(me.perms['bin.view'] ? ['bin.list'] : [])), 1000);

  /* ══ People ═════════════════════════════════════════════════════════ */
  let list = [];
  async function people(o) {
    try { list = (await seenOr('people', 'people.list', null, o, people)).people.slice(); } catch (e) { $('#view').innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; return; }
    if (view !== 'people') return;
    const order = p => (p.status === 'left' ? 2 : 0) + (p.waiting ? 0 : 0);
    list.sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name));
    const state = p => p.status === 'left' ? '<span class="pill lost">left</span>' : p.locked ? '<span class="pill err">locked</span>' : p.waiting ? '<span class="pill warn">hasn’t signed in yet</span>' : '<span class="pill confirmed">active</span>';
    /* An owner's login, or that of someone who sees every figure, is an owner's to change. */
    const theirs = p => (p.owner === 'yes' || p.finance === 'yes') && me.owner !== 'yes' && p.id !== me.id;
    $('#view').innerHTML = '<div class="card tw"><table class="t"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Team</th><th>Admin</th><th>Login</th><th>Last seen</th><th></th></tr></thead><tbody>' +
      list.map(p => '<tr data-id="' + esc(p.id) + '"' + (p.status === 'left' ? ' class="dim"' : '') + '><td><b>' + esc(p.name) + '</b> <span class="mini">' + esc(p.initials) + '</span></td><td>' + esc(p.email) + '</td>' +
        '<td>' + esc(RU.ROLES[p.role] || p.role) + (p.finance === 'yes' ? ' <span class="mini">· finance</span>' : '') + '</td><td>' + esc(p.team) + '</td><td>' + (p.owner === 'yes' ? 'Owner' : p.admin === 'yes' ? 'Yes' : '') + '</td><td>' + state(p) + '</td>' +
        '<td class="nw">' + esc(UI.when(p.lastSeen)) + '</td><td><div class="acts">' +
        (theirs(p) ? '<span class="mini">An owner looks after this login</span>' : p.status === 'active' ? '<button class="btn sm" data-act="edit">Edit</button><button class="btn sm" data-act="reset">' + (p.waiting ? 'New code' : 'Reset login') + '</button>' +
          (p.locked ? '<button class="btn sm" data-act="unlock">Unlock</button>' : '') + '<button class="btn sm" data-act="devices">' + (p.devices ? p.devices + ' computer' + (p.devices === 1 ? '' : 's') : 'Computers') + '</button>' +
          (p.id !== me.id ? '<button class="btn sm dngr" data-act="left">Has left</button>' : '')
          : '<button class="btn sm" data-act="back">Back at JOR</button>') + '</div></td></tr>').join('') + '</tbody></table></div>' +
      '<p class="mini" style="margin-top:10px">A new person gets a starting code, good for 7 days. They sign in at ' + esc(JOR.ROOT) + ' with their email and the code, then choose their own password. Nobody else ever sees it.</p>';
  }
  $('#view').addEventListener('click', async e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const p = list.find(x => x.id === b.closest('tr').dataset.id);
    try {
      if (b.dataset.act === 'edit') personForm(p);
      else if (b.dataset.act === 'reset') {
        if (!await UI.confirm((p.waiting ? 'A new starting code for ' : 'Reset ') + p.name + '?', (p.waiting ? 'The old code stops working.' : 'Their password stops working and they are signed out everywhere.') + ' You’ll get a new starting code to give them.', 'Make a new code')) return;
        const r = await JOR.call('people.reset', { id: p.id });
        showCode(p, r.code); people();
      } else if (b.dataset.act === 'unlock') { await JOR.call('people.unlock', { id: p.id }); UI.toast(p.name + ' can sign in again.'); people(); }
      else if (b.dataset.act === 'left') leaver(p);
      else if (b.dataset.act === 'devices') devices(p); else if (b.dataset.act === 'back') { await JOR.call('people.status', { id: p.id, status: 'active' }); UI.toast('Use Reset login to give them a starting code.'); people(); }
    } catch (err) { UI.toast(err.message, 5000); }
  });

  /* Someone has left, in one go: signed out this minute on every computer and phone, and their work handed on. */
  async function leaver(p) {
    let files = [], tasks = 0;
    try {
      files = (await JOR.call('register.list')).files.filter(f => f.am === p.id && (RU.OPEN[f.status] || f.status === 'confirmed'));
      tasks = ((await JOR.call('todo.list', { who: p.id })).items || []).filter(x => x.kind === 'task').length;
    } catch (e) { /* the counts are a help; the server checks anyway */ }
    const takers = list.filter(x => x.status === 'active' && x.id !== p.id && ['account', 'management', 'operations', 'reservations'].indexOf(x.role) >= 0);
    const work = files.length || tasks;
    UI.dialog({
      title: p.name + ' has left JOR',
      body: '<p>From the moment you press the button:</p><ul class="mini" style="line-height:1.7;margin:0 0 10px 18px"><li>' + esc(p.name.split(' ')[0]) + ' is signed out on every computer and phone, and can’t sign in again;</li>' +
        '<li>every computer they used is forgotten, and nobody is covering for them any more;</li><li>any setting that names them — who assigns files, who leads reservations — goes back to the default;</li>' +
        '<li>their name stays on everything they did. Nothing is deleted.</li></ul>' +
        (work ? '<h3 style="margin:12px 0 6px">Their work: ' + files.length + ' open file' + (files.length === 1 ? '' : 's') + (tasks ? ' and ' + tasks + ' task' + (tasks === 1 ? '' : 's') : '') + '</h3>' +
          (files.length ? '<p class="mini">' + files.slice(0, 12).map(f => esc(f.ref) + ' ' + esc(f.agent)).join(' · ') + (files.length > 12 ? ' …' : '') + '</p>' : '') +
          UI.field('Hand it all to', '<select class="in" name="to">' + UI.options([['', '— choose —']].concat(takers.map(x => [x.id, x.name + ' — ' + (RU.ROLES[x.role] || x.role)])), '') + '</select>') +
          UI.field('A handover note', '<textarea class="in" name="note" placeholder="What they need to know — where things stand, who to call"></textarea>', 'It goes on each file, and to them by email.') : '<p class="mini">They have no open files or tasks.</p>') +
        '<div class="err" data-err></div>',
      foot: '<button class="btn" data-x>Cancel</button><button class="btn dngr" data-ok>' + esc(p.name.split(' ')[0]) + ' has left — sign them out now</button>',
      on: (el, close) => el.querySelector('[data-ok]').addEventListener('click', async () => {
        const v = n => { const e = el.querySelector('[name=' + n + ']'); return e ? e.value.trim() : ''; };
        try {
          const r = await JOR.call('people.leave', { id: p.id, to: v('to'), note: v('note') });
          close();
          UI.toast(p.name + ' is signed out everywhere' + (r.files || r.tasks ? '; ' + r.files + ' file' + (r.files === 1 ? '' : 's') + ' and ' + r.tasks + ' task' + (r.tasks === 1 ? '' : 's') + ' handed over' : '') + '.', 6000);
          people();
        } catch (e) { el.querySelector('[data-err]').textContent = e.message; }
      })
    });
  }
  /* The computers and phones someone has signed in on: forget one, or sign them out of everything. */
  async function devices(p) {
    let r;
    try { r = await JOR.call('people.devices', { id: p.id }); } catch (e) { UI.toast(e.message, 5000); return; }
    UI.dialog({
      title: p.name + ' — computers and phones',
      body: (r.devices.length ? '<table class="t"><tbody>' + r.devices.map(d => '<tr><td><b>' + esc(d.label) + '</b><div class="mini">since ' + esc(UI.nice(d.created.slice(0, 10), true)) + ' · ' + esc(d.by) + '</div></td>' +
        '<td class="mini nw">last used ' + esc(UI.when(d.lastSeen)) + '</td><td><button class="btn sm" data-forget="' + esc(d.id) + '">Forget</button></td></tr>').join('') + '</tbody></table>' : '<p class="mini">No computers remembered.</p>') +
        '<p class="mini">' + r.sessions + ' sign-in' + (r.sessions === 1 ? '' : 's') + ' open now. A lost phone, or a password someone may have seen: sign them out everywhere — they’ll need their password and an emailed code again.</p>',
      foot: '<button class="btn" data-x>Close</button><button class="btn dngr" data-out>Sign them out everywhere</button>',
      on: (el, close) => {
        el.querySelectorAll('[data-forget]').forEach(b => b.addEventListener('click', async () => {
          try { await JOR.call('people.forget', { device: b.dataset.forget }); b.closest('tr').remove(); } catch (e) { UI.toast(e.message, 5000); }
        }));
        el.querySelector('[data-out]').addEventListener('click', async () => {
          try { const x = await JOR.call('people.signout', { id: p.id }); close(); UI.toast(p.name + ': ' + x.sessions + ' sign-in' + (x.sessions === 1 ? '' : 's') + ' ended, ' + x.devices + ' computer' + (x.devices === 1 ? '' : 's') + ' forgotten.'); people(); }
          catch (e) { UI.toast(e.message, 5000); }
        });
      }
    });
  }

  function personForm(p) {
    p = p || {};
    UI.dialog({
      title: p.id ? 'Edit ' + p.name : 'Add a person',
      body: '<div class="g2">' + UI.field('Name', '<input class="in" name="name" value="' + esc(p.name || '') + '" data-focus>') +
        UI.field('Work email', '<input class="in" name="email" type="email" value="' + esc(p.email || '') + '">', 'They sign in with this.') + '</div>' +
        '<div class="g3">' + UI.field('Role', '<select class="in" name="role">' + UI.options([['', '—']].concat(Object.keys(RU.ROLES).map(k => [k, RU.ROLES[k]])), p.role || '') + '</select>') +
        UI.field('Team', '<input class="in" name="team" value="' + esc(p.team || '') + '" placeholder="e.g. Groups & MICE">') +
        UI.field('Initials', '<input class="in" name="initials" maxlength="4" value="' + esc(p.initials || '') + '" placeholder="from the name">') + '</div>' +
        UI.field('Phone', '<input class="in" name="phone" value="' + esc(p.phone || '') + '" placeholder="shown to guides when this person is their contact">') +
        '<label class="chk"><input type="checkbox" name="admin"' + (p.admin === 'yes' ? ' checked' : '') + '> Admin — can add people and reset logins</label>' +
        (me.owner === 'yes' ? '<label class="chk"><input type="checkbox" name="finance"' + (p.finance === 'yes' ? ' checked' : '') + '> Sees the finance dashboard — every figure in the business (management only)</label>' +
          '<label class="chk"><input type="checkbox" name="owner"' + (p.owner === 'yes' ? ' checked' : '') + '> Owner — the only people who can give the finance dashboard, make another owner, take everything out as a workbook, or change an owner’s login</label>'
          : '<p class="mini" style="margin:8px 0 0">Who sees the finance dashboard, and who is an owner, is for an owner to say.</p>') +
        '<div class="mini" style="margin:8px 0 4px">What each role can do: ' + roleHelp() + '</div><div class="err" data-err></div>',
      foot: '<button class="btn" data-x>Cancel</button><button class="btn p" data-ok>' + (p.id ? 'Save' : 'Add them') + '</button>',
      on: (el, close) => el.querySelector('[data-ok]').addEventListener('click', async () => {
        const v = n => el.querySelector('[name=' + n + ']').value.trim();
        try {
          const r = await JOR.call('people.save', { person: { id: p.id, name: v('name'), email: v('email'), role: v('role'), team: v('team'), initials: v('initials'), phone: v('phone'), admin: el.querySelector('[name=admin]').checked ? 'yes' : '', finance: (el.querySelector('[name=finance]') || {}).checked ? 'yes' : '', owner: (el.querySelector('[name=owner]') || {}).checked ? 'yes' : '' } });
          close();
          if (r.code) showCode(Object.assign({ email: v('email') }, r.person), r.code); else UI.toast('Saved.');
          people();
        } catch (e) { el.querySelector('[data-err]').textContent = e.message; }
      })
    });
  }
  /* What each role sees, in plain words — the money first, since it is need-to-know. */
  const ROLE_HELP = {
    management: 'everything, on every file — all the money, the dashboard and the log',
    account: 'their own files, and those of anyone they cover: the costings with margins, invoices to raise, bills to check — no one else’s figures',
    reservations: 'requests, the pink sheet, bookings and rates, what cancelling would cost — no selling prices, margins or client invoices',
    accounts: 'every invoice to clients and every supplier’s bill — no costings or margins',
    operations: 'files, bookings and guide files — no invoices, bills or costings',
    marketing: 'the register, agents and contacts, the mailing list — no money'
  };
  function roleHelp() {
    return Object.keys(RU.ROLES).map(r => '<b>' + esc(RU.ROLES[r]) + '</b>: ' + esc(ROLE_HELP[r] || '')).join('<br>');
  }

  /* The starting code, shown once. */
  function showCode(p, code) {
    const msg = 'Hi ' + p.name.split(' ')[0] + ', you now have a JORIS login. Go to ' + JOR.ROOT + ' and sign in with ' + (p.email || 'your work email') +
      ' and this starting code: ' + code + ' — then choose your own password. The code works for 7 days.';
    UI.dialog({
      title: 'Starting code for ' + p.name,
      body: '<div class="code-big">' + esc(code) + '</div><p>Give this to ' + esc(p.name.split(' ')[0]) + ' yourself — in person, or by Teams or phone. It works once, for 7 days. It isn’t shown again; if it’s lost, make a new one.</p>',
      foot: '<button class="btn" data-copy>' + I('copy', 'sm') + 'Copy a message with it</button><button class="btn p" data-x>Done</button>',
      on: el => el.querySelector('[data-copy]').addEventListener('click', async () => { try { await navigator.clipboard.writeText(msg); UI.toast('Copied.'); } catch (e) { UI.toast('Copy it from the box.'); } })
    });
  }
  $('#add').addEventListener('click', () => personForm());

  /* ══ Reference numbers ══════════════════════════════════════════════ */
  async function numbers(o) {
    let r;
    try { r = await seenOr('numbers', 'numbers.list', null, o, numbers); } catch (e) { $('#view').innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; return; }
    if (view !== 'numbers') return;
    $('#view').innerHTML = '<div class="card pad"><p class="mini" style="margin-top:0">Each travel year has its own run of numbers. To carry on from the quotes window, set the next number for that year — it can’t go below one already used.</p>' +
      '<table class="t"><thead><tr><th>Travel year</th><th>Last used</th><th>Next</th><th></th></tr></thead><tbody>' +
      r.years.map(y => '<tr><td><b>20' + esc(y.year) + '</b></td><td>' + (y.used ? esc(RU.ref(y.year, y.used)) : '—') + '</td><td class="ref">' + esc(RU.ref(y.year, y.next)) + '</td>' +
        '<td><button class="btn sm" data-year="' + esc(y.year) + '" data-next="' + y.next + '">Change</button></td></tr>').join('') +
      '</tbody></table><div class="bar" style="margin-top:12px"><button class="btn" id="ny">Set a year</button></div></div>';
    const set = (year, next) => UI.dialog({
      title: 'Next reference number',
      body: '<div class="g2">' + UI.field('Travel year', '<input class="in" name="y" maxlength="2" placeholder="27" value="' + esc(year || '') + '" data-focus>') +
        UI.field('Next number', '<input class="in" name="n" type="number" value="' + esc(next || '') + '">') + '</div><div class="err" data-err></div>',
      foot: '<button class="btn" data-x>Cancel</button><button class="btn p" data-ok>Save</button>',
      on: (el, close) => el.querySelector('[data-ok]').addEventListener('click', async () => {
        try { await JOR.call('numbers.set', { year: el.querySelector('[name=y]').value, next: el.querySelector('[name=n]').value }); close(); UI.toast('Saved.'); numbers(); }
        catch (e) { el.querySelector('[data-err]').textContent = e.message; }
      })
    });
    $('#view').querySelectorAll('[data-year]').forEach(b => b.addEventListener('click', () => set(b.dataset.year, b.dataset.next)));
    $('#ny').addEventListener('click', () => set('', ''));
  }

  /* ══ Who changed what ═══════════════════════════════════════════════ */
  let logRef = '';
  async function log(o) {
    let r;
    try { r = await seenOr('log', 'audit.list', logRef ? { ref: logRef, limit: 500 } : { limit: 500 }, o, log); } catch (e) { $('#view').innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; return; }
    if (view !== 'log') return;
    $('#view').innerHTML = '<div class="bar"><input class="in" id="lr" placeholder="A file reference, e.g. 27/1001" value="' + esc(logRef) + '"><button class="btn" id="lg">Show</button>' +
      (logRef ? '<button class="btn ghost" id="lc">Everything</button>' : '') + '</div><div class="card tw"><table class="t"><thead><tr><th>When</th><th>Who</th><th>What</th><th>File</th><th>Detail</th></tr></thead><tbody>' +
      r.log.map(x => '<tr><td class="nw">' + esc(UI.when(x.when)) + '</td><td class="nw">' + esc(x.who) + '</td><td class="nw">' + esc(x.what) + '</td><td class="nw">' + esc(x.ref) + '</td><td>' + esc(x.detail) + '</td></tr>').join('') +
      '</tbody></table></div>';
    $('#lg').addEventListener('click', () => { logRef = $('#lr').value.trim(); log(); });
    $('#lr').addEventListener('keydown', e => { if (e.key === 'Enter') $('#lg').click(); });
    const lc = $('#lc'); if (lc) lc.addEventListener('click', () => { logRef = ''; log(); });
  }

  /* ══ The bin: what was removed, to put back ═══════════════════════════ */
  async function bin(o) {
    let r;
    try { r = await seenOr('bin', 'bin.list', null, o, bin); } catch (e) { $('#view').innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; return; }
    if (view !== 'bin') return;
    $('#view').innerHTML = '<p class="mini" style="margin:0 0 10px">Rates, flights, document links and guide-file documents that were removed. Nothing here is gone for good: put it back and it is where it was.</p>' +
      '<div class="card tw">' + (r.bin.length ? '<table class="t"><thead><tr><th>Removed</th><th>By</th><th>What</th><th>File</th><th></th></tr></thead><tbody>' +
      r.bin.map(x => '<tr><td class="nw">' + esc(UI.when(x.at)) + '</td><td class="nw">' + esc(x.by) + '</td><td><b>' + esc(x.kind) + '</b> ' + esc(x.what) + '</td><td class="nw">' + esc(x.ref) + '</td><td class="nw">' +
        (x.restored ? '<span class="mini">Put back by ' + esc(x.restored) + ', ' + esc(UI.when(x.restoredAt)) + '</span>' : '<button class="btn sm" data-restore="' + esc(x.id) + '">Put it back</button>') + '</td></tr>').join('') +
      '</tbody></table>' : '<div class="empty">The bin is empty.</div>') + '</div>';
    $('#view').querySelectorAll('[data-restore]').forEach(b => b.addEventListener('click', async () => {
      try { await JOR.call('bin.restore', { id: b.dataset.restore }); UI.toast('Put back.'); bin(); } catch (e) { UI.toast(e.message, 5000); }
    }));
  }

  /* ══ Settings ═══════════════════════════════════════════════════════ */
  async function settings(o) {
    let r;
    try { r = await seenOr('settings', 'settings.get', null, o, settings); } catch (e) { $('#view').innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; return; }
    if (view !== 'settings') return;
    typing = false;
    const ppl = r.people;
    const input = (k, d, val) => d.kind === 'person' ? '<select class="in" name="' + k + '">' + UI.options([['', d.blank || (d.dflt === '' ? '— worked out (the only one in that role, or whoever assigns files)' : '—')]].concat(ppl.map(p => [p.id, p.name + ' — ' + (RU.ROLES[p.role] || p.role)])), val) + '</select>'
      : d.kind === 'onoff' ? '<select class="in" name="' + k + '">' + UI.options([['on', 'On'], ['off', 'Off']], val) + '</select>'
        : d.kind === 'dates' ? '<input class="in" name="' + k + '" value="' + esc(val) + '" placeholder="24/12/2026–01/01/2027, 02/04/2027">'
        : d.kind === 'codes' ? '<textarea class="in" name="' + k + '" rows="5" placeholder="X1 = Price&#10;X2 = Went with another company&#10;X3 = Postponed">' + esc(val) + '</textarea>'
          : '<input class="in" name="' + k + '" value="' + esc(val) + '"' + (d.kind === 'time' ? ' type="time"' : d.kind === 'url' ? ' type="url" placeholder="https://joris-system.github.io/"' : ' type="number" min="0"') + '>';
    /* The office's own days off sit on a line of their own, with what is already counted */
    const one = k => r.defs[k].kind === 'dates'
      ? '<div style="grid-column:1/-1">' + UI.field(r.defs[k].t, input(k, r.defs[k], r.settings[k]), 'Bank holidays are in already — all ten, with a day in lieu when one falls at a weekend. Add the office’s own, like Christmas week. Follow-ups, chases and payment dates skip them.') + '</div>'
      : r.defs[k].kind === 'codes' ? '<div style="grid-column:1/-1">' + UI.field(r.defs[k].t, input(k, r.defs[k], r.settings[k]), 'The codes from the RFP window’s Cancelled tabs (Iain’s list). Each is offered when a file is marked lost or cancelled, and named on the finance dashboard. “(old)” keeps a code for the history but out of that list.') + '</div>'
      : UI.field(r.defs[k].t, input(k, r.defs[k], r.settings[k]));
    const groups = [['Who gets the work', ['assigner', 'resLead', 'accountsLead', 'payablesLead', 'marketingLead', 'opsLead', 'complaintsLead', 'signoff', 'priceCheck']], ['Money', ['depositPayDays', 'finalDays']],
      ['Price checks', ['marginLow', 'marginHigh', 'similarPct', 'ratePct', 'billPct']], ['Following up', ['chaseDays', 'chaseMax']],
      ['Lost files', ['lostCodes']], ['Signing in', ['deviceCheck', 'deviceDays']],
      ['The office', ['open', 'close', 'firstNumber', 'ratesMonth', 'closed']], ['Emails and Ask JORIS', ['emails', 'reminders', 'siteUrl', 'askJoris']]];
    $('#view').innerHTML = '<div class="card pad">' + groups.map(g => '<h3>' + esc(g[0]) + '</h3><div class="g3">' + g[1].map(one).join('') + '</div>').join('') +
      '<p class="mini">Work never goes to a shared list: it goes to the person named here, and when they are off, to whoever covers them.</p><div class="acts"><button class="btn p" id="ss">Save</button></div><div class="err" id="se"></div></div>' +
      (me.perms['door.manage'] ? '<div class="card pad" style="margin-top:14px" id="doorcard"></div>' : '');
    if (me.perms['door.manage']) doorCard();
    $('#ss').addEventListener('click', async () => {
      const out = {};
      $('#view').querySelectorAll('[name]').forEach(i => { out[i.name] = i.value.trim(); });
      try { await JOR.call('settings.save', { settings: out }); UI.toast('Saved.'); settings(); } catch (e) { $('#se').textContent = e.message; }
    });
  }

  /* The door code: the one code every computer and phone gives, once, before it is shown the sign-in page. An owner's to set. */
  async function doorCard() {
    const el = $('#doorcard');
    if (!el) return;
    let d;
    try { d = await JOR.call('door.get'); } catch (e) { el.innerHTML = '<h3>' + I('lock', 'sm') + 'The door code</h3><p class="mini">' + esc(e.message) + '</p>'; return; }
    el.innerHTML = '<h3>' + I('lock', 'sm') + 'The door code</h3>' +
      '<p class="mini" style="margin:0 0 10px">One code for all of JOR. A computer or phone is asked for it once, before it is shown the sign-in page; until then the page is blank, with a box at the bottom to type it in. ' +
      'It keeps strangers and bots away from the sign-in: without it nobody can even try a password. Give it to people along with their starting code. Changing it asks every computer again, once.</p>' +
      (d.on ? '<div class="okbox">A door code is set.</div>' : '<div class="warnbox">No door code is set: the sign-in page shows to anyone who opens the link.</div>') +
      '<div class="g2" style="margin-top:10px">' + UI.field(d.on ? 'A new door code' : 'The door code', '<input class="in" id="dc" autocomplete="off" spellcheck="false">', 'At least 6 characters. Capitals and spaces don’t matter.') + '</div>' +
      '<div class="acts"><button class="btn p" id="dset">' + (d.on ? 'Change the door code' : 'Set the door code') + '</button>' + (d.on ? '<button class="btn dngr" id="doff">Take the door away</button>' : '') + '</div><div class="err" id="de"></div>';
    const save = async code => {
      $('#de').textContent = '';
      try {
        const r = await JOR.call('door.set', { code: code });
        if (JOR.door) JOR.door.keep(r.key);                 // this computer carries on without being asked
        UI.toast(r.on ? 'Set. Every other computer and phone is asked for it once.' : 'The door is gone.', 5000);
        doorCard();
      } catch (e) { $('#de').textContent = e.message; }
    };
    $('#dset').addEventListener('click', () => { const v = $('#dc').value.trim(); if (!v) { $('#de').textContent = 'Type the door code first.'; return; } save(v); });
    const off = $('#doff');
    if (off) off.addEventListener('click', async () => { if (await UI.confirm('Take the door away?', 'The sign-in page will show to anyone who opens the link. Signing in still needs a password, and a code by email on a new computer.', 'Take it away', true)) save(''); });
  }

  /* ══ JOR's history: the RFP window, the OPS file, the quotes window ══
     Each read here, the right tabs sent; the server says what will come in
     — by season, the initials to match to people, the deposits, what can't
     be placed — and nothing is written until "Bring them in". */
  const hist = { rfp: null, ops: null, quotes: null, names: {}, who: {}, r: null };
  const HK = window.JOR_HISTORY;
  /* Only the tabs that matter, each row in its place (row numbers stay right) but with its empty cells cut off. */
  const slim = (tabs, kind) => tabs.filter(t => kind === 'rfp' ? /quote live board|^follow ?up|^confirmed\s*\d{4}|^cancell?ed\s*\d{4}/i.test(String(t.name).trim()) : kind === 'quotes' ? !/summary/i.test(String(t.name)) : /^\d{4}$/.test(String(t.name).trim()))
    .map(t => ({ name: t.name, rows: t.rows.map(r => { const x = (r || []).slice(); while (x.length && (x[x.length - 1] === '' || x[x.length - 1] === null || x[x.length - 1] === undefined)) x.pop(); return x; }) }));
  function historyView() {
    $('#view').innerHTML = '<div class="card pad"><h3>' + I('upload', 'sm') + 'The RFP window, the OPS file and the quotes window</h3>' +
      '<p class="mini" style="margin:0 0 12px">JOR’s own history, as it has been kept: every quote, every group, every season. Choose any of them — the preview says what will come in before anything is written. ' +
      'Old work is closed off as it comes in: a group already home is closed, and a quote whose travel dates have passed without a yes counts as lost. Bringing them in again later brings up to date whatever hasn’t been touched in JORIS since.</p>' +
      '<div class="g3">' + UI.field('The RFP window', '<input class="in" type="file" id="hr" accept=".xlsx,.xlsm">', hist.names.rfp ? '✓ ' + esc(hist.names.rfp) : 'Quote Live Board, Follow up, Confirmed and Cancelled tabs.') +
      UI.field('The OPS file', '<input class="in" type="file" id="ho" accept=".xlsx,.xlsm">', hist.names.ops ? '✓ ' + esc(hist.names.ops) : 'A tab for each season: 2024, 2025, 2026…') +
      UI.field('The quotes window', '<input class="in" type="file" id="hq" accept=".xlsx,.xlsm">', hist.names.quotes ? '✓ ' + esc(hist.names.quotes) : 'Jess’s register: a tab for each month. One a year — bring each in.') + '</div><div id="hp"></div></div>';
    ['hr', 'ho', 'hq'].forEach(id => $('#' + id).addEventListener('change', async e => {
      const f = e.target.files[0];
      if (!f) return;
      $('#hp').innerHTML = '<div class="empty">Reading ' + esc(f.name) + '…</div>';
      try {
        const tabs = await SHEET.read(f), kind = HK.kind(tabs);
        if (!kind) throw new Error(f.name + ' isn’t the RFP window, the OPS file or the quotes window — none of them has the tabs they keep.');
        hist[kind] = slim(tabs, kind); hist.names[kind] = f.name; hist.r = null;
        historyView(); historyPreview();
      } catch (x) { $('#hp').innerHTML = '<div class="errbox">' + esc(x.message) + '</div>'; }
    }));
    if (hist.r) paintHistory();
  }
  async function historyPreview() {
    $('#hp').innerHTML = '<div class="empty">Reading every row, matching it to JORIS…</div>';
    try { hist.r = await JOR.call('history.preview', { rfp: hist.rfp, ops: hist.ops, quotes: hist.quotes, who: hist.who }); }
    catch (e) { $('#hp').innerHTML = '<div class="errbox">' + esc(e.message) + '</div>'; return; }
    hist.r.initials.forEach(x => { if (hist.who[x.code] === undefined) hist.who[x.code] = x.person || ''; });
    paintHistory();
  }
  async function paintHistory() {
    const r = hist.r, c = r.counts, st = c.byStatus;
    let ppl = [];
    try { ppl = (await JOR.call('people.list')).people.filter(p => p.status === 'active'); } catch (e) { /* the list of names is a nicety */ }
    const seasons = Object.keys(c.bySeason).sort(), order = ['enquiry', 'quoted', 'confirmed', 'closed', 'lost', 'cancelled'];
    const tile = (k, v, s, cls) => '<div class="tile ' + (cls || '') + '"><div class="k">' + esc(k) + '</div><div class="v">' + v + '</div>' + (s ? '<div class="s">' + s + '</div>' : '') + '</div>';
    let h = '<div class="tiles" style="margin-top:14px">' + tile('Files', c.add + c.fresh, c.add + ' new' + (c.fresh ? ', ' + c.fresh + ' brought up to date' : '')) +
      tile('Groups to come', c.live, 'confirmed, not home yet') + tile('Quotes out', (st.quoted || 0) + (st.enquiry || 0), (st.quoted || 0) + ' quoted · ' + (st.enquiry || 0) + ' enquiries') +
      tile('Closed and lost', (st.closed || 0) + (st.lost || 0) + (st.cancelled || 0), (st.closed || 0) + ' closed · ' + (st.lost || 0) + ' lost · ' + (st.cancelled || 0) + ' cancelled') +
      (c.keep ? tile('Left as they are', c.keep, 'already in JORIS', 'warn') : '') + '</div>';
    h += '<h3 style="margin-top:16px">By season</h3><div class="tw"><table class="t"><thead><tr><th>Season</th>' + order.map(s => '<th class="num">' + esc(RU.STATUS[s].t) + '</th>').join('') + '<th class="num">All</th></tr></thead><tbody>' +
      seasons.map(s => '<tr><td><b>' + esc(s) + '</b></td>' + order.map(k => '<td class="num">' + (c.bySeason[s][k] || '') + '</td>').join('') + '<td class="num"><b>' + order.reduce((a, k) => a + (c.bySeason[s][k] || 0), 0) + '</b></td></tr>').join('') + '</tbody></table></div>';
    /* Initials to people: the one thing only someone at JOR can say. */
    h += '<h3 style="margin-top:16px">Who the initials are</h3><p class="mini" style="margin:0 0 8px">Each file goes to the person its initials belong to. Someone who has left: choose “nobody” — their old files keep the initials in their notes, and anything still open goes to whoever assigns files.</p>' +
      '<div class="tw"><table class="t"><thead><tr><th>Initials</th><th class="num">Files</th><th class="num">Still open</th><th>Person</th></tr></thead><tbody>' +
      r.initials.map(x => '<tr><td><b>' + esc(x.code) + '</b></td><td class="num">' + x.n + '</td><td class="num">' + (x.live || '') + '</td><td><select class="in" data-who="' + esc(x.code) + '">' +
        UI.options([['', '— nobody (left, or not sure)']].concat(ppl.map(p => [p.id, p.name + (p.initials ? ' (' + p.initials + ')' : '')])), hist.who[x.code] || '') + '</select></td></tr>').join('') + '</tbody></table></div>';
    /* Deposits: each file's own terms — the date is set on the file, not here. */
    const dp = r.deposit;
    if (dp.open) h += '<h3 style="margin-top:16px">Deposits not invoiced yet</h3><p class="mini" style="margin:0 0 8px">' + dp.open + ' group' + (dp.open === 1 ? '' : 's') + ' to come have no deposit invoice on the OPS file. Each file has its own deposit terms, so ' +
      (dp.agentDays ? dp.agentDays + ' take their agent’s “days before arrival” and ' : '') + (dp.toSet ? dp.toSet + ' come in without a date: the account manager is asked to set it on step 9 of the file' : 'none need a date set') + '. Groups arriving within 35 days get no deposit line — the final payment covers them.</p>';
    /* What the old sheets can't say. */
    const notes = [];
    if (r.lostCodes.length) notes.push('<b>Lost files keep their X-codes</b> — ' + r.lostCodes.map(x => esc(x.code) + ' ×' + x.n + (x.meaning ? ' (' + esc(x.meaning) + ')' : '')).join(', ') + (r.lostNoCode ? ', and ' + r.lostNoCode + ' with no code' : '') + '. ' +
      (r.lostCodes.some(x => !x.meaning) ? 'Say what each code means in Settings › Lost files, and the dashboard names them.' : ''));
    if (r.followUps.set || r.followUps.none) notes.push('<b>Proposals still out</b> keep the follow-up date the RFP window had (' + r.followUps.set + (r.followUps.overdue ? ', ' + r.followUps.overdue + ' of them overdue' : '') + ')' + (r.followUps.none ? '; the ' + r.followUps.none + ' with none are to follow up tomorrow' : '') + '.');
    if (r.quotesOnly && r.quotesOnly.n) notes.push('<b>' + r.quotesOnly.n + ' request' + (r.quotesOnly.n === 1 ? ' is' : 's are') + ' only on the quotes window</b> — not on the RFP window or the OPS file, so how ' + (r.quotesOnly.n === 1 ? 'it' : 'each') + ' went isn’t written anywhere: ' +
      r.quotesOnly.open + ' come in as open requests for their account managers to update' + (r.quotesOnly.lost ? ', and ' + r.quotesOnly.lost + ' whose travel dates have passed as lost' : '') + '.');
    if (r.series.length) notes.push('<b>Series departures stay out</b> — rows on the OPS file with a tour name but no reference: ' + r.series.map(x => x.season + ': ' + x.departures + ' departure' + (x.departures === 1 ? '' : 's') + ' of ' + x.series + ' series').join(', ') + '. Each departure has a number of its own: give each one its reference on the OPS file and bring it in again. New series are registered in one go on the register (“Departures in the series”).');
    notes.push('<b>No amounts</b> are on any of them, so invoiced and paid come in as ticks without figures; accounts put the amount in when the money arrives.');
    h += '<h3 style="margin-top:16px">Good to know</h3><ul class="mini" style="margin:0 0 6px 18px;line-height:1.6">' + notes.map(n => '<li>' + n + '</li>').join('') + '</ul>';
    if (r.problems.length) h += '<details style="margin-top:10px"><summary class="mini"><b>' + r.problems.length + ' row' + (r.problems.length === 1 ? '' : 's') + ' left out</b> — no reference on the line</summary><div class="tw"><table class="t"><thead><tr><th>Tab</th><th class="num">Row</th><th>Why</th></tr></thead><tbody>' +
      r.problems.map(p => '<tr><td>' + esc(p.tab) + '</td><td class="num">' + p.row + '</td><td>' + esc(p.why) + '</td></tr>').join('') + '</tbody></table></div></details>';
    if (c.other) h += '<p class="mini">' + c.other + ' already came in from ' + (c.other === 1 ? 'a workbook' : 'workbooks') + ' not chosen this time, so they are left as they are — choose all of them together to bring those up to date.</p>';
    if (r.keep.length) h += '<p class="mini">Already in JORIS and changed there, so left as they are: ' + r.keep.map(esc).join(', ') + (c.keep > r.keep.length ? '…' : '') + '</p>';
    h += '<div class="acts"><button class="btn p" id="hrun"' + (c.add + c.fresh ? '' : ' disabled') + '>Bring in ' + (c.add + c.fresh).toLocaleString('en-IE') + ' files</button></div><div class="err" id="he"></div>';
    $('#hp').innerHTML = h;
    $('#hp').querySelectorAll('[data-who]').forEach(s => s.addEventListener('change', () => { hist.who[s.dataset.who] = s.value; }));
    $('#hrun').addEventListener('click', async () => {
      const ok = await UI.confirm('Bring in JOR’s history?', (c.add + c.fresh).toLocaleString('en-IE') + ' files, with their notes, follow-ups and the money ticks of the groups to come. It takes a minute; best done when the office is quiet. It goes in the log.', 'Bring them in');
      if (!ok) return;
      $('#hrun').disabled = true; $('#hrun').textContent = 'Bringing them in…';
      try {
        const x = await JOR.call('history.run', { rfp: hist.rfp, ops: hist.ops, quotes: hist.quotes, who: hist.who, label: [hist.names.rfp, hist.names.ops, hist.names.quotes].filter(Boolean).join(' + ') });
        $('#hp').innerHTML = '<div class="okbox" style="margin-top:14px"><b>Done.</b> ' + x.added + ' files added, ' + x.refreshed + ' brought up to date, ' + x.kept + ' left as they were; ' + x.notes + ' notes and follow-ups, ' +
          x.payments + ' payment lines, ' + x.agents + ' agents. It is in the log. <a href="../finance/">See the dashboard</a> · <a href="../register/">the register</a></div>';
        hist.r = null;
      } catch (e) { $('#he').textContent = e.message; $('#hrun').disabled = false; $('#hrun').textContent = 'Bring them in'; }
    });
  }

  /* ══ Bringing JOR's spreadsheets in ═════════════════════════════════
     The page reads the file; the server tidies every row and says what
     will go in and what won't, before anything is written. */
  const KINDS = {
    files: { t: 'RFPs — the quotes window or the RFP board', help: 'Reference, date in, client, contact, email, country, pax, dates, status, account manager, last comment.' },
    people: { t: 'People — the staff list', help: 'Name, work email, job title or role, team, and who has left. New people get a starting code each.' },
    suppliers: { t: 'Suppliers — hotels, visits, restaurants, coaches', help: 'Name, kind, town, county, stars, contact, email, phone.' },
    rates: { t: 'Rates — a supplier’s rates for a year', help: 'Supplier, year, what, how it is charged, the price, the single supplement. JOR’s agreed rates card (coach, guide, lunches & dinners) is read as it is.' },
    contacts: { t: 'Contacts — HubSpot or a mailing list', help: 'Name, email, company, country, and whether they agreed to mailings.' }
  };
  const FIELD_NAMES = { ref: 'Reference', agent: 'Agent / client', contact: 'Contact', contactEmail: 'Contact’s email', country: 'Country', source: 'Came in by', newClient: 'New client?', type: 'Type', pax: 'People',
    arrival: 'Arrival', departure: 'Departure', received: 'Came in on', status: 'Status', am: 'Account manager', budget: 'Budget', notes: 'Last comment', name: 'Name', town: 'Town', county: 'County', star: 'Stars',
    email: 'Email', phone: 'Phone', supplier: 'Supplier', year: 'Year', label: 'What', unit: 'Charged', amount: 'Price', single: 'Single supplement', validFrom: 'Valid from', validTo: 'Valid to',
    first: 'First name', last: 'Last name', role: 'Role / job title', team: 'Team', initials: 'Initials', left: 'Left / active', consent: 'Agreed to mailings', unsubscribed: 'Unsubscribed', tags: 'Tags' };
  const imp = { kind: 'files', tabs: null, tab: 0, map: null, opts: {}, name: '' };
  function importer() {
    $('#view').innerHTML = '<div class="card pad"><h3>' + I('upload', 'sm') + 'Bring in a spreadsheet</h3><div class="g2">' + UI.field('What is in it', '<select class="in" id="ik">' + UI.options(Object.keys(KINDS).map(k => [k, KINDS[k].t]), imp.kind) + '</select>', esc(KINDS[imp.kind].help)) +
      UI.field('The file', '<input class="in" type="file" id="if" accept=".xlsx,.xlsm,.csv,.txt,.xls">', 'An Excel .xlsx or a .csv. An old .xls: open it in Excel and Save As .xlsx first.') + '</div>' +
      '<div id="iopts"></div><div id="ip"></div></div>';
    $('#ik').addEventListener('change', e => { imp.kind = e.target.value; imp.map = null; importer(); if (imp.tabs) preview(); });
    $('#if').addEventListener('change', async e => {
      const f = e.target.files[0];
      if (!f) return;
      try { imp.tabs = await SHEET.read(f); imp.name = f.name; imp.tab = 0; imp.map = null; preview(); } catch (x) { $('#ip').innerHTML = '<div class="errbox">' + esc(x.message) + '</div>'; }
    });
    paintOpts();
  }
  function paintOpts() {
    const o = imp.opts, k = imp.kind;
    $('#iopts').innerHTML = k === 'rates' ? '<div class="g3">' + UI.field('Year, if the sheet doesn’t say', '<input class="in" data-o="year" value="' + esc(o.year || String(+UI.D.today().slice(0, 4) + 1)) + '">') +
      UI.field('New suppliers are', '<select class="in" data-o="type">' + UI.options([['', 'as the sheet says']].concat(Object.keys(RU.SUPPLIERS).map(x => [x, RU.SUPPLIERS[x]])), o.type || '') + '</select>') +
      UI.field('Where it came from', '<input class="in" data-o="source" value="' + esc(o.source || '') + '" placeholder="e.g. Rates 27 › Visits › Galway">') + '</div>'
      : k === 'suppliers' ? '<div class="g3">' + UI.field('If the sheet doesn’t say what kind', '<select class="in" data-o="type">' + UI.options([['', '—']].concat(Object.keys(RU.SUPPLIERS).map(x => [x, RU.SUPPLIERS[x]])), o.type || '') + '</select>') + '</div>'
        : k === 'contacts' ? UI.field('How the ones marked as agreeing agreed', '<input class="in" data-o="consentHow" value="' + esc(o.consentHow || '') + '" placeholder="e.g. HubSpot marketing contacts, exported Oct 2026">', 'Without this, nobody goes in as agreeing — the law asks for when and how.')
          : k === 'people' ? '<div class="g3">' + UI.field('If the job title doesn’t say', '<select class="in" data-o="role">' + UI.options([['', '— leave them out']].concat(Object.keys(RU.ROLES).map(x => [x, RU.ROLES[x]])), o.role || '') + '</select>') + '</div>' : '';
    $('#iopts').querySelectorAll('[data-o]').forEach(i => i.addEventListener('change', () => { imp.opts[i.dataset.o] = i.value.trim(); if (imp.tabs) preview(); }));
  }
  async function preview() {
    const tab = imp.tabs[imp.tab];
    /* JOR's agreed rates card (coach, guide, lunches and dinners, a block per year): read as a plain rates table. */
    const card = imp.kind === 'rates' ? HK.rateCard(tab.rows) : null;
    const rows = (card || tab.rows).filter(r => r && r.some(c => String(c === undefined || c === null ? '' : c).trim() !== ''));
    if (rows.length < 2) { $('#ip').innerHTML = '<div class="warnbox">That tab has nothing under its headings.</div>'; return; }
    $('#ip').innerHTML = '<div class="empty">Checking every row…</div>';
    let r;
    try { r = await JOR.call('import.preview', { kind: imp.kind, rows: rows, map: imp.map, opts: imp.opts }); } catch (e) { $('#ip').innerHTML = '<div class="errbox">' + esc(e.message) + '</div>'; return; }
    imp.map = r.map;
    const used = {};
    Object.keys(r.map).forEach(f => { used[r.map[f]] = f; });
    $('#ip').innerHTML = (card ? '<div class="okbox" style="margin-top:12px">JOR’s agreed rates card — read as ' + (rows.length - 1) + ' rates, ' + [...new Set(rows.slice(1).map(x => x[2]))].join(' and ') + '. Coach, guide and lunches go in under “… — JOR agreed rates”, each visit under its own name; the sale price in programmes goes with each.</div>' : '') +
      (imp.tabs.length > 1 ? UI.field('Tab', '<select class="in" id="it">' + UI.options(imp.tabs.map((t, i) => [i, t.name + ' — ' + t.rows.length + ' rows']), imp.tab) + '</select>') : '') +
      '<h3 style="margin-top:14px">Which column is which</h3><div class="tw"><table class="t map"><tbody>' + r.head.map((h, i) => '<tr><td><b>' + esc(h || '(no heading)') + '</b> <span class="mini">' + esc(String(rows[1][i] === undefined ? '' : rows[1][i]).slice(0, 40)) + '</span></td><td>' +
        '<select class="in" data-col="' + i + '">' + UI.options([['', '— not used']].concat(r.fields.map(f => [f, FIELD_NAMES[f] || f])), used[i] || '') + '</select></td></tr>').join('') + '</tbody></table></div>' +
      '<div class="tiles" style="margin-top:12px"><div class="tile"><div class="k">Rows</div><div class="v">' + r.counts.rows + '</div></div><div class="tile"><div class="k">Go in</div><div class="v">' + r.counts.ok + '</div><div class="s">' + r.counts.updates + ' update' + (r.counts.updates === 1 ? 's one' : 's ones') + ' already there</div></div>' +
      '<div class="tile ' + (r.counts.withProblems ? 'warn' : '') + '"><div class="k">Go in, with a note</div><div class="v">' + r.counts.withProblems + '</div></div><div class="tile ' + (r.counts.blocked ? 'err' : '') + '"><div class="k">Left out</div><div class="v">' + r.counts.blocked + '</div></div></div>' +
      '<div class="card tw"><table class="t"><thead><tr><th>Row</th><th>What goes in</th><th>Notes</th></tr></thead><tbody>' + r.rows.filter(x => x.problems.length || x.block).slice(0, 200).concat(r.rows.filter(x => !x.problems.length && !x.block).slice(0, 8)).map(x =>
        '<tr class="' + (x.block ? 'dim' : '') + '"><td>' + x.n + '</td><td class="mini">' + esc(Object.keys(x.v).filter(k => x.v[k] !== '' && x.v[k] !== undefined && k !== 'id' && k !== 'supplierId').map(k => (FIELD_NAMES[k] || k) + ': ' + x.v[k]).join(' · ').slice(0, 260)) + '</td>' +
        '<td>' + (x.block ? '<span class="pill err">left out</span> ' : x.update ? '<span class="pill quoted">update</span> ' : '') + x.problems.map(p => '<div class="prob">' + esc(p) + '</div>').join('') + '</td></tr>').join('') + '</tbody></table></div>' +
      '<div class="acts"><button class="btn p" id="irun"' + (r.counts.ok ? '' : ' disabled') + '>Bring in ' + r.counts.ok + ' row' + (r.counts.ok === 1 ? '' : 's') + '</button></div><div class="err" id="ie"></div>';
    const it = $('#it'); if (it) it.addEventListener('change', e => { imp.tab = +e.target.value; imp.map = null; preview(); });
    $('#ip').querySelectorAll('[data-col]').forEach(s => s.addEventListener('change', () => {
      const m = {};
      $('#ip').querySelectorAll('[data-col]').forEach(x => { if (x.value) m[x.value] = +x.dataset.col; });
      imp.map = m; preview();
    }));
    $('#irun').addEventListener('click', async () => {
      $('#irun').disabled = true;
      try {
        const x = await JOR.call('import.run', { kind: imp.kind, rows: rows, map: imp.map, opts: imp.opts, label: imp.name });
        $('#ip').innerHTML = '<div class="okbox"><b>Done.</b> ' + x.added + ' added, ' + x.updated + ' updated, ' + x.skipped + ' left out. It is in the log.</div>' +
          (x.codes && x.codes.length ? '<h3>Starting codes — give each person theirs yourself</h3><table class="t"><thead><tr><th>Name</th><th>Email</th><th>Starting code</th></tr></thead><tbody>' +
            x.codes.map(c => '<tr><td>' + esc(c.name) + '</td><td>' + esc(c.email) + '</td><td style="font-family:Consolas,monospace;font-weight:700">' + esc(c.code) + '</td></tr>').join('') + '</tbody></table>' +
            '<p class="mini">Good for 7 days, shown only now. They sign in at ' + esc(JOR.ROOT) + ' with their email and the code, then choose their own password.</p>' : '');
        imp.tabs = null; imp.map = null;
      } catch (e) { $('#ie').textContent = e.message; $('#irun').disabled = false; }
    });
  }

  /* ══ Export and backup ══════════════════════════════════════════════ */
  function exporter() {
    /* Every figure in the business is in it, so only an owner takes it out. */
    const may = !!me.perms['export.all'];
    $('#view').innerHTML = '<div class="card pad"><h3>' + I('down', 'sm') + 'Everything, as a workbook</h3><p>Every record — files, notes, bookings, payments, bills, costings, suppliers, rates, agents, contacts, people (without passwords), the log — a tab each. Keep a copy somewhere safe and private: every figure in the business is in it. It is also how the records would move to anything else.</p>' +
      (may ? '<div class="acts"><button class="btn p" id="xall">' + I('down', 'sm') + 'Download it</button></div><div class="mini" id="xn"></div>' : '<p class="mini">Only an owner can take it out.</p>') + '</div>' +
      '<div class="card pad" style="margin-top:14px"><h3>' + I('clock', 'sm') + 'The copy every evening</h3><p>The records sheet copies itself into a Backups folder on JOR’s Google Drive every evening at about eight. It keeps every night for 30 days, one a week for a year and one a month for seven years. It is switched on once, from the Apps Script editor: run <b>installNightlyBackup</b>. Share that folder, and the records sheet itself, with no one: the app doesn’t need anyone else to have them.</p></div>';
    if (!may) return;
    $('#xall').addEventListener('click', async () => {
      $('#xall').disabled = true;
      try {
        const r = await JOR.call('export.all');
        const tabs = Object.keys(r.tables).map(n => ({ name: n, rows: [r.tables[n].head].concat(r.tables[n].rows) }));
        UI.download('JORIS records ' + r.at.slice(0, 10) + '.xlsx', SHEET.write(tabs));
        $('#xn').textContent = tabs.map(t => t.name + ' ' + (t.rows.length - 1)).join(' · ');
      } catch (e) { UI.toast(e.message, 5000); }
      $('#xall').disabled = false;
    });
  }

  render();
})();
