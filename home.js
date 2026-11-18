/* JORIS — signing in, and the home page: the parts this person may use. */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = UI.esc, I = UI.icon, RU = window.JOR_RULES;
  const qs = new URLSearchParams(location.search);
  /* Only ever go on to a page inside this site. */
  const next = (qs.get('next') || '').replace(/^\/+/, '');
  const safeNext = /^[a-z][a-z0-9-]*\/(index\.html)?([?#].*)?$/i.test(next) ? next : '';
  let setupToken = '', pendingCode = '', keepWanted = false;

  document.querySelectorAll('img[data-logo]').forEach(i => { i.src = window.JOR_MARKS.logo; });

  function showGate(msg) {
    $('#app').classList.add('hidden'); $('#gate').classList.remove('hidden');
    $('#signin').classList.remove('hidden'); $('#choose').classList.add('hidden'); $('#codestep').classList.add('hidden');
    $('#err').textContent = msg || '';
    setTimeout(() => $('#email').focus(), 30);
  }

  function arrive(token, keep, who) {
    JOR.setToken(token, keep);
    if (who) JOR.keepMe(who);
    if (safeNext) { location.replace(JOR.ROOT + safeNext); return; }
    history.replaceState(null, '', location.pathname);
    home();
  }

  $('#go').addEventListener('click', async () => {
    const email = $('#email').value.trim(), pw = $('#pw').value;
    if (!email || !pw) { $('#err').textContent = 'Your email and password, please.'; return; }
    $('#go').disabled = true; $('#err').textContent = '';
    try {
      const r = await JOR.call('auth.login', { email: email, password: pw, device: JOR.device(), label: JOR.deviceLabel() });
      if (r.needCode) {
        /* A computer JORIS hasn't seen: the code that has just gone to their work email. */
        pendingCode = r.pending; keepWanted = $('#keep').checked;
        $('#signin').classList.add('hidden'); $('#codestep').classList.remove('hidden');
        $('#codehi').textContent = 'The first time you sign in on a computer or phone, we check it’s you: a six-digit code has just gone to ' + r.sentTo + '. It works for ' + r.minutes + ' minutes.';
        setTimeout(() => $('#code').focus(), 30);
        return;
      }
      if (r.choose) {
        setupToken = r.setup;
        $('#signin').classList.add('hidden'); $('#choose').classList.remove('hidden');
        $('#hi').textContent = 'Welcome, ' + r.name + '. Choose the password you’ll use from now on — only you will know it.';
        setTimeout(() => $('#pw1').focus(), 30);
        return;
      }
      arrive(r.token, $('#keep').checked, r.me);
    } catch (e) { $('#err').textContent = e.message; }
    finally { $('#go').disabled = false; $('#pw').value = ''; }
  });
  ['#email', '#pw'].forEach(s => $(s).addEventListener('keydown', e => { if (e.key === 'Enter') $('#go').click(); }));

  $('#go3').addEventListener('click', async () => {
    const code = $('#code').value.replace(/\D/g, '');
    if (code.length !== 6) { $('#err3').textContent = 'The six digits from the email, please.'; return; }
    $('#go3').disabled = true; $('#err3').textContent = '';
    try {
      const r = await JOR.call('auth.device', { pending: pendingCode, code: code, remember: $('#remember').checked });
      arrive(r.token, keepWanted && $('#remember').checked, r.me);
    } catch (e) {
      $('#err3').textContent = e.message;
      if (/run out|sign in again/i.test(e.message)) setTimeout(() => showGate(e.message), 1600);
    } finally { $('#go3').disabled = false; }
  });
  $('#code').addEventListener('keydown', e => { if (e.key === 'Enter') $('#go3').click(); });

  $('#go2').addEventListener('click', async () => {
    const a = $('#pw1').value, b = $('#pw2').value;
    if (a !== b) { $('#err2').textContent = 'The two don’t match.'; return; }
    $('#go2').disabled = true; $('#err2').textContent = '';
    try {
      const r = await JOR.call('auth.choose', { setup: setupToken, password: a, device: JOR.device(), label: JOR.deviceLabel() });
      arrive(r.token, $('#keep').checked, r.me);
    } catch (e) { $('#err2').textContent = e.message; }
    finally { $('#go2').disabled = false; }
  });
  $('#pw2').addEventListener('keydown', e => { if (e.key === 'Enter') $('#go2').click(); });

  /* ── Home: my things to do, then every part ── */
  let me = null, people = [];
  const nameOf = id => (people.find(p => p.id === id) || {}).name || '';
  const GROUPS = [['critical', 'Urgent'], ['high', 'Today'], ['medium', 'Soon'], ['low', 'When you can']];
  function hrefOf(x) {
    const g = x.go || {};
    if (x.part === 'home') return '#';
    const base = JOR.ROOT + x.part + '/';
    if (g.complaint) return base + '#complaint=' + encodeURIComponent(g.complaint);
    if (g.ref) return base + '#ref=' + encodeURIComponent(g.ref);
    if (g.chase) return base + '#chase';
    return base;
  }
  function itemHtml(x) {
    return '<a class="ti ' + esc(x.sev) + '" href="' + esc(hrefOf(x)) + '"' + (x.go && x.go.handover ? ' data-handover="' + esc(x.go.handover) + '"' : '') + '><span class="dot"></span><span class="bd"><b>' + esc(x.title) +
      (x.cover ? '<span class="cov">covering for ' + esc(x.cover.split(' ')[0]) + '</span>' : '') + '</b><span>' + esc(x.detail) + '</span></span><span class="rt">' +
      (x.due ? esc(x.due < UI.D.today() ? 'was due ' + UI.nice(x.due) : x.due === UI.D.today() ? 'today' : UI.nice(x.due)) : '') + (x.money ? '<div><b>' + esc(UI.euro(x.money)) + '</b></div>' : '') +
      (x.task ? '<div><button class="btn sm" data-taskdone="' + esc(x.task) + '">Done</button></div>' : '') + '</span></a>';
  }
  function listHtml(items) {
    if (!items.length) return '<div class="card pad empty">Nothing waiting on you. Everything else is in the parts below.</div>';
    return GROUPS.map(g => { const l = items.filter(x => x.sev === g[0]); return l.length ? '<div class="grp">' + g[1] + ' · ' + l.length + '</div><div class="todo">' + l.map(itemHtml).join('') + '</div>' : ''; }).join('');
  }

  async function home() {
    /* Who this is: remembered from signing in, so the page is there at once; asked only if it isn't. */
    const seen = JOR.meKept();
    if (seen) { me = seen.me; JOR.me().catch(() => { }); }
    else {
      try { const r = await JOR.call('auth.me', {}, { quiet: true }); if (r.door && JOR.door && !JOR.door.key) { JOR.door.forget(); location.reload(); return; } me = r.me; JOR.keepMe(me); }
      catch (e) { if (e.signin) { JOR.clearToken(); showGate(e.message); } else showGate(e.message); return; }
    }
    $('#gate').classList.add('hidden'); $('#app').classList.remove('hidden');
    if (!document.querySelector('.top')) UI.topBar('JORIS', 'Joe O’Reilly Ireland', me);
    const hour = new Date().getHours();
    $('#hello').textContent = (hour < 12 ? 'Good morning, ' : hour < 18 ? 'Good afternoon, ' : 'Good evening, ') + me.name.split(' ')[0];
    $('#role').textContent = (RU.ROLES[me.role] || me.role) + (me.owner === 'yes' ? ' · owner' : me.admin === 'yes' ? ' · admin' : '') + (me.team ? ' · ' + me.team : '');
    $('#parts').innerHTML = UI.partsFor(me).filter(p => p.href).map(p => '<a class="part" href="' + esc(p.href) + '"><span class="ic">' + I(p.icon, 'lg') + '</span><div><b>' + esc(p.t) + '</b><span>' + esc(p.s) + '</span></div></a>').join('');
    $('#chpw').innerHTML = I('key', 'sm') + 'Change my password';
    $('#everywhere').innerHTML = I('out', 'sm') + 'Sign out on every computer';
    $('#devs').innerHTML = I('lock', 'sm') + 'My computers and phones';
    $('#off').innerHTML = I('cal', 'sm') + 'I’m off — who covers?';
    if (me.perms['tasks.give']) { $('#give').classList.remove('hidden'); $('#give').innerHTML = I('plus', 'sm') + 'Give someone a task'; }
    $('#seeas').classList.toggle('hidden', !me.perms['people.viewas']);
    $('#seeas').innerHTML = I('eye', 'sm') + 'See JORIS as someone on the team';
    /* The lists are asked for together, not one after another; what this tab last saw shows meanwhile. */
    const seenPeople = JOR.last('settings.get');
    if (seenPeople) people = seenPeople.people || [];
    const pp = JOR.call('settings.get').then(r => { people = r.people || []; JOR.keep('settings.get', null, r); if (teamSeen) paintTeam(teamSeen); }).catch(() => { });
    await Promise.all([pp, todo(true), me.perms['todo.others'] ? team(true) : null]);
  }

  async function todo(first) {
    try {
      if (first) await JOR.live('todo.list', null, paintTodo);
      else { const r = await JOR.call('todo.list'); JOR.keep('todo.list', null, r); paintTodo(r); }
    } catch (e) { $('#todo').innerHTML = '<div class="card pad empty">' + esc(e.message) + '</div>'; }
  }
  function paintTodo(r) {
    $('#cover').innerHTML = (r.covering.length ? '<div class="warnbox">You are covering for ' + r.covering.map(c => '<b>' + esc(c.name) + '</b> until ' + esc(UI.nice(c.until, true))).join(', ') + ' — their things to do are on your list, marked.</div>' : '') +
      (r.coverBy ? '<div class="okbox">' + esc(r.coverBy.name) + ' is covering for you until ' + esc(UI.nice(r.coverBy.until, true)) + '. <a href="#" id="endcover">I’m back</a></div>' : '');
    const ec = $('#endcover');
    if (ec) ec.addEventListener('click', async e => { e.preventDefault(); try { await JOR.call('cover.set', { coverBy: '' }); UI.toast('Welcome back.'); todo(); } catch (x) { UI.toast(x.message); } });
    $('#todo').innerHTML = listHtml(r.items);
  }
  let teamSeen = null;
  async function team(first) {
    try {
      if (first) await JOR.live('todo.team', null, paintTeam);
      else { const r = await JOR.call('todo.team'); JOR.keep('todo.team', null, r); paintTeam(r); }
    } catch (e) { /* the page works without it */ }
  }
  function paintTeam(r) {
    teamSeen = r;
    $('#team').innerHTML = '<div class="todohead"><h2>Everyone’s lists</h2></div><div class="card tw"><table class="t"><thead><tr><th>Who</th><th>Role</th><th class="num">Things to do</th><th class="num">Today or urgent</th><th class="num">Overdue</th><th>Covered by</th><th></th></tr></thead><tbody>' +
      r.people.sort((a, b) => b.high - a.high || b.open - a.open).map(p => '<tr><td><b>' + esc(p.name) + '</b></td><td>' + esc(RU.ROLES[p.role] || p.role) + '</td><td class="num">' + p.open + '</td>' +
        '<td class="num' + (p.high ? ' late' : '') + '">' + p.high + '</td><td class="num' + (p.overdue ? ' late' : '') + '">' + p.overdue + '</td><td>' + esc(p.coverBy ? nameOf(p.coverBy) + ' until ' + UI.nice(p.coverUntil) : '') + '</td>' +
        '<td><div class="acts" style="margin:0"><button class="btn sm" data-see="' + esc(p.id) + '">Their list</button><button class="btn sm" data-cover="' + esc(p.id) + '">Cover</button>' +
        (me.perms['register.assign'] ? '<button class="btn sm" data-handover="' + esc(p.id) + '">Hand over</button>' : '') + '</div></td></tr>').join('') + '</tbody></table></div>';
  }

  document.addEventListener('click', async e => {
    const done = e.target.closest('[data-taskdone]');
    if (done) { e.preventDefault(); e.stopPropagation(); try { await JOR.call('task.done', { id: done.dataset.taskdone }); UI.toast('Done.'); todo(); } catch (x) { UI.toast(x.message); } return; }
    const ho = e.target.closest('[data-handover]');
    if (ho) { e.preventDefault(); handover(ho.dataset.handover); return; }
    const see = e.target.closest('[data-see]');
    if (see) {
      try { const r = await JOR.call('todo.list', { who: see.dataset.see }); UI.dialog({ title: r.who.name + '’s things to do', wide: true, body: listHtml(r.items) }); } catch (x) { UI.toast(x.message); }
      return;
    }
    const cv = e.target.closest('[data-cover]');
    if (cv) coverForm(cv.dataset.cover);
  });
  $('#off').addEventListener('click', () => coverForm(me.id));
  $('#give').addEventListener('click', () => {
    UI.dialog({
      title: 'Give someone a task',
      body: UI.field('To', '<select class="in" name="who" data-focus>' + UI.options(people.map(p => [p.id, p.name + (p.id === me.id ? ' (me)' : '')]), '') + '</select>', 'It goes on their list, and they get an email.') +
        UI.field('What needs doing', '<textarea class="in" name="title"></textarea>') + '<div class="g2">' + UI.field('By', '<input class="in" type="date" name="due">') +
        UI.field('On a file (optional)', '<input class="in" name="ref" placeholder="e.g. 27/1001">') + '</div><div class="err" data-err></div>',
      foot: '<button class="btn" data-x>Cancel</button><button class="btn p" data-ok>Give it</button>',
      on: (el, close) => el.querySelector('[data-ok]').addEventListener('click', async () => {
        const v = n => el.querySelector('[name=' + n + ']').value.trim();
        const p = RU.parseRef(v('ref'));
        try { await JOR.call('task.add', { task: { who: v('who'), title: v('title'), due: v('due'), ref: v('ref') ? (p ? p.ref : v('ref')) : '' } }); close(); UI.toast('Given to ' + nameOf(v('who')) + '.'); todo(); if (me.perms['todo.others']) team(); }
        catch (x) { el.querySelector('[data-err]').textContent = x.message; }
      })
    });
  });
  function coverForm(id) {
    const self = id === me.id, who = self ? me : people.find(p => p.id === id) || { name: '' };
    UI.dialog({
      title: self ? 'I’m off — who covers?' : 'Cover for ' + who.name,
      body: '<p>Until the date, ' + (self ? 'your' : esc(who.name.split(' ')[0]) + '’s') + ' things to do show on the cover’s list as well, and emails from JORIS go to both.</p>' +
        '<div class="g2">' + UI.field('Who covers', '<select class="in" name="by" data-focus>' + UI.options([['', 'Nobody — back now']].concat(people.filter(p => p.id !== id).map(p => [p.id, p.name])), who.coverBy || '') + '</select>') +
        UI.field('Until', '<input class="in" type="date" name="until" value="' + esc(who.coverUntil || UI.D.addDays(UI.D.today(), 7)) + '">') + '</div><div class="err" data-err></div>',
      foot: '<button class="btn" data-x>Cancel</button><button class="btn p" data-ok>Save</button>',
      on: (el, close) => el.querySelector('[data-ok]').addEventListener('click', async () => {
        const by = el.querySelector('[name=by]').value;
        try { await JOR.call('cover.set', { id: id, coverBy: by, until: el.querySelector('[name=until]').value }); close(); UI.toast(by ? nameOf(by) + ' is covering.' : 'Cover ended.'); todo(); if (me.perms['todo.others']) team(); }
        catch (x) { el.querySelector('[data-err]').textContent = x.message; }
      })
    });
  }
  function handover(fromId) {
    const from = people.find(p => p.id === fromId) || { name: 'them' };
    UI.dialog({
      title: 'Hand over ' + from.name + '’s files', wide: true,
      body: '<p>Their open and confirmed files, their tasks and any accommodation requests with them go to someone else. A note goes on every file saying so.</p>' +
        UI.field('To', '<select class="in" name="to" data-focus>' + UI.options(people.filter(p => p.id !== fromId && p.role !== 'accounts').map(p => [p.id, p.name + ' — ' + (RU.ROLES[p.role] || p.role)]), '') + '</select>') +
        UI.field('The handover note', '<textarea class="in" name="note" placeholder="What they need to know — where things are, what’s promised, what’s urgent"></textarea>') + '<div class="err" data-err></div>',
      foot: '<button class="btn" data-x>Cancel</button><button class="btn p" data-ok>Hand them over</button>',
      on: (el, close) => el.querySelector('[data-ok]').addEventListener('click', async () => {
        try {
          const r = await JOR.call('handover', { from: fromId, to: el.querySelector('[name=to]').value, note: el.querySelector('[name=note]').value });
          close(); UI.toast(r.files + ' file' + (r.files === 1 ? '' : 's') + ', ' + r.tasks + ' task' + (r.tasks === 1 ? '' : 's') + ' and ' + r.requests + ' request' + (r.requests === 1 ? '' : 's') + ' handed over.'); todo(); team();
        } catch (x) { el.querySelector('[data-err]').textContent = x.message; }
      })
    });
  }

  $('#chpw').addEventListener('click', () => {
    UI.dialog({
      title: 'Change my password',
      body: UI.field('Current password', '<input class="in" type="password" name="old" autocomplete="current-password" data-focus>') +
        UI.field('New password', '<input class="in" type="password" name="pw1" autocomplete="new-password">', 'At least 10 characters.') +
        UI.field('The same again', '<input class="in" type="password" name="pw2" autocomplete="new-password">') + '<div class="err" data-err></div>',
      foot: '<button class="btn" data-x>Cancel</button><button class="btn p" data-ok>Change it</button>',
      on: (el, close) => el.querySelector('[data-ok]').addEventListener('click', async () => {
        const v = n => el.querySelector('[name=' + n + ']').value;
        if (v('pw1') !== v('pw2')) { el.querySelector('[data-err]').textContent = 'The two don’t match.'; return; }
        try {
          const r = await JOR.call('auth.password', { old: v('old'), password: v('pw1') });
          JOR.setToken(r.token, JOR.kept());
          JOR.keepMe(me);
          close(); UI.toast('Password changed. Anywhere else you were signed in has been signed out.');
        } catch (e) { el.querySelector('[data-err]').textContent = e.message; }
      })
    });
  });

  /* The computers and phones JORIS remembers for me, each to forget. */
  $('#devs').addEventListener('click', async () => {
    let r;
    try { r = await JOR.call('auth.devices'); } catch (e) { UI.toast(e.message, 5000); return; }
    const row = d => '<tr><td><b>' + esc(d.label) + '</b><div class="mini">since ' + esc(UI.nice(d.created.slice(0, 10), true)) + (d.by === 'starting code' ? ', with a starting code' : '') + '</div></td>' +
      '<td class="nw mini">last used ' + esc(UI.when(d.lastSeen)) + '<br>remembered until ' + esc(UI.nice(d.until.slice(0, 10), true)) + '</td><td><button class="btn sm" data-forget="' + esc(d.id) + '">Forget</button></td></tr>';
    UI.dialog({
      title: 'My computers and phones',
      body: (r.devices.length ? '<table class="t"><tbody>' + r.devices.map(row).join('') + '</tbody></table>' : '<p class="mini">None remembered yet.</p>') +
        '<p class="mini">' + (r.check ? 'A computer or phone JORIS doesn’t know asks for a code from your email the first time; these it knows, for ' + r.days + ' days at a time. One you don’t recognise? Forget it, and change your password.' :
          'Codes for new computers are switched off in Settings.') + '</p>',
      on: (el, close) => el.querySelectorAll('[data-forget]').forEach(b => b.addEventListener('click', async () => {
        try { await JOR.call('auth.forget', { id: b.dataset.forget }); b.closest('tr').remove(); UI.toast('Forgotten — it asks for a code next time.'); } catch (e) { UI.toast(e.message, 5000); }
      }))
    });
  });

  /* Management: JORIS as a colleague sees it — their role, their own files, their list. To look, never to change. */
  $('#seeas').addEventListener('click', async () => {
    let r;
    try { r = await JOR.call('view.who'); } catch (e) { UI.toast(e.message, 5000); return; }
    const by = {};
    r.people.forEach(p => { (by[p.role] = by[p.role] || []).push(p); });
    UI.dialog({
      title: 'See JORIS as someone on the team',
      body: '<p class="mini" style="margin-top:0">You see what they see: their parts of JORIS, their own files, their list of things to do. It is for looking only: nothing you do while looking is saved, and their own login is not touched. The log notes that you looked.</p>' +
        (r.people.length ? Object.keys(RU.ROLES).filter(k => by[k]).map(k => '<h3 style="margin:12px 0 6px">' + esc(RU.ROLES[k]) + '</h3><div class="acts" style="justify-content:flex-start;flex-wrap:wrap">' +
          by[k].sort((a, b) => a.name.localeCompare(b.name)).map(p => '<button class="btn sm" data-as="' + esc(p.id) + '">' + esc(p.name) + '</button>').join('') + '</div>').join('')
          : '<p class="mini">Nobody to look as yet. Add the team in People &amp; settings first.</p>') + '<div class="err" data-err></div>',
      foot: '<button class="btn" data-x>Cancel</button>',
      on: el => el.querySelectorAll('[data-as]').forEach(b => b.addEventListener('click', async () => {
        el.querySelectorAll('[data-as]').forEach(x => { x.disabled = true; });
        try { await JOR.look(b.dataset.as); } catch (e) { el.querySelectorAll('[data-as]').forEach(x => { x.disabled = false; }); el.querySelector('[data-err]').textContent = e.message; }
      }))
    });
  });

  $('#everywhere').addEventListener('click', async () => {
    if (!await UI.confirm('Sign out on every computer?', 'Every computer and phone you’re signed in on — this one too — is signed out, and forgotten: each will need your password and a code from your email again. For a lost phone, or a password someone may have seen.', 'Sign out everywhere')) return;
    try { await JOR.call('auth.logoutAll'); } catch (e) { }
    JOR.clearToken(); showGate('Signed out everywhere.');
  });

  const why = qs.get('why') || '';
  if (JOR.token()) home(); else showGate(/^(Please sign in( again)?\.|Signed out after a while without use — please sign in again\.)$/.test(why) ? why : '');
})();
