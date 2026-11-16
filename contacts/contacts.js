/* ═══════════════════════════════════════════════════════════════════════
   JORIS — agents and contacts
   Every RFP adds its agent and contact here, so this fills itself. An agent
   carries its terms: whether it books its own hotels, when the deposit and
   the final payment are due, the usual mark-up. A contact carries whether
   they agreed to mailings, with when and how, and whether they left.
   ═══════════════════════════════════════════════════════════════════════ */
(async function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = UI.esc, I = UI.icon, RU = window.JOR_RULES;
  const me = await JOR.me();
  UI.topBar('Agents & contacts', 'JORIS', me);
  const edit = !!me.perms['agents.edit'];
  let view = location.hash === '#contacts' ? 'contacts' : location.hash === '#mailing' ? 'mailing' : 'agents', data = null, people = [];
  const filt = { q: '', consent: '' };
  /* The agents, and who works here (for the names): asked for together. */
  async function load() {
    const [a, s] = await Promise.all([JOR.call('agents.list'), JOR.call('settings.get').catch(() => ({ people: [] }))]);
    data = a; people = s.people || [];
    JOR.keep('agents.list', null, a); if (s.settings) JOR.keep('settings.get', null, s);
  }
  const nameOf = id => (people.find(p => p.id === id) || {}).name || '';
  const agentName = k => (data.agents.find(a => a.key === k) || {}).name || '';

  function tabs() {
    $('#tabs').innerHTML = [['agents', 'Agents'], ['contacts', 'Contacts']].concat(me.perms['contacts.export'] ? [['mailing', 'Mailing list']] : [])
      .map(x => '<button data-tab="' + x[0] + '" class="' + (view === x[0] ? 'on' : '') + '">' + x[1] + '</button>').join('');
    $('#add').classList.toggle('hidden', !(edit && view === 'contacts'));
    $('#add').innerHTML = I('plus', 'sm') + 'A contact';
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; view = b.dataset.tab; history.replaceState(null, '', '#' + view); render(); });
  function render() { tabs(); ({ agents: agents, contacts: contacts, mailing: mailing })[view](); }
  const search = (fn) => {
    const q = $('#q');
    q.addEventListener('input', () => { filt.q = q.value; clearTimeout(q._t); q._t = setTimeout(() => { const p = q.selectionStart; fn(); const n = $('#q'); n.focus(); n.setSelectionRange(p, p); }, 200); });
  };

  function terms(a) {
    return [a.selfBook === 'yes' ? 'books its own hotels' : '', a.depositRule === 'before' ? 'deposit ' + a.depositDays + ' days out' : 'deposit on confirmation',
      a.finalDays !== '' ? 'final ' + a.finalDays + ' days out' : '', a.markup !== '' ? a.markup + '% mark-up' : ''].filter(Boolean).join(' · ');
  }
  function agents() {
    let list = data.agents.slice();
    if (filt.q) { const q = filt.q.toLowerCase(); list = list.filter(a => (a.name + ' ' + a.country + ' ' + a.contact + ' ' + a.contactEmail).toLowerCase().includes(q)); }
    $('#view').innerHTML = '<div class="bar"><input class="in srch" id="q" placeholder="Agent, country, contact…" value="' + esc(filt.q) + '"></div><div class="card tw">' +
      (list.length ? '<table class="t"><thead><tr><th>Agent</th><th>Country</th><th class="num">Files</th><th>Last</th><th>Usually with</th><th>Their terms</th><th></th></tr></thead><tbody>' +
        list.map(a => '<tr><td><b>' + esc(a.name) + '</b>' + (a.contact ? '<span class="mini"> ' + esc(a.contact) + '</span>' : '') + '</td><td>' + esc(a.country) + '</td><td class="num">' + a.files + '</td>' +
          '<td>' + (a.lastRef ? '<a href="../register/#ref=' + encodeURIComponent(a.lastRef) + '" class="ref">' + esc(a.lastRef) + '</a>' : '') + '</td><td>' + esc(nameOf(a.am)) + '</td><td class="mini">' + esc(terms(a)) + '</td>' +
          '<td>' + (edit ? '<button class="btn sm" data-agent="' + esc(a.key) + '">Edit</button>' : '') + '</td></tr>').join('') + '</tbody></table>' : '<div class="empty">No agents yet — every RFP registered adds its agent.</div>') + '</div>';
    search(agents);
    $('#view').querySelectorAll('[data-agent]').forEach(b => b.addEventListener('click', () => agentForm(data.agents.find(a => a.key === b.dataset.agent))));
  }
  function consentPill(c) {
    if (c.unsubscribed === 'yes') return '<span class="pill lost">unsubscribed</span>';
    if (c.consent === 'yes') return '<span class="pill confirmed">agreed</span>';
    if (c.consent === 'no') return '<span class="pill">said no</span>';
    return '<span class="pill warn">not asked</span>';
  }
  function contacts() {
    let list = data.contacts.slice();
    if (filt.consent === 'yes') list = list.filter(c => c.consent === 'yes' && c.unsubscribed !== 'yes');
    if (filt.consent === 'unsub') list = list.filter(c => c.unsubscribed === 'yes');
    if (filt.consent === 'none') list = list.filter(c => !c.consent && c.unsubscribed !== 'yes');
    if (filt.q) { const q = filt.q.toLowerCase(); list = list.filter(c => (c.name + ' ' + c.email + ' ' + agentName(c.agentKey) + ' ' + c.country + ' ' + c.tags).toLowerCase().includes(q)); }
    list.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
    $('#view').innerHTML = '<div class="bar"><input class="in srch" id="q" placeholder="Name, email, agent, tag…" value="' + esc(filt.q) + '"><select class="in" id="fc">' +
      UI.options([['', 'Everyone'], ['yes', 'Agreed to mailings'], ['none', 'Not asked yet'], ['unsub', 'Unsubscribed']], filt.consent) + '</select></div>' +
      '<div class="count">' + list.length + ' contact' + (list.length === 1 ? '' : 's') + '</div><div class="card tw">' + (list.length ? '<table class="t"><thead><tr><th>Name</th><th>Email</th><th>Agent</th><th>Country</th><th>Mailings</th><th>Tags</th><th></th></tr></thead><tbody>' +
        list.map(c => '<tr><td><b>' + esc(c.name) + '</b>' + (c.role ? '<span class="mini"> ' + esc(c.role) + '</span>' : '') + '</td><td>' + esc(c.email) + '</td><td>' + esc(agentName(c.agentKey)) + '</td><td>' + esc(c.country) + '</td>' +
          '<td>' + consentPill(c) + (c.consentHow ? '<div class="mini">' + esc(c.consentHow) + '</div>' : '') + '</td><td class="mini">' + esc(c.tags) + '</td><td>' + (edit ? '<button class="btn sm" data-c="' + esc(c.id) + '">Edit</button>' : '') + '</td></tr>').join('') +
        '</tbody></table>' : '<div class="empty">Nothing matches.</div>') + '</div>';
    search(contacts);
    $('#fc').addEventListener('change', e => { filt.consent = e.target.value; contacts(); });
    $('#view').querySelectorAll('[data-c]').forEach(b => b.addEventListener('click', () => contactForm(data.contacts.find(c => c.id === b.dataset.c))));
  }
  async function mailing() {
    $('#view').innerHTML = '<div class="card pad"><h3>' + I('mail', 'sm') + 'Who can be sent a mailing</h3><p>Only contacts who agreed, with a record of when and how, and who haven’t unsubscribed since. Taking the list out is logged.</p>' +
      '<div class="acts"><button class="btn p" id="xl">' + I('down', 'sm') + 'Download for the mailing service</button></div><div class="mini" id="xn"></div>' +
      '<p class="mini">For mailings that land in the inbox rather than junk, send them through a proper mailing service set up on jorireland.com (SPF and DKIM), not from Outlook.</p></div>';
    $('#xl').addEventListener('click', async () => {
      try {
        const r = await JOR.call('contacts.export');
        const rows = [['Email', 'Name', 'Agent', 'Country', 'Tags', 'Agreed on', 'How they agreed']].concat(r.contacts.map(c => [c.email, c.name, c.agent, c.country, c.tags, c.consentAt, c.consentHow]));
        UI.download('JOR mailing list ' + UI.D.today() + '.xlsx', SHEET.write([{ name: 'Mailing list', rows: rows }]));
        $('#xn').textContent = r.contacts.length + ' contacts.';
      } catch (e) { UI.toast(e.message, 5000); }
    });
  }

  async function refresh(msg) { await load(); render(); if (msg) UI.toast(msg); }
  function agentForm(a) {
    UI.dialog({
      title: 'Edit ' + a.name, wide: true,
      body: '<div class="g3">' + UI.field('Name', '<input class="in" name="name" value="' + esc(a.name) + '" data-focus>') + UI.field('Country', UI.pick('country', 'country', a.country || '', { placeholder: 'Start typing — France, FR…' })) +
        UI.field('Usual mark-up %', '<input class="in" type="number" min="0" max="100" step="0.5" name="markup" value="' + esc(a.markup) + '">', 'The costing starts with this.') +
        UI.field('Contact', '<input class="in" name="contact" value="' + esc(a.contact) + '">') + UI.field('Their email', '<input class="in" name="contactEmail" type="email" value="' + esc(a.contactEmail) + '">') + '<div></div>' +
        UI.field('Deposit', '<select class="in" name="depositRule">' + UI.options([['confirmation', 'On confirmation'], ['before', 'A number of days before arrival']], a.depositRule) + '</select>') +
        UI.field('Deposit days before arrival', '<input class="in" type="number" min="0" name="depositDays" value="' + esc(a.depositDays) + '">', 'e.g. Odysseys: 60.') +
        UI.field('Final payment, days before arrival', '<input class="in" type="number" min="0" name="finalDays" value="' + esc(a.finalDays) + '">', 'Blank: the office default in Settings.') + '</div>' +
        '<label class="chk"><input type="checkbox" name="selfBook"' + (a.selfBook === 'yes' ? ' checked' : '') + '> Their account manager books the hotels — the files never go to reservations (Odysseys)</label>' +
        UI.field('Notes', '<textarea class="in" name="notes">' + esc(a.notes) + '</textarea>') + '<div class="err" data-err></div>',
      foot: '<button class="btn" data-x>Cancel</button><button class="btn p" data-ok>Save</button>',
      on: (el, close) => el.querySelector('[data-ok]').addEventListener('click', async () => {
        const v = n => el.querySelector('[name=' + n + ']').value.trim();
        try {
          await JOR.call('agents.save', { agent: { key: a.key, name: v('name'), country: v('country'), contact: v('contact'), contactEmail: v('contactEmail'), markup: v('markup'), depositRule: v('depositRule'), depositDays: v('depositDays'), finalDays: v('finalDays'),
            selfBook: el.querySelector('[name=selfBook]').checked ? 'yes' : '', notes: v('notes') } });
          close(); await refresh('Saved. Payments not yet invoiced follow the new terms.');
        } catch (e) { el.querySelector('[data-err]').textContent = e.message; }
      })
    });
  }
  function contactForm(c) {
    c = c || { consent: '', unsubscribed: '' };
    UI.dialog({
      title: c.id ? 'Edit ' + (c.name || c.email) : 'A contact', wide: true,
      body: '<div class="g3">' + UI.field('Name', '<input class="in" name="name" value="' + esc(c.name || '') + '" data-focus>') + UI.field('Email', '<input class="in" type="email" name="email" value="' + esc(c.email || '') + '">') +
        UI.field('Phone', '<input class="in" name="phone" value="' + esc(c.phone || '') + '">') + UI.field('Agent', '<select class="in" name="agentKey">' + UI.options([['', '—']].concat(data.agents.map(a => [a.key, a.name])), c.agentKey || '') + '</select>') +
        UI.field('Role', '<input class="in" name="role" value="' + esc(c.role || '') + '">') + UI.field('Country', UI.pick('country', 'country', c.country || '', { placeholder: 'Start typing — France, FR…' })) + '</div>' +
        UI.field('Tags', '<input class="in" name="tags" value="' + esc(c.tags || '') + '" placeholder="e.g. golf, MICE, ITB 2026">') +
        '<div class="g2">' + UI.field('Mailings', '<select class="in" name="consent">' + UI.options([['', 'Not asked'], ['yes', 'Agreed'], ['no', 'Said no']], c.consent) + '</select>') +
        UI.field('How they agreed', '<input class="in" name="consentHow" value="' + esc(c.consentHow || '') + '" placeholder="e.g. Ticked the form at ITB Berlin">', 'The law asks for when and how — when is stamped.') + '</div>' +
        '<label class="chk"><input type="checkbox" name="unsub"' + (c.unsubscribed === 'yes' ? ' checked' : '') + '> Unsubscribed — never mail them again</label>' +
        UI.field('Notes', '<textarea class="in" name="notes">' + esc(c.notes || '') + '</textarea>') + '<div class="err" data-err></div>',
      foot: '<button class="btn" data-x>Cancel</button><button class="btn p" data-ok>Save</button>',
      on: (el, close) => el.querySelector('[data-ok]').addEventListener('click', async () => {
        const v = n => el.querySelector('[name=' + n + ']').value.trim();
        try {
          await JOR.call('contacts.save', { contact: { id: c.id, name: v('name'), email: v('email'), phone: v('phone'), agentKey: v('agentKey'), role: v('role'), country: v('country'), tags: v('tags'), notes: v('notes'),
            consent: v('consent'), consentHow: v('consentHow'), unsubscribed: el.querySelector('[name=unsub]').checked ? 'yes' : '' } });
          close(); await refresh('Saved.');
        } catch (e) { el.querySelector('[data-err]').textContent = e.message; }
      })
    });
  }
  $('#add').addEventListener('click', () => contactForm());

  /* What this tab last saw, at once; the fresh copy behind, drawn if anything changed. */
  const a0 = JOR.last('agents.list'), s0 = JOR.last('settings.get');
  let shown = '';
  if (a0 && s0) { data = a0; people = s0.people || []; shown = JSON.stringify([a0, people]); render(); }
  try { await load(); } catch (e) { $('#view').innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; return; }
  if (JSON.stringify([data, people]) !== shown) render();
})();
