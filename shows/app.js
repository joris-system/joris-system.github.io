/* ═══════════════════════════════════════════════════════════════════════
   Trade Shows — the page
   · Met someone: the show on today and today's date already in, a selfie,
     the card or the notes read by Gemini, priority 1 high to 3 low, the
     follow-up. Saved at once on the phone, sent behind.
   · Someone met before — the same email, or the same name at the same
     company — is recognised as they are typed; every company brings its
     people, the shows they were met at, and the RFPs JORIS has had from them.
   · Dashboard, one search box (notes too), the map, and Admin.
   ═══════════════════════════════════════════════════════════════════════ */
(async function () {
  'use strict';
  const $ = s => document.querySelector(s), $$ = (s, el) => [...(el || document).querySelectorAll(s)];
  const esc = UI.esc, I = UI.icon, D = UI.D, RU = UI.RU;
  let S = null, view = 'dash', MET = [];          // MET: the meetings that happened (planned ones are in "Today's meetings")
  const F = { q: '', show: '', pr: '', loc: '', owner: '', status: 'open', due: false, todo: false, sort: 'new' };
  /* Saved in a hurry at the stand — the company, the name or the priority still to add. */
  const unfinished = m => !m.planned && !m._local && m.check !== 'yes' && (!m.company || !m.name || !m.priority);
  const MAPV = { mode: 'shows' };

  /* ── The way in: no link on this phone, nothing to show ── */
  const standalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  /* iPhone: never zoom in by itself when a box is tapped (it still lets a person pinch to zoom). */
  if (isIOS()) { const vp = document.querySelector('meta[name=viewport]'); if (vp && !/maximum-scale/.test(vp.content)) vp.content += ',maximum-scale=1'; }
  if (!API.key()) { if (API.team()) whoAreYou(); else noLink(); return; }
  function noLink(msg) {
    const home = standalone();
    document.body.innerHTML = '<div class="gate"><div class="gatecard"><img data-logo alt="JOR"><h1>Trade Shows</h1><p>' + esc(msg || (home ? 'Paste the Trade Shows team link here, once — the one sent to you.' : 'Open the Trade Shows team link on this phone — the one sent to you.')) + '</p>' +
      (home ? '<input class="in" id="lnk" placeholder="https://…#t=…" autocomplete="off" style="margin:4px 0 10px"><div class="acts"><button class="btn" id="lpaste">Paste</button><button class="btn p" id="lgo">Open</button></div>' : '') +
      '<p class="mini" style="color:var(--ink-3)">No link? Ask whoever looks after Trade Shows.</p></div></div>';
    $$('img[data-logo]').forEach(i => { i.src = window.JOR_MARKS.logo; });
    if (!home) return;
    const go = () => { const m = /[#&]([tk])=([A-Za-z0-9-]{20,48})/.exec($('#lnk').value); if (!m) { UI.toast('That isn’t the Trade Shows link — it has #t= in it.'); return; } location.replace(location.pathname + '#' + m[1] + '=' + m[2]); location.reload(); };
    $('#lgo').onclick = go;
    $('#lpaste').onclick = async () => { try { $('#lnk').value = await navigator.clipboard.readText(); go(); } catch (e) { $('#lnk').focus(); } };
  }

  /* "Who are you?" — once on each phone. Whoever looks after Trade Shows types their PIN too. */
  async function whoAreYou(msg) {
    document.body.innerHTML = '<div class="gate"><div class="gatecard who-c"><img data-logo alt="JOR"><h1>Who are you?</h1><p>' + esc(msg || 'Tap your name — once on this phone. It opens straight in after that.') + '</p><div id="names"><div class="empty">Loading…</div></div><div id="pinbox"></div></div></div>';
    $$('img[data-logo]').forEach(i => { i.src = window.JOR_MARKS.logo; });
    let r;
    try { r = await API.call('team.people', { t: API.team() }); }
    catch (e) {
      if (e.signin) { try { localStorage.removeItem('jorshows.team'); } catch (x) { } noLink(e.message); return; }
      $('#names').innerHTML = '<p class="err">' + esc(e.offline ? 'No signal — this needs signal once. Try again in a moment.' : e.message) + '</p><button class="btn" id="again">Try again</button>';
      $('#again').onclick = () => whoAreYou(); return;
    }
    $('#names').innerHTML = r.people.map(p => '<button class="nameb" data-id="' + esc(p.id) + '"><span class="av">' + esc(p.initials) + '</span>' + esc(p.name) + (p.pin ? ' <em>' + I('lock', 'sm') + '</em>' : '') + '</button>').join('') || '<p class="err">Nobody is on the team yet.</p>';
    const label = (/iPhone|iPad|Android|Windows|Mac/.exec(navigator.userAgent) || ['a phone'])[0];
    const join = async (p, pin) => {
      try {
        const j = await API.call('team.join', { t: API.team(), id: p.id, pin: pin || '', label: label });
        API.setKey(j.k); location.replace(location.pathname); location.reload();
      } catch (e) { UI.toast(e.offline ? 'No signal — try again in a moment.' : e.message, 6000); }
    };
    $$('[data-id]', $('#names')).forEach(b => b.onclick = () => {
      const p = r.people.find(x => x.id === b.dataset.id);
      if (!p.pin) { join(p); return; }
      $('#pinbox').innerHTML = '<label class="f" style="margin-top:12px"><span>' + esc(p.name) + ' — your PIN</span><input class="in" id="pin" inputmode="numeric" type="password" autocomplete="off" maxlength="8"></label><button class="btn p" id="pingo">Open Trade Shows</button>';
      const go = () => join(p, $('#pin').value.trim());
      $('#pingo').onclick = go; $('#pin').onkeydown = e => { if (e.key === 'Enter') go(); }; $('#pin').focus();
    });
  }

  /* ══ On the home screen ═══════════════════════════════════════════════ */
  let installEvt = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; offerInstall(); });
  function offerInstall(asked) {
    if (standalone() || document.querySelector('.inst')) return;
    let no = 0;
    try { no = +localStorage.getItem('jorshows.installNo') || 0; } catch (e) { }
    if (!asked && Date.now() - no < 5 * 864e5) return;
    const ios = isIOS();
    if (!ios && !installEvt) { if (asked) UI.toast('Use the browser’s menu › Add to Home screen.'); return; }
    /* The icon opens as this person: their link goes into the address, and into the page's home-screen details, while this is open. */
    const mf = document.querySelector('link[rel=manifest]'), mfWas = mf ? mf.getAttribute('href') : '';
    if (ios && API.key()) {
      const at = location.origin + location.pathname + '#k=' + API.key();
      history.replaceState(null, '', at);
      if (mf) mf.setAttribute('href', 'data:application/manifest+json,' + encodeURIComponent(JSON.stringify({ name: 'JOR Trade Shows', short_name: 'Trade Shows', start_url: at, scope: location.origin + location.pathname, display: 'standalone', background_color: '#ECF1EF', theme_color: '#00A66E',
        icons: [{ src: location.origin + location.pathname + 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: location.origin + location.pathname + 'icon-512.png', sizes: '512x512', type: 'image/png' }] })));
    }
    const chrome = /CriOS|FxiOS|EdgiOS/.test(navigator.userAgent);
    const share = '<svg class="i" viewBox="0 0 24 24"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
    const add = '<svg class="i" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';
    const el = document.createElement('div');
    el.className = 'inst';
    el.innerHTML = '<div class="inst-c"><img src="icon-192.png" alt=""><div><b>Put Trade Shows on your home screen</b><span>Open it in one tap at the next show — it works with no signal too.</span></div><button class="inst-x" aria-label="Not now">' + I('x') + '</button></div>' +
      (ios ? '<ol><li>Tap <b>Share</b> ' + share + (chrome ? ' — top right' : ' — at the bottom of the screen') + '</li><li>Scroll down, tap <b>Add to Home Screen</b> ' + add + '</li><li>Tap <b>Add</b>. Then open Trade Shows from its icon.</li></ol>' + (chrome ? '' : '<div class="inst-arrow"></div>')
        : '<div class="acts" style="margin-top:10px"><button class="btn p" id="instgo">' + I('down', 'sm') + 'Install Trade Shows</button></div>');
    document.body.appendChild(el);
    const close = () => {
      el.remove();
      try { localStorage.setItem('jorshows.installNo', String(Date.now())); } catch (e) { }
      if (ios) { history.replaceState(null, '', location.pathname); if (mf) mf.setAttribute('href', mfWas); }
    };
    el.querySelector('.inst-x').onclick = close;
    const g = el.querySelector('#instgo');
    if (g) g.onclick = async () => { installEvt.prompt(); try { await installEvt.userChoice; } catch (e) { } installEvt = null; close(); };
  }

  /* ── Small things ── */
  const REGIONS = { EU: 'Europe', NA: 'North America', LA: 'Latin America & Caribbean', AS: 'Asia', ME: 'Middle East', AF: 'Africa', OC: 'Oceania' };
  const IN_REGION = {
    EU: 'AD AL AM AT AX AZ BA BE BG BY CH CY CZ DE DK EE ES FI FO FR GB GE GG GI GR HR HU IE IM IS IT JE LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SJ SK SM TR UA VA XK',
    ME: 'AE BH IL IQ IR JO KW LB OM PS QA SA SY YE',
    AS: 'AF BD BN BT CN HK ID IN IO JP KG KH KP KR KZ LA LK MM MN MO MV MY NP PH PK SG TH TJ TL TM TW UZ VN',
    LA: 'AG AI AR AW BB BL BO BQ BR BS BZ CL CO CR CU CW DM DO EC FK GD GF GP GS GT GY HN HT JM KN KY LC MF MQ MS MX NI PA PE PR PY SR SV SX TC TT UY VC VE VG VI',
    AF: 'AO BF BI BJ BW CD CF CG CI CM CV DJ DZ EG EH ER ET GA GH GM GN GQ GW KE KM LR LS LY MA MG ML MR MU MW MZ NA NE NG RE RW SC SD SH SL SN SO SS ST SZ TD TG TN TZ UG YT ZA ZM ZW',
    OC: 'AS AU CC CK CX FJ FM GU HM KI MH MP NC NF NR NU NZ PF PG PN PW SB TK TO TV UM VU WF WS',
    NA: 'BM CA GL PM US'
  };
  const REGION_OF = {};
  Object.keys(IN_REGION).forEach(r => IN_REGION[r].split(' ').forEach(c => { REGION_OF[c] = r; }));
  const STATUS = { new: 'To follow up', done: 'Followed up', cold: 'Gone cold' };
  const PRN = { '1': 'High', '2': 'Medium', '3': 'Low' };
  const today = () => (S && S.today && S.today > D.today() ? S.today : D.today());
  const showOf = id => (S.shows.find(s => s.id === id)) || { name: '(a show no longer here)', id: id };
  const nameOf = id => (S.people.find(p => p.id === id) || {}).name || '';
  const country = c => RU.countryName(c) || c || '';
  const prBadge = p => '<span class="pr p' + (p || 0) + '" title="' + (p ? 'Priority ' + p + ' — ' + PRN[p] : 'No priority') + '">' + (p || '–') + '</span>';
  const initials = m => ((m.name || m.company || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('') || '?').toUpperCase();
  const isOn = s => s.starts <= today() && (s.ends || s.starts) >= today();
  const dates = s => !s.starts ? '' : s.ends && s.ends !== s.starts ? UI.nice(s.starts) + ' – ' + UI.nice(s.ends, true) : UI.nice(s.starts, true);
  const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const uid = () => (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : Date.now().toString(36) + Math.random().toString(36).slice(2)).slice(0, 24);
  const isAdmin = () => S && S.me && S.me.admin === 'yes';

  /* ══ How everything connects: companies, people, JORIS ═════════════════
     A company is its name as JORIS keys an agent ("The Example Tours Ltd" = "example tours"); someone with
     no company is put with the company their email's domain belongs to. A person is their email, else their
     name at their company. JORIS's RFPs count for a company from the day it was first met. */
  const keyOf = s => String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').replace(/\b(ltd|limited|sa|sarl|gmbh|inc|llc|the)\b/g, '').replace(/\s+/g, ' ').trim();
  const OPEN_MAIL = /^(gmail|googlemail|yahoo|ymail|hotmail|outlook|live|msn|icloud|me|mac|aol|gmx|web|orange|free|wanadoo|btinternet|proton|protonmail|qq|163|naver|mail)\./;
  const domainOf = e => { const d = String(e || '').toLowerCase().split('@')[1] || ''; return d && !OPEN_MAIL.test(d) ? d : ''; };
  let L = null;                                     // the links, worked out once per change
  function links() {
    if (L && L.at === MET) return L;
    const byDomain = {};
    MET.forEach(m => { const d = domainOf(m.email), k = keyOf(m.company); if (d && k && !byDomain[d]) byDomain[d] = k; });
    const ck = m => keyOf(m.company) || byDomain[domainOf(m.email)] || '';
    const pk = m => m.email ? 'e:' + m.email.toLowerCase() : m.name ? 'n:' + fold(m.name).trim() + '|' + ck(m) : 'm:' + m.id;
    const companies = {}, people = {};
    MET.forEach(m => {
      const c = ck(m);
      m._ck = c; m._pk = pk(m);
      (people[m._pk] = people[m._pk] || []).push(m);
      if (!c) return;
      const o = companies[c] || (companies[c] = { key: c, name: m.company || c, met: [], people: {}, shows: {}, first: m.met, countries: {} });
      o.met.push(m); o.people[m._pk] = 1; o.shows[m.showId] = 1;
      if (m.met < o.first) o.first = m.met;
      if (o.name === c && m.company) o.name = m.company;                // as someone typed it, not the key
      if (m.country) o.countries[m.country] = 1;
    });
    /* What JORIS says: [company key, contact email, ref, registered, status]. */
    const J = (S.joris || []).map(j => ({ key: j[0], email: String(j[1] || '').toLowerCase(), ref: j[2], reg: j[3], status: j[4] }));
    const won = j => j.status === 'confirmed' || j.status === 'closed';
    Object.values(companies).forEach(o => {
      const emails = {};
      o.met.forEach(m => { if (m.email) emails[m.email.toLowerCase()] = 1; });
      o.rfps = J.filter(j => (j.key === o.key || emails[j.email]) && j.reg >= o.first);
      o.groups = o.rfps.filter(won);
      o.best = o.met.reduce((b, m) => m.priority && (!b || m.priority < b) ? m.priority : b, '');
      o.last = o.met.reduce((b, m) => m.met > b ? m.met : b, '');
    });
    MET.forEach(m => {
      const r = J.filter(j => ((m._ck && j.key === m._ck) || (m.email && j.email === m.email.toLowerCase())) && j.reg >= m.met);
      m.rfps = r.length; m.groups = r.filter(won).length; m.refs = r.map(j => j.ref);
    });
    L = { at: MET, companies, people, ck, pk };
    return L;
  }
  /* Someone being typed in: met before? */
  function metBefore(x, except) {
    const lk = links(), email = String(x.email || '').toLowerCase().trim(), ck = keyOf(x.company) || '', nm = fold(x.name).trim();
    /* A company typed in part ("Nordlicht") is the one it starts ("Nordlicht Reisen"). */
    const near = k => !!k && !!ck && (k === ck || (ck.length >= 4 && (k.indexOf(ck) === 0 || ck.indexOf(k) === 0)));
    const same = MET.filter(m => m.id !== except && ((email && m.email && m.email.toLowerCase() === email) || (nm && nm.length > 2 && fold(m.name).trim() === nm && (!ck || near(m._ck)))));
    const co = ck ? (lk.companies[ck] || Object.values(lk.companies).filter(c => near(c.key)).sort((a, b) => b.met.length - a.met.length)[0] || null) : null;
    return { same: same.sort((a, b) => b.met.localeCompare(a.met)), company: co };
  }

  /* ══ Drawing ═══════════════════════════════════════════════════════════ */
  function frame() {
    document.body.innerHTML = '<div class="top"><img data-logo alt="JOR"><div class="tt"><b>Trade Shows</b><span id="syncline">…</span></div><div class="sp"></div>' +
      (!standalone() && (isIOS() || 'onbeforeinstallprompt' in window) ? '<button class="btn" id="instbtn" title="Put Trade Shows on the home screen">' + I('down', 'sm') + '<span class="pl">Home screen</span></button>' : '') +
      '<div class="who"><span class="nm" id="meName"></span><span class="av" id="meAv">?</span></div></div>' +
      '<div class="page"><div id="note"></div><div id="today"></div><div id="hero"></div><div class="sh-tabs" id="tabs"></div><div id="view"><div class="empty">Loading…</div></div></div>';
    $$('img[data-logo]').forEach(i => { i.src = window.JOR_MARKS.logo; });
    const ib = $('#instbtn'); if (ib) ib.onclick = () => offerInstall(true);
  }
  function paint() {
    S = API.S || S;
    if (!S) return;
    MET = S.met.filter(m => !m.planned);
    L = null;
    $('#meName').textContent = (S.me || {}).name || '';
    $('#meAv').textContent = (S.me || {}).initials || '?';
    syncLine();
    hero(); todayStrip(); tabs();
    ({ dash, people, companies, map: mapView, check: checkView, admin: adminView }[view] || dash)();
  }
  function syncLine() {
    const n = API.OUT.n, el = $('#syncline');
    if (!el) return;
    el.innerHTML = n ? '<span class="sy wait">' + I('refresh', 'sm') + (API.OUT.busy ? 'Sending ' + n + '…' : n + ' to send') + '</span>' : navigator.onLine === false ? '<span class="sy off">' + I('nosignal', 'sm') + 'No signal — all here</span>' :
      '<span class="sy">' + I('check', 'sm') + 'Up to date' + (S.syncedAt ? ' · ' + new Date(S.syncedAt).toTimeString().slice(0, 5) : '') + '</span>';
    const why = API.OUT.why;
    $('#note').innerHTML = n ? '<div class="outbox' + (API.OUT.busy ? ' going' : '') + '">' + I(API.OUT.busy ? 'refresh' : 'nosignal') + '<span class="sp">' +
      (API.OUT.busy ? 'Sending ' + n + (n === 1 ? ' thing' : ' things') + ' to Trade Shows… (photos can take a little while)' : n + (n === 1 ? ' thing is' : ' things are') + ' saved on this phone, waiting to go.' + (why ? '<br><small>' + esc(why) + '</small>' : '')) +
      '</span>' + (API.OUT.busy ? '' : '<button class="btn sm" id="oflush">Send now</button>') + '<button class="btn sm" id="oshow">Show me</button></div>' : '';
    const b = $('#oflush'); if (b) b.onclick = () => API.flush();
    const sm = $('#oshow'); if (sm) sm.onclick = waitingDialog;
  }

  /* What is waiting on this phone, and why — each can be taken out (it then never goes). */
  async function waitingDialog() {
    const list = await API.pending();
    const what = it => it.a === 'show.save' ? 'New show: ' + it.body.show.name : it.a === 'met.remove' ? 'Removing someone' :
      it.a === 'met.save' ? (it.body.met.id ? 'Change to ' : 'Met ') + ([it.body.met.name, it.body.met.company].filter(Boolean).join(', ') || 'someone') + (it.body.photos && Object.keys(it.body.photos).length ? ' (with photos)' : '') :
      it.a === 'met.addphoto' ? (it.body.which === 'selfie' ? 'A selfie for ' : 'A card for ') + (((S.met.find(m => m.id === it.body.id) || {}).company) || 'someone') : it.a;
    UI.dialog({ title: 'Waiting on this phone', wide: true,
      body: (API.OUT.why ? '<p class="warnbox">' + I('warn', 'sm') + ' Last try: ' + esc(API.OUT.why) + '</p>' : '') + (list.length ? '<div class="mlist">' + list.map(([k, it]) => '<div class="mrow" style="cursor:default"><div class="bd"><b>' + esc(what(it)) + '</b><div class="l2">saved ' + esc(new Date(it.at).toLocaleString()) + '</div></div><button class="btn sm dngr" data-k="' + esc(k) + '">Remove</button></div>').join('') + '</div>' : '<div class="empty">Nothing waiting — all sent.</div>'),
      foot: '<button class="btn" data-x>Close</button>' + (list.length ? '<button class="btn p" data-go>Send now</button>' : ''),
      on: (el, close) => {
        $$('[data-k]', el).forEach(b => b.onclick = async () => {
          if (!(await UI.confirm('Remove this from the phone?', 'It won’t go to Trade Shows. If it already got there, it stays there.', 'Remove', true))) return;
          const it = (list.find(x => x[0] === b.dataset.k) || [])[1] || {};
          await API.removeWaiting(b.dataset.k);
          if (it.local) S.met = S.met.filter(m => !(m._local && m.id === it.local));      // a new one that never went: off the list too
          await API.keep(); close(); paint(); waitingDialog();
        });
        const g = el.querySelector('[data-go]'); if (g) g.onclick = () => { close(); API.flush(); };
      } });
  }
  function defaultShow() {
    const on = S.shows.filter(isOn);
    if (on.length) return on[0].id;
    let last = '';
    try { last = localStorage.getItem('jorshows.lastShow') || ''; } catch (e) { }
    if (last && S.shows.some(s => s.id === last)) return last;
    return (S.shows.slice().sort((a, b) => (b.starts || '').localeCompare(a.starts || ''))[0] || {}).id || '';
  }

  function figures() {
    const met = MET, lk = links();
    return {
      met: met.length, p1: met.filter(m => m.priority === '1').length,
      mineDue: met.filter(m => m.status === 'new' && m.nextDate && m.nextDate <= D.addDays(today(), 7) && (m.owner || m.by) === S.me.id).length,
      due: met.filter(m => m.status === 'new' && m.nextDate && m.nextDate <= today()).length,
      followed: met.filter(m => m.status === 'done').length,
      companies: Object.keys(lk.companies).length,
      rfpCos: Object.values(lk.companies).filter(c => c.rfps.length).length, groupCos: Object.values(lk.companies).filter(c => c.groups.length).length,
      check: met.filter(m => m.check === 'yes').length
    };
  }
  let counted = false;
  /* Those saved with only a selfie, a company or a name: one tap to the list, to finish them. */
  function todoLine() {
    const all = MET.filter(unfinished), mine = all.filter(m => m.by === S.me.id || (m.owner || m.by) === S.me.id).length;
    if (!all.length) return '';
    return '<button class="sh-todo" id="htodo">' + I('warn', 'sm') + '<span><b>' + all.length + ' still to finish</b> — a name, company or priority to add' + (mine && mine !== all.length ? ' (' + mine + ' yours)' : '') + '</span></button>';
  }
  function hero() {
    const f = figures(), on = S.shows.filter(isOn);
    const nowLine = on.map(s => { const n = MET.filter(m => m.showId === s.id).length, mine = MET.filter(m => m.showId === s.id && m.by === S.me.id).length;
      return '<div class="sh-now"><span class="live"></span><div><b>' + esc(s.name) + ' is on today</b><div style="opacity:.85;font-size:13px">' + n + ' met so far' + (mine && mine !== n ? ' · ' + mine + ' by you' : '') + (s.city ? ' · ' + esc(s.city) : '') + '</div></div></div>'; }).join('');
    const kpi = (v, label, go, cls) => '<div class="sh-kpi ' + (cls || '') + '"' + (go ? ' data-go="' + go + '"' : '') + '><b data-count="' + v + '">' + v + '</b><span>' + label + '</span></div>';
    $('#hero').innerHTML = '<div class="sh-hero"><div class="row"><div><h2>Who we met</h2><p>Every show and conference, and what came of it.</p></div></div>' +
      '<button class="btn met big" id="metbtn">' + I('camera', 'lg') + 'Met someone</button>' +
      '<div class="sh-more"><button class="btn addshow" id="addshow">' + I('plus', 'sm') + 'Add a trade show</button>' +
      '<form class="sh-find" id="hfind" role="search">' + I('search', 'sm') + '<input id="hq" type="search" enterkeyhint="search" autocomplete="off" placeholder="Find anyone — name, place, notes…"></form></div>' + todoLine() + nowLine +
      '<div class="sh-kpis">' + kpi(S.shows.length, S.shows.length === 1 ? 'show' : 'shows', 'map') + kpi(f.met, 'people met', 'people') + kpi(f.companies, 'companies', 'companies') +
      kpi(f.p1, 'priority 1', 'p1', 'gold') + kpi(f.mineDue, 'your follow-ups this week', 'due') + kpi(f.rfpCos, 'companies sent an RFP', 'rfp', 'gold') + '</div></div>';
    if (!counted) { counted = true; countUp($('#hero')); }
    $$('[data-go]', $('#hero')).forEach(el => el.onclick = () => {
      const g = el.dataset.go; reset();
      if (g === 'p1') F.pr = '1';
      if (g === 'due') { F.due = true; F.owner = S.me.id; }
      if (g === 'people') F.status = '';
      if (g === 'rfp') { go('companies', { rfp: true }); return; }
      go(g === 'map' ? 'map' : g === 'companies' ? 'companies' : 'people');
    });
    $('#metbtn').onclick = () => capture();
    $('#addshow').onclick = () => addShow();
    const td = $('#htodo'); if (td) td.onclick = () => { reset(); F.todo = true; F.status = ''; go('people'); };
    /* Search from the front: every status, every show — whatever they remember. */
    $('#hfind').onsubmit = e => { e.preventDefault(); const v = $('#hq').value.trim(); if (!v) return; reset(); F.q = v; F.status = ''; go('people'); const q = $('#q'); if (q) { q.focus(); q.setSelectionRange(v.length, v.length); } };
  }
  /* ══ Today's meetings: the sheets printed before the show, in time order, the next one first.
     A tap on 1, 2 or 3 and it is met — six minutes to the next one leaves no time for a form. ══ */
  const timeOf = m => { const t = /(\d{1,2})[:.h](\d{2})/.exec(m.slot || ''); if (t) return ('0' + t[1]).slice(-2) + ':' + t[2]; const n = /Slot (\d+)/.exec(m.slot || ''); return n ? 'S' + ('00' + n[1]).slice(-3) : 'zz'; };
  function todayStrip() {
    const box = $('#today');
    const list = S.met.filter(m => m.met === today() && (m.planned || m.slot)).sort((a, b) => timeOf(a).localeCompare(timeOf(b)));
    if (!list.length) { box.innerHTML = ''; return; }
    /* Next: the first not yet met from a quarter of an hour ago on (running late is normal). */
    const t = new Date(Date.now() - 15 * 60000), since = ('0' + t.getHours()).slice(-2) + ':' + ('0' + t.getMinutes()).slice(-2);
    const todo = list.filter(m => m.planned), next = todo.find(m => timeOf(m) >= since) || todo[0];
    const others = m => String(m.others || '').split(/;\s*/).filter(Boolean).length;
    box.innerHTML = '<div class="tday"><div class="tday-h"><b>Today’s meetings</b><span>' + (list.length - todo.length) + ' of ' + list.length + ' done' + (todo.length ? ' — tap 1, 2 or 3 when you’ve met them' : ' — all met') + '</span></div><div class="tday-row">' +
      list.map(m => '<div class="tcard' + (m.planned ? '' : ' done') + (next && m.id === next.id ? ' next' : '') + '" data-t="' + esc(m.id) + '">' +
        '<div class="tt">' + (next && m.id === next.id ? '<span class="nx">NEXT</span>' : '') + esc(/^\d/.test(timeOf(m)) ? timeOf(m) : '') + ' <em>' + esc(String(m.slot || '').replace(/\s*\d{1,2}[:.h]\d{2}\s*(hrs)?\s*·?/, '').replace(/^·\s*|\s*·$/g, '')) + '</em></div>' +
        '<div class="tco">' + esc(m.company || '—') + '</div><div class="tnm">' + esc(m.name || '') + (others(m) ? ' <span>+' + others(m) + '</span>' : '') + '</div>' +
        (m.planned ? '<div class="tpr">' + ['1', '2', '3'].map(p => '<button type="button" class="p' + p + '" data-tp="' + p + '">' + p + '</button>').join('') + '</div>'
          : '<div class="tok">' + I('check', 'sm') + ' Met ' + prBadge(m.priority) + '</div>') + '</div>').join('') + '</div></div>';
    $$('[data-t]', box).forEach(c => c.onclick = e => {
      const b = e.target.closest('[data-tp]');
      if (b) { e.stopPropagation(); metNow(c.dataset.t, b.dataset.tp); return; }
      openMet(c.dataset.t);
    });
    const nx = box.querySelector('.tcard.next');
    if (nx && !todayStrip.scrolled) { todayStrip.scrolled = true; nx.parentElement.scrollLeft = Math.max(0, nx.offsetLeft - 16); }
  }
  /* Met, with this priority: on the phone at once, the follow-up date set to suit, sent behind. */
  async function metNow(id, p) {
    const m = S.met.find(x => x.id === id);
    if (!m) return;
    const x = Object.assign({}, m, { priority: p, metNow: true, status: 'new', nextDate: m.nextDate || D.addDays(today(), { '1': 3, '2': 14, '3': 30 }[p]) });
    ['_h', '_ck', '_pk', 'rfps', 'groups', 'refs', 'removed', 'created', 'updated', 'read', 'profile', 'selfie', 'card', 'sheet'].forEach(k => { delete x[k]; });
    Object.assign(m, { priority: p, planned: '', nextDate: x.nextDate });
    await API.keep();
    await API.queue({ a: 'met.save', body: { met: x }, after: 'met', local: m.id });
    UI.toast((m.name || m.company) + ' — met, priority ' + p + '. Tap the card to add a selfie or notes.');
    paint();
  }
  function countUp(root) {
    $$('[data-count]', root).forEach(el => {
      const to = +el.dataset.count;
      if (!to || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const t0 = performance.now(), dur = 800;
      const step = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(to * e); if (k < 1) requestAnimationFrame(step); };
      el.textContent = '0'; requestAnimationFrame(step);
    });
  }
  function tabs() {
    const n = MET.filter(m => m.check === 'yes').length;
    $('#tabs').innerHTML = [['dash', 'chart', 'Dashboard'], ['people', 'users', 'People'], ['companies', 'grid', 'Companies'], ['map', 'map', 'Map']].concat(n ? [['check', 'doc', 'To check']] : []).concat(isAdmin() ? [['admin', 'key', 'Admin']] : [])
      .map(t => '<button data-v="' + t[0] + '" class="' + (view === t[0] ? 'on' : '') + '">' + I(t[1], 'sm') + t[2] + (t[0] === 'check' ? ' <span class="n">' + n + '</span>' : '') + '</button>').join('');
    $$('[data-v]', $('#tabs')).forEach(b => b.onclick = () => go(b.dataset.v));
  }
  let CO = { rfp: false, q: '' };
  function go(v, o) {
    view = v;
    if (v === 'companies') CO = Object.assign({ rfp: false, q: '' }, o || {});
    history.replaceState(null, '', '#' + (v === 'dash' ? '' : v));
    paint();
    const t = $('#tabs'); if (t && window.scrollY > t.offsetTop) window.scrollTo({ top: t.offsetTop - 70, behavior: 'smooth' });
  }
  function reset() { Object.assign(F, { q: '', show: '', pr: '', loc: '', owner: '', status: 'open', due: false, todo: false, sort: 'new' }); }

  /* ══ Dashboard ════════════════════════════════════════════════════════ */
  function dash() {
    if (!S.shows.length) {
      $('#view').innerHTML = '<div class="card pad" style="text-align:center;padding:40px 20px"><div style="color:var(--jor)">' + I('pin', 'lg') + '</div><h3>No shows yet</h3><p class="sub">At the stand, press “Met someone”: the show is made as you go, and today’s date goes in by itself.</p><button class="btn p" id="first">' + I('camera', 'sm') + 'Met someone</button></div>';
      $('#first').onclick = () => capture();
      return;
    }
    const lk = links(), f = figures();
    const shows = S.shows.slice().sort((a, b) => (b.starts || '').localeCompare(a.starts || ''));
    const card = s => {
      const m = MET.filter(x => x.showId === s.id), n = m.length, c = p => m.filter(x => (x.priority || '0') === p).length, w = p => n ? (100 * c(p) / n).toFixed(1) : 0;
      const cos = new Set(m.map(x => x._ck).filter(Boolean)), rf = [...cos].filter(k => lk.companies[k] && lk.companies[k].rfps.some(j => j.reg >= s.starts)).length;
      const due = m.filter(x => x.status === 'new' && x.nextDate && x.nextDate <= today()).length, ck = m.filter(x => x.check === 'yes').length, pl = S.met.filter(x => x.showId === s.id && x.planned).length;
      const soon = s.starts && s.starts > today() ? D.diffDays(today(), s.starts) : 0;
      return '<div class="scard' + (isOn(s) ? ' is-on' : soon ? ' is-soon' : '') + '" data-show="' + esc(s.id) + '">' + (isOn(s) ? '<span class="on">ON TODAY</span>' : soon ? '<span class="on soon">' + (soon === 1 ? 'TOMORROW' : 'IN ' + soon + ' DAYS') + '</span>' : '') +
        '<div class="nm">' + esc(s.name) + '</div><div class="pl">' + esc([s.city, country(s.country)].filter(Boolean).join(', ')) + (s.starts ? ' · ' + esc(dates(s)) : '') + (soon && s.by && nameOf(s.by) ? ' · added by ' + esc(nameOf(s.by)) : '') + (s._local ? ' · sending…' : '') + '</div>' +
        '<div class="big"><b>' + n + '</b><span>' + (n === 1 ? 'person met' : 'people met') + ' · ' + cos.size + (cos.size === 1 ? ' company' : ' companies') + '</span></div>' +
        '<div class="pbar">' + ['1', '2', '3', '0'].map(p => '<i class="p' + p + '" style="width:' + w(p) + '%"></i>').join('') + '</div>' +
        '<div class="foot"><span>' + prBadge('1') + ' <b>' + c('1') + '</b></span><span>' + prBadge('2') + ' <b>' + c('2') + '</b></span><span>' + prBadge('3') + ' <b>' + c('3') + '</b></span>' +
        (rf ? '<span class="won">' + rf + (rf === 1 ? ' company' : ' companies') + ' sent an RFP</span>' : '') + (due ? '<span class="due late">' + due + ' due</span>' : '') + (ck ? '<span class="due">' + ck + ' to check</span>' : '') + (pl ? '<span class="due">' + pl + ' planned</span>' : '') + '</div></div>';
    };
    const bars = (rows, key) => { const max = Math.max(1, ...rows.map(r => r.n)); return rows.length ? rows.map(r => '<div class="hb" data-' + key + '="' + esc(r.k) + '"><span class="lb" title="' + esc(r.t) + '">' + esc(r.t) + '</span><span class="tr"><i data-w="' + (100 * r.n / max).toFixed(1) + '"></i></span><b>' + r.n + '</b></div>').join('') : '<p class="sub2">Nobody yet.</p>'; };
    const count = fn => { const o = {}; MET.forEach(m => { const k = fn(m); if (k) o[k] = (o[k] || 0) + 1; }); return Object.keys(o).map(k => ({ k, n: o[k] })).sort((a, b) => b.n - a.n); };
    const perShow = shows.map(s => ({ k: s.id, t: s.name, n: MET.filter(m => m.showId === s.id).length })).filter(x => x.n).sort((a, b) => b.n - a.n).slice(0, 8);
    const from = count(m => m.country).slice(0, 8).map(x => Object.assign(x, { t: country(x.k) }));
    const regions = count(m => REGION_OF[m.country]).map(x => Object.assign(x, { t: REGIONS[x.k] }));
    const who = count(m => m.by).slice(0, 8).map(x => Object.assign(x, { t: nameOf(x.k) || 'Someone who has left' }));
    const tagCount = {};
    MET.forEach(m => String(m.tags || '').split(/\s*,\s*/).filter(Boolean).forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1; }));
    const topTags = Object.keys(tagCount).sort((a, b) => tagCount[b] - tagCount[a]).slice(0, 16);
    const pct = (a, b) => b ? Math.round(100 * a / b) + '%' : '–';
    const again = Object.values(lk.people).filter(l => new Set(l.map(m => m.showId)).size > 1).length;
    $('#view').innerHTML = '<div class="sh-grid">' + shows.map(card).join('') + '</div><div class="panels">' +
      '<div class="panel"><h3>What came of it</h3><p class="sub2">Everyone met, the companies they work for, and what JORIS has had from those companies since.' + (S.linked ? '' : ' (JORIS isn’t linked yet.)') + '</p><div class="funnel">' +
      '<div><b>' + f.met + '</b><span>people met</span><em>' + f.companies + ' companies</em></div><div><b>' + f.followed + '</b><span>followed up</span><em>' + pct(f.followed, f.met) + '</em></div>' +
      '<div><b>' + f.rfpCos + '</b><span>companies sent an RFP</span><em>' + pct(f.rfpCos, f.companies) + '</em></div><div><b>' + f.groupCos + '</b><span>became a group</span><em>' + pct(f.groupCos, f.companies) + '</em></div></div>' +
      '<p class="sub2" style="margin:10px 0 0">' + (f.due ? '<a href="#" id="seedue">' + f.due + ' follow-up' + (f.due === 1 ? ' is' : 's are') + ' due or late</a> · ' : '') + again + (again === 1 ? ' person' : ' people') + ' met at more than one show</p></div>' +
      '<div class="panel"><h3>People met at each show</h3><p class="sub2">Tap one to see who.</p>' + bars(perShow, 'show') + '</div>' +
      '<div class="panel"><h3>Where they are from</h3><p class="sub2">' + regions.map(r => esc(r.t) + ' ' + r.n).join(' · ') + '</p>' + bars(from, 'country') + '</div>' +
      '<div class="panel"><h3>Who met them</h3><p class="sub2">Everyone at the stand, and the sheets they brought back.</p>' + bars(who, 'by') + '</div>' +
      (topTags.length ? '<div class="panel" style="grid-column:1/-1"><h3>What they asked about</h3><p class="sub2">Keywords Gemini took from the notes. Tap one to find everyone who mentioned it.</p><div>' +
        topTags.map(t => '<button class="chip" data-tag="' + esc(t) + '" style="margin:0 6px 6px 0">' + esc(t) + ' <b style="color:var(--jor-dark)">' + tagCount[t] + '</b></button>').join('') + '</div></div>' : '') + '</div>';
    requestAnimationFrame(() => $$('.hb i').forEach(i => { i.style.width = i.dataset.w + '%'; }));
    $$('[data-show]').forEach(c => c.onclick = () => { reset(); F.show = c.dataset.show; F.status = ''; go('people'); });
    $$('[data-country]').forEach(c => c.onclick = () => { reset(); F.loc = 'c:' + c.dataset.country; F.status = ''; go('people'); });
    $$('[data-by]').forEach(c => c.onclick = () => { reset(); F.q = nameOf(c.dataset.by); F.status = ''; go('people'); });
    $$('[data-tag]').forEach(c => c.onclick = () => { reset(); F.q = c.dataset.tag; F.status = ''; go('people'); });
    const sd = $('#seedue'); if (sd) sd.onclick = e => { e.preventDefault(); reset(); F.due = true; go('people'); };
  }

  /* ══ People: one search box for everything ═══════════════════════════ */
  function people() {
    const opt = (v, t, cur) => '<option value="' + esc(v) + '"' + (cur === v ? ' selected' : '') + '>' + esc(t) + '</option>';
    $('#view').innerHTML = '<div class="sh-search">' + I('search') + '<input id="q" type="search" autocomplete="off" placeholder="Name, company, place, month, notes…" value="' + esc(F.q) + '"></div>' +
      '<div class="sh-filters"><select id="fshow">' + opt('', 'Every show', F.show) + S.shows.slice().sort((a, b) => (b.starts || '').localeCompare(a.starts || '')).map(s => opt(s.id, s.name, F.show)).join('') + '</select>' +
      ['', '1', '2', '3'].map(p => '<button class="chip' + (F.pr === p ? ' on' : '') + '" data-pr="' + p + '">' + (p ? prBadge(p) + ' ' + PRN[p] : 'Any priority') + '</button>').join('') +
      locSelect(opt) +
      '<select id="fown">' + opt('', 'Anyone’s', F.owner) + opt(S.me.id, 'Mine to follow up', F.owner) + S.people.filter(p => p.id !== S.me.id).map(p => opt(p.id, p.name, F.owner)).join('') + '</select>' +
      '<select id="fst">' + [['open', 'To follow up'], ['', 'Every status'], ['done', 'Followed up'], ['cold', 'Gone cold']].map(o => opt(o[0], o[1], F.status)).join('') + '</select>' +
      '<button class="chip' + (F.due ? ' on' : '') + '" id="fdue">' + I('clock', 'sm') + 'Due now</button>' +
      '<select id="fsort">' + [['new', 'Newest first'], ['pr', 'Priority'], ['due', 'Follow-up date'], ['az', 'Company A–Z']].map(o => opt(o[0], o[1], F.sort)).join('') + '</select></div>' +
      '<p class="sh-count" id="count"></p><div class="mlist" id="mlist"></div>';
    const q = $('#q');
    q.oninput = () => { F.q = q.value; clearTimeout(q._t); q._t = setTimeout(list, 100); };
    [['fshow', 'show'], ['floc', 'loc'], ['fown', 'owner'], ['fst', 'status'], ['fsort', 'sort']].forEach(([id, k]) => { $('#' + id).onchange = e => { F[k] = e.target.value; list(); }; });
    $('#fdue').onclick = () => { F.due = !F.due; $('#fdue').classList.toggle('on', F.due); list(); };
    $$('[data-pr]').forEach(b => b.onclick = () => { F.pr = b.dataset.pr; $$('[data-pr]').forEach(x => x.classList.toggle('on', x === b)); list(); });
    list();
  }
  /* Location: where they are from (a part of the world, or a country), or where we met them (the show's city). */
  const placeOf = s => s.city || country(s.country) || '';
  function locSelect(opt) {
    const from = {}, at = {};
    MET.forEach(m => { if (m.country) from[m.country] = (from[m.country] || 0) + 1; const p = placeOf(showOf(m.showId)); if (p) at[fold(p)] = at[fold(p)] || p; });
    S.shows.forEach(s => { const p = placeOf(s); if (p && !at[fold(p)]) at[fold(p)] = p; });
    const regs = Object.keys(REGIONS).filter(r => Object.keys(from).some(c => REGION_OF[c] === r));
    const byName = (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' });
    return '<select id="floc" title="Location">' + opt('', 'Anywhere', F.loc) +
      (regs.length ? '<optgroup label="Where they’re from">' + regs.map(r => opt('r:' + r, REGIONS[r], F.loc)).join('') +
        Object.keys(from).sort((a, b) => byName(country(a), country(b))).map(c => opt('c:' + c, country(c) + ' (' + from[c] + ')', F.loc)).join('') + '</optgroup>' : '') +
      (Object.keys(at).length ? '<optgroup label="Where we met them">' + Object.keys(at).sort((a, b) => byName(at[a], at[b])).map(k => opt('s:' + k, 'Met in ' + at[k], F.loc)).join('') + '</optgroup>' : '') + '</select>';
  }
  function inLoc(m, v) {
    const k = v.slice(2);
    return v[0] === 'r' ? REGION_OF[m.country] === k : v[0] === 'c' ? m.country === k : fold(placeOf(showOf(m.showId))) === k;
  }
  function hay(m) {
    const s = showOf(m.showId);
    return fold([m.name, m.company, m.title, m.email, m.phone, m.city, country(m.country), m.country, REGIONS[REGION_OF[m.country]], s.name, s.city, country(s.country),
      m.notes, m.read, m.tags, m.summary, m.nextStep, m.others, m.profile, m.slot, nameOf(m.by), nameOf(m.owner), (m.refs || []).join(' '), m.priority ? 'p' + m.priority : '',
      whenWords(m.met), m.website, String(m.phone || '').replace(/\D/g, '')].join('   '));
  }
  /* "March", "Mar 2026", "2026": the month they were met is something people remember. */
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function whenWords(d) {
    const x = /^(\d{4})-(\d{2})/.exec(d || '');
    return x ? MONTHS[+x[2] - 1] + ' ' + x[1] + ' ' + MONTHS[+x[2] - 1].slice(0, 3) + ' ' + d : '';
  }
  function filtered(anyStatus) {
    links();
    const words = fold(F.q).split(/\s+/).filter(Boolean);
    const out = MET.filter(m => {
      if (F.show && m.showId !== F.show) return false;
      if (F.pr && m.priority !== F.pr) return false;
      if (F.loc && !inLoc(m, F.loc)) return false;
      if (F.owner && (m.owner || m.by) !== F.owner) return false;
      if (!anyStatus && (F.status === 'open' ? m.status !== 'new' : F.status && m.status !== F.status)) return false;
      if (F.todo && !unfinished(m)) return false;
      if (F.due && !(m.status === 'new' && m.nextDate && m.nextDate <= today())) return false;
      if (words.length) { const h = m._h || (m._h = hay(m)); if (!words.every(w => h.indexOf(w) >= 0)) return false; }
      return true;
    });
    const by = { new: (a, b) => (b.met + b.created).localeCompare(a.met + a.created), pr: (a, b) => (a.priority || '9').localeCompare(b.priority || '9') || b.met.localeCompare(a.met),
      due: (a, b) => (a.nextDate || '9999').localeCompare(b.nextDate || '9999'), az: (a, b) => (a.company || a.name || '').localeCompare(b.company || b.name || '', undefined, { sensitivity: 'base', numeric: true }) };
    return out.sort(by[F.sort] || by.new);
  }
  function mark(text, words) {
    let h = esc(text);
    words.filter(w => w.length > 1).forEach(w => { h = h.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>'); });
    return h;
  }
  function noteHit(m, words) {
    if (!words.length) return '';
    const plain = fold([m.name, m.company, m.title, m.email, showOf(m.showId).name].join(' '));
    if (words.every(w => plain.indexOf(w) >= 0)) return '';
    const src = [m.notes, m.read, m.summary].filter(Boolean).join(' · '), f = fold(src), w = words.find(x => f.indexOf(x) >= 0);
    if (!w) return '';
    const at = f.indexOf(w), a = Math.max(0, at - 40), b = Math.min(src.length, at + w.length + 60);
    return (a ? '…' : '') + mark(src.slice(a, b), words) + (b < src.length ? '…' : '');
  }
  function row(m, words) {
    const s = showOf(m.showId), hit = noteHit(m, words || []), late = m.status === 'new' && m.nextDate && m.nextDate < today(), pic = m.selfie || m.card || m.sheet;
    const others = (links().people[m._pk] || []).filter(x => x.id !== m.id).length;
    words = words || [];
    return '<div class="mrow' + (m._local ? ' local' : '') + '" data-id="' + esc(m.id) + '"><div class="av2"' + (pic ? ' data-thumb="' + esc(pic) + '"' : '') + '>' + (m._photo ? '<img alt="" src="' + m._photo + '">' : esc(initials(m))) + '</div>' +
      '<div class="bd"><b>' + mark(m.name || m.company || (m.sheet ? 'To be typed in from the sheet' : 'Someone met — add who'), words) + (m.name && m.company ? ' <span style="font-weight:400;color:var(--ink-2)">· ' + mark(m.company, words) + '</span>' : '') + '</b>' +
      '<div class="l2">' + mark(s.name, words) + ' · ' + esc(UI.nice(m.met, true)) + (m.country ? ' · ' + mark(country(m.country), words) : '') + (others ? ' · <span class="again">met ' + (others + 1) + ' times</span>' : '') + '</div>' +
      '<div class="l3">' + (hit ? I('search', 'sm') + ' ' + hit : esc(m.summary || m.nextStep || m.notes || '')) + '</div>' +
      (m.tags ? '<div>' + String(m.tags).split(/\s*,\s*/).slice(0, 5).map(t => '<span class="tagc">' + mark(t, words) + '</span>').join('') + '</div>' : '') + '</div>' +
      '<div class="rt">' + prBadge(m.priority) + (m._local ? '<span class="pill warn">Sending…</span>' : m.check === 'yes' ? '<span class="pill warn">To check</span>' : unfinished(m) ? '<span class="pill warn">To finish</span>' : m.status !== 'new' ? '<span class="pill">' + STATUS[m.status] + '</span>' : '') +
      (m.groups ? '<span class="won">' + m.groups + ' group' + (m.groups === 1 ? '' : 's') + '</span>' : m.rfps ? '<span class="won">' + m.rfps + ' RFP' + (m.rfps === 1 ? '' : 's') + '</span>' : '') +
      (m.status === 'new' && m.nextDate ? '<span class="due' + (late ? ' late' : '') + '">' + I('clock', 'sm') + ' ' + esc(UI.when(m.nextDate)) + '</span>' : '') + '</div></div>';
  }
  function list() {
    const rows = filtered(), words = fold(F.q).split(/\s+/).filter(Boolean), shown = rows.slice(0, 300);
    /* Searching for someone: those already followed up (or gone cold) are said, one tap away. */
    const more = F.status && (F.q || F.loc) ? filtered(true).length - rows.length : 0;
    $('#count').innerHTML = esc(rows.length + (rows.length === 1 ? ' person' : ' people') + (F.show ? ' met at ' + showOf(F.show).name : '') + (F.q ? ' matching “' + F.q + '”' : '') + (F.todo ? ' still to finish' : '')) +
      (more > 0 ? ' · <a href="#" id="allst">' + more + ' more already followed up or gone cold — show them</a>' : '');
    const al = $('#allst'); if (al) al.onclick = e => { e.preventDefault(); F.status = ''; $('#fst').value = ''; list(); };
    $('#mlist').innerHTML = shown.length ? shown.map(m => row(m, words)).join('') + (rows.length > shown.length ? '<p class="sh-count">… and ' + (rows.length - shown.length) + ' more — search to narrow it down.</p>' : '') :
      '<div class="empty">' + (MET.length ? 'Nobody matches that. Try fewer words, or “Every status”.' : 'Nobody met yet.') + '</div>';
    $$('#mlist .mrow').forEach(r => r.onclick = () => openMet(r.dataset.id));
    thumbs($('#mlist'));
  }

  /* ══ Companies: everyone at each, every show they were met at, and what JORIS has had from them ══ */
  function companies() {
    const lk = links();
    $('#view').innerHTML = '<div class="sh-search">' + I('search') + '<input id="cq" type="search" autocomplete="off" placeholder="Search companies, people, emails, countries" value="' + esc(CO.q) + '"></div>' +
      '<div class="sh-filters"><button class="chip' + (CO.rfp ? ' on' : '') + '" id="crfp">' + I('check', 'sm') + 'Sent an RFP</button></div><p class="sh-count" id="ccount"></p><div class="mlist" id="clist"></div>';
    const draw = () => {
      const words = fold(CO.q).split(/\s+/).filter(Boolean);
      const rows = Object.values(lk.companies).filter(c => {
        if (CO.rfp && !c.rfps.length) return false;
        if (!words.length) return true;
        const h = fold([c.name, c.key, Object.keys(c.countries).map(country).join(' ')].concat(c.met.map(m => [m.name, m.email, m.title].join(' '))).join(' '));
        return words.every(w => h.indexOf(w) >= 0);
      }).sort((a, b) => b.groups.length - a.groups.length || b.rfps.length - a.rfps.length || (a.best || '9').localeCompare(b.best || '9') || b.met.length - a.met.length);
      $('#ccount').textContent = rows.length + (rows.length === 1 ? ' company' : ' companies');
      $('#clist').innerHTML = rows.slice(0, 300).map(c => '<div class="mrow" data-co="' + esc(c.key) + '"><div class="av2 co">' + esc((c.name || '?').slice(0, 2).toUpperCase()) + '</div><div class="bd"><b>' + mark(c.name, words) + '</b>' +
        '<div class="l2">' + Object.keys(c.people).length + (Object.keys(c.people).length === 1 ? ' person' : ' people') + ' · ' + Object.keys(c.shows).length + (Object.keys(c.shows).length === 1 ? ' show' : ' shows') +
        (Object.keys(c.countries).length ? ' · ' + esc(Object.keys(c.countries).map(country).join(', ')) : '') + '</div>' +
        '<div class="l3">' + esc(Object.keys(c.shows).map(id => showOf(id).name).join(' · ')) + '</div></div><div class="rt">' + prBadge(c.best) +
        (c.groups.length ? '<span class="won">' + c.groups.length + ' group' + (c.groups.length === 1 ? '' : 's') + '</span>' : c.rfps.length ? '<span class="won">' + c.rfps.length + ' RFP' + (c.rfps.length === 1 ? '' : 's') + '</span>' : '') +
        '<span class="due">last met ' + esc(UI.nice(c.last, true)) + '</span></div></div>').join('') || '<div class="empty">No companies match.</div>';
      $$('[data-co]').forEach(r => r.onclick = () => openCompany(r.dataset.co));
    };
    $('#cq').oninput = e => { CO.q = e.target.value; clearTimeout(draw._t); draw._t = setTimeout(draw, 100); };
    $('#crfp').onclick = () => { CO.rfp = !CO.rfp; $('#crfp').classList.toggle('on', CO.rfp); draw(); };
    draw();
  }
  function openCompany(key) {
    const c = links().companies[key];
    if (!c) return;
    const byPerson = {};
    c.met.forEach(m => { (byPerson[m._pk] = byPerson[m._pk] || []).push(m); });
    const d = UI.dialog({
      title: c.name, wide: true,
      body: '<div class="cohead"><div><b>' + Object.keys(byPerson).length + '</b><span>people</span></div><div><b>' + Object.keys(c.shows).length + '</b><span>shows</span></div><div><b>' + c.rfps.length + '</b><span>RFPs since first met</span></div><div><b>' + c.groups.length + '</b><span>groups</span></div></div>' +
        (c.rfps.length ? '<p class="okbox">' + I('check', 'sm') + ' In JORIS since ' + esc(UI.nice(c.first, true)) + ': ' + c.rfps.map(j => esc(j.ref) + ' (' + esc(j.status) + ')').join(', ') + '</p>' : S.linked ? '' : '<p class="mini" style="color:var(--ink-3)">JORIS isn’t linked yet, so RFPs from them don’t show here.</p>') +
        '<h4 style="margin:14px 0 6px">Who we met</h4><div class="mlist">' + Object.values(byPerson).map(list => list.sort((a, b) => b.met.localeCompare(a.met))).sort((a, b) => b[0].met.localeCompare(a[0].met)).map(list => row(list[0]) +
          (list.length > 1 ? '<p class="mini metagain">Also met at ' + list.slice(1).map(m => esc(showOf(m.showId).name) + ' (' + esc(UI.nice(m.met, true)) + ')').join(', ') + '</p>' : '')).join('') + '</div>',
      on: el => { $$('.mrow', el).forEach(r => r.onclick = () => { d.close(); openMet(r.dataset.id); }); thumbs(el); }
    });
  }

  /* ══ Pictures for the lists: kept on the phone once seen ══════════════ */
  const TH = {};
  async function thumbs(root) {
    const els = $$('[data-thumb]', root);
    const put = () => els.forEach(e => { const d = TH[e.dataset.thumb]; if (!d || e.querySelector('img')) return; if (e.classList.contains('av2')) e.innerHTML = '<img alt="" src="' + d + '">'; else e.insertAdjacentHTML('afterbegin', '<img alt="" src="' + d + '">'); });
    const want = [...new Set(els.map(e => e.dataset.thumb))].filter(id => !(id in TH));
    for (const id of want) { try { const v = await API.thumbs.get(id); if (v !== undefined) TH[id] = v; } catch (e) { } }
    put();
    const ask = want.filter(id => !(id in TH));
    for (let i = 0; i < ask.length; i += 150) {
      try { const r = await API.call('met.thumbs', { ids: ask.slice(i, i + 150) }); for (const id of ask.slice(i, i + 150)) { TH[id] = r.thumbs[id] || ''; API.thumbs.put(id, TH[id]).catch(() => { }); } put(); } catch (e) { return; }
    }
  }

  /* ══ The map ══════════════════════════════════════════════════════════ */
  const NE = { R: 182.0835, cx: 499.9995, cy: 258.9909 };
  function proj(lat, lng) {
    const l = lng * Math.PI / 180, p = lat * Math.PI / 180, p2 = p * p, p4 = p2 * p2;
    const x = l * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * p2 * (0.003971 - 0.001529 * p2)));
    const y = p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)));
    return [NE.cx + NE.R * x, NE.cy - NE.R * y];
  }
  function mapView() {
    const W = window.JOR_WORLD;
    if (!W) { $('#view').innerHTML = '<div class="empty">The map didn’t load.</div>'; return; }
    const from = {};
    MET.forEach(m => { if (m.country) from[m.country] = (from[m.country] || 0) + 1; });
    const maxFrom = Math.max(1, ...Object.values(from)), used = {};
    const pins = S.shows.map(s => {
      let at = s.lat !== null && s.lat !== undefined && s.lng !== null ? proj(s.lat, s.lng) : W.centroids[s.country] ? W.centroids[s.country].slice() : null;
      if (!at) return null;
      const k = Math.round(at[0] / 4) + ':' + Math.round(at[1] / 4);
      if (used[k]) at = [at[0] + 3.5 * used[k], at[1] - 2.5 * used[k]];
      used[k] = (used[k] || 0) + 1;
      return { s, at, n: MET.filter(m => m.showId === s.id).length };
    }).filter(Boolean).sort((a, b) => b.n - a.n);
    const maxN = Math.max(1, ...pins.map(p => p.n));
    const pts = MAPV.mode === 'shows' ? pins.map(p => p.at) : Object.keys(from).map(c => W.centroids[c]).filter(Boolean);
    if (W.centroids.IE) pts.push(W.centroids.IE);
    let x0 = Math.min(...pts.map(p => p[0])) - 60, x1 = Math.max(...pts.map(p => p[0])) + 60, y0 = Math.min(...pts.map(p => p[1])) - 45, y1 = Math.max(...pts.map(p => p[1])) + 40;
    let w = Math.max(x1 - x0, 300), h = Math.max(y1 - y0, w / 2.25);
    w = Math.min(W.w, Math.max(w, h * 2.25)); h = Math.min(W.h, h);
    const vx = Math.max(0, Math.min(W.w - w, (x0 + x1) / 2 - w / 2)), vy = Math.max(0, Math.min(W.h - h, (y0 + y1) / 2 - h / 2)), u = w / 700;
    let svg = '<svg viewBox="' + [vx, vy, w, h].map(v => v.toFixed(1)).join(' ') + '" style="--sw:' + (0.5 * u).toFixed(2) + '" role="img" aria-label="Map of the shows and where the people met come from">';
    Object.keys(W.paths).forEach(c => {
      const n = from[c];
      svg += n ? '<path class="from" data-c="' + c + '" d="' + W.paths[c] + '" style="fill:#2BC48A;fill-opacity:' + (MAPV.mode === 'shows' ? 0.12 + 0.3 * Math.sqrt(n / maxFrom) : 0.25 + 0.7 * Math.sqrt(n / maxFrom)).toFixed(2) + '"></path>' : '<path class="land" d="' + W.paths[c] + '"></path>';
    });
    if (MAPV.mode === 'shows') {
      const rad = p => (3.5 + 10 * Math.sqrt(p.n / maxN)) * u;
      pins.forEach(p => { svg += '<circle class="pin" data-s="' + esc(p.s.id) + '" cx="' + p.at[0].toFixed(1) + '" cy="' + p.at[1].toFixed(1) + '" r="' + rad(p).toFixed(2) + '" style="stroke-width:' + (1.3 * u).toFixed(2) + '"></circle>'; });
      const fs = 11 * u, placed = pins.map(p => ({ x: p.at[0] - rad(p), y: p.at[1] - rad(p), w: 2 * rad(p), h: 2 * rad(p), pin: p })), hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      pins.forEach(p => {
        const r = rad(p), text = p.s.name + ' · ' + p.n, tw = text.length * fs * 0.56, th = fs * 1.15;
        const fit = [[p.at[0] + r + 3 * u, p.at[1] - th / 2], [p.at[0] - tw / 2, p.at[1] - r - 2 * u - th], [p.at[0] - tw / 2, p.at[1] + r + 2 * u], [p.at[0] - r - 3 * u - tw, p.at[1] - th / 2]]
          .map(t => ({ x: t[0], y: t[1], w: tw, h: th })).find(b => b.x >= vx + 2 * u && b.x + b.w <= vx + w - 2 * u && b.y >= vy && b.y + b.h <= vy + h && !placed.some(o => o.pin !== p && hit(b, o)));
        if (!fit) return;
        placed.push(fit);
        svg += '<text class="pn" x="' + fit.x.toFixed(1) + '" y="' + (fit.y + th * 0.8).toFixed(1) + '" style="font-size:' + fs.toFixed(2) + 'px;stroke-width:' + (3 * u).toFixed(2) + '">' + esc(text) + '</text>';
      });
    }
    svg += '</svg>';
    const showsSorted = S.shows.slice().sort((a, b) => (b.starts || '').localeCompare(a.starts || '')), topFrom = Object.keys(from).sort((a, b) => from[b] - from[a]);
    $('#view').innerHTML = '<div class="maptools"><button class="chip' + (MAPV.mode === 'shows' ? ' on' : '') + '" data-mode="shows">' + I('pin', 'sm') + 'Where the shows were</button>' +
      '<button class="chip' + (MAPV.mode === 'from' ? ' on' : '') + '" data-mode="from">' + I('users', 'sm') + 'Where the people are from</button></div>' +
      '<div class="two2"><div><div class="mapwrap" id="mapbox">' + svg + '<div class="tip" id="tip"></div></div></div><div class="slist">' +
      (MAPV.mode === 'shows' ? showsSorted.map(s => '<a href="#" data-s="' + esc(s.id) + '">' + I('pin') + '<div><b>' + esc(s.name) + '</b><span>' + (s.country || s.lat !== null ? esc([s.city, country(s.country)].filter(Boolean).join(', ')) : '<b style="color:var(--err)">Not on the map — tap ✎ to say where</b>') + ' · ' + esc(dates(s)) + '</span></div><span class="n">' + MET.filter(m => m.showId === s.id).length + '</span>' + (s._local ? '' : '<button class="btn sm" data-edit="' + esc(s.id) + '" title="Change the show">✎</button>') + '</a>').join('')
        : topFrom.map(c => '<a href="#" data-c="' + esc(c) + '">' + I('users') + '<div><b>' + esc(country(c)) + '</b><span>' + esc(REGIONS[REGION_OF[c]] || '') + '</span></div><span class="n">' + from[c] + '</span></a>').join('') || '<div class="empty">No countries yet.</div>') + '</div></div>';
    $$('[data-mode]').forEach(b => b.onclick = () => { MAPV.mode = b.dataset.mode; mapView(); });
    const tip = $('#tip'), box = $('#mapbox');
    box.addEventListener('mousemove', e => {
      const t = e.target.closest('[data-s],[data-c]');
      if (!t) { tip.style.display = 'none'; return; }
      const r = box.getBoundingClientRect();
      if (t.dataset.s) { const s = showOf(t.dataset.s); tip.innerHTML = '<b>' + esc(s.name) + '</b> · ' + MET.filter(m => m.showId === s.id).length + ' met<br>' + esc([s.city, country(s.country)].filter(Boolean).join(', ')) + ' · ' + esc(dates(s)); }
      else tip.innerHTML = '<b>' + esc(country(t.dataset.c)) + '</b> · ' + (from[t.dataset.c] || 0) + ' met';
      tip.style.display = 'block'; tip.style.left = Math.min(r.width - 220, e.clientX - r.left + 12) + 'px'; tip.style.top = (e.clientY - r.top + 12) + 'px';
    });
    box.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
    $$('[data-s]').forEach(el => el.addEventListener('click', e => { e.preventDefault(); if (e.target.closest('[data-edit]')) return; reset(); F.show = el.dataset.s; F.status = ''; go('people'); }));
    $$('[data-edit]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); editShow(b.dataset.edit); }));
    $$('[data-c]').forEach(el => el.addEventListener('click', e => { e.preventDefault(); reset(); F.loc = 'c:' + el.dataset.c; F.status = ''; go('people'); }));
  }

  /* A show changed: its name, where it is (city and country — the map follows), its dates. Needs signal. */
  function editShow(id) {
    const s = S.shows.find(x => x.id === id);
    if (!s) return;
    UI.dialog({ title: 'Change the show', wide: true,
      body: '<div class="g2">' + UI.field('Name', '<input class="in" name="ename" value="' + esc(s.name) + '">') + UI.field('City', '<input class="in" name="ecity" value="' + esc(s.city || '') + '">') + '</div>' +
        '<div class="g3">' + UI.field('Country', UI.pick('ecountry', 'country', s.country || '')) + UI.field('Starts', '<input class="in" type="date" name="estarts" value="' + esc(s.starts || '') + '">') + UI.field('Ends', '<input class="in" type="date" name="eends" value="' + esc(s.ends || '') + '">') + '</div>',
      foot: (isAdmin() ? '<button class="btn dngr" data-rm>' + I('trash', 'sm') + 'Remove this show</button><span style="flex:1"></span>' : '') + '<button class="btn" data-x>Cancel</button><button class="btn p" data-ok>Save the show</button>',
      on: (el, close) => {
        const rm = el.querySelector('[data-rm]');
        if (rm) rm.onclick = async () => {
          const n = S.met.filter(m => m.showId === s.id).length;
          if (!(await UI.confirm('Remove ' + s.name + '?', n ? 'The ' + n + (n === 1 ? ' person' : ' people') + ' met at it go too. For a test show, or one made by mistake. (Admin › Removed can put a person back.)' : 'Nobody was met at it.', 'Remove the show', true))) return;
          try {
            await API.call('show.remove', { id: s.id, withPeople: true });
            S.shows = S.shows.filter(x => x.id !== s.id); S.met = S.met.filter(m => m.showId !== s.id);
            await API.keep(); close(); paint(); UI.toast(s.name + ' removed.');
          } catch (e) { UI.toast(e.offline ? 'This needs signal — try again in a moment.' : e.message, 6000); }
        };
        el.querySelector('[data-ok]').onclick = async () => {
          const v = n => el.querySelector('[name=' + n + ']').value.trim();
          try {
            const r = await API.call('show.save', { show: { id: s.id, name: v('ename'), city: v('ecity'), country: v('ecountry'), starts: v('estarts'), ends: v('eends') } });
            Object.assign(s, r.show); await API.keep(); close(); paint(); UI.toast('Saved' + (r.show.lat !== null ? ' — it’s on the map.' : r.show.country ? ' — on the map in the middle of its country.' : '.'));
          } catch (e) { UI.toast(e.offline ? 'This needs signal — try again in a moment.' : e.message, 6000); }
        };
      } });
  }

  /* A trade show added ahead of time — by anyone on the team. It is on this phone at once and goes to
     everyone's phone within a minute; on its days "Met someone" has it picked already. Works with no signal. */
  function addShow() {
    UI.dialog({ title: 'Add a trade show', wide: true,
      body: '<p class="sub2" style="margin:0 0 12px">Everyone on the team sees it on their phone within a minute. On the days it’s on, “Met someone” has it picked already.</p>' +
        '<div class="g2">' + UI.field('Name of the show or conference *', '<input class="in" name="aname" autocomplete="off" placeholder="e.g. ITB Berlin 2027">') + UI.field('City *', '<input class="in" name="acity" autocomplete="off" placeholder="e.g. Berlin">') + '</div>' +
        '<div class="g3">' + UI.field('Country', UI.pick('acountry', 'country', '')) + UI.field('Starts *', '<input class="in" type="date" name="astarts">') + UI.field('Ends', '<input class="in" type="date" name="aends">') + '</div>',
      foot: '<button class="btn" data-x>Cancel</button><button class="btn p" data-ok>' + I('check', 'sm') + 'Add the show</button>',
      on: (el, close) => {
        const f = n => el.querySelector('[name=' + n + ']'), v = n => f(n).value.trim();
        f('astarts').addEventListener('change', () => { if (!f('aends').value || f('aends').value < f('astarts').value) f('aends').value = f('astarts').value; });
        setTimeout(() => f('aname').focus(), 50);
        el.querySelector('[data-ok]').onclick = async () => {
          try {
            if (!v('aname')) { f('aname').classList.add('need'); throw new Error('Give the show a name — like “ITB Berlin 2027”.'); }
            if (!v('acity') && !v('acountry')) { f('acity').classList.add('need'); throw new Error('Where is it? Type the city.'); }
            if (!v('astarts')) { f('astarts').classList.add('need'); throw new Error('When does it start?'); }
            const ends = v('aends') || v('astarts');
            if (ends < v('astarts')) throw new Error('It ends before it starts.');
            const twin = S.shows.find(s => s.name.toLowerCase() === v('aname').toLowerCase());
            if (twin) throw new Error(twin.name + ' is in already' + (twin.starts ? ' (' + dates(twin) + ')' : '') + '.');
            const key = uid(), local = 'sh' + key;
            const show = { local, key, name: v('aname'), city: v('acity'), country: v('acountry'), starts: v('astarts'), ends };
            S.shows.push({ id: local, name: show.name, city: show.city, country: show.country, starts: show.starts, ends: show.ends, lat: null, lng: null, by: S.me.id, _local: true });
            await API.keep();
            await API.queue({ a: 'show.save', body: { show }, after: 'show' });
            close(); paint();
            UI.toast(show.name + ' added — everyone will see it.');
          } catch (e) { UI.toast(e.message, 6000); }
        };
      } });
  }

  /* ══ Photos: turned the right way, made smaller, a thumbnail beside ══ */
  async function prepImage(file, long) {
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (e) { bmp = await new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => no(new Error('That isn’t a photo this phone can open.')); im.src = URL.createObjectURL(file); }); }
    return fromCanvas(draw(bmp, long || 1600));
  }
  function draw(src, long) {
    const s = Math.min(1, long / Math.max(src.width, src.height)), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(src.width * s)); c.height = Math.max(1, Math.round(src.height * s));
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(src, 0, 0, c.width, c.height);
    return c;
  }
  function fromCanvas(c) {
    const url = c.toDataURL('image/jpeg', 0.84), t = draw(c, 180);
    let thumb = t.toDataURL('image/jpeg', 0.7);
    if (thumb.length > 38000) thumb = t.toDataURL('image/jpeg', 0.45);
    return { data: url.slice(url.indexOf(',') + 1), url, thumb };
  }

  /* ══ The form for someone met ═════════════════════════════════════════ */
  function personForm(m, isNew) {
    const s = m.showId || defaultShow();
    const showOpts = S.shows.slice().sort((a, b) => (b.starts || '').localeCompare(a.starts || '')).map(x => '<option value="' + esc(x.id) + '"' + (x.id === s ? ' selected' : '') + '>' + esc(x.name) + (isOn(x) ? ' — on today' : '') + '</option>').join('') + '<option value="+">＋ A new show…</option>';
    const ownOpts = S.people.map(p => '<option value="' + esc(p.id) + '"' + ((m.owner || S.me.id) === p.id ? ' selected' : '') + '>' + esc(p.id === S.me.id ? p.name + ' (me)' : p.name) + '</option>').join('');
    return '<div class="cap">' +
      '<div class="showline">' + UI.field('Show or conference', '<select class="in" name="showId">' + showOpts + '</select>') + UI.field('Met on', '<input class="in" type="date" name="met" value="' + esc(m.met || today()) + '">') + '</div>' +
      '<div class="newshow hidden" id="newshow"><div class="g2">' + UI.field('Name of the show', '<input class="in" name="sname" placeholder="e.g. ITB Berlin 2027">') + UI.field('City', '<input class="in" name="scity" placeholder="e.g. Berlin">') + '</div>' +
      '<div class="g3">' + UI.field('Country', UI.pick('scountry', 'country', '')) + UI.field('Starts', '<input class="in" type="date" name="sstarts" value="' + esc(today()) + '">') + UI.field('Ends', '<input class="in" type="date" name="sends" value="' + esc(today()) + '">') + '</div></div>' +
      (isNew ? '<div class="shots">' + shotBox('selfie', 'selfie', 'Selfie with them', 'so you know them next time', 'user') +
        shotBox('card', 'camera', 'Their card or the notes', S.reading ? 'Gemini reads it for you' : 'kept with them', 'environment') + '</div><div id="readbox"></div>' : '') +
      '<div class="g2">' + UI.field('Company', '<input class="in" name="company" autocomplete="off" value="' + esc(m.company || '') + '">') + UI.field('Person met', '<input class="in" name="name" autocomplete="off" value="' + esc(m.name || '') + '">') + '</div>' +
      '<div id="before"></div>' +
      '<label class="f" style="margin-bottom:4px"><span>Priority — 1 is the most important</span></label><div class="seg" style="margin-bottom:12px">' + ['1', '2', '3'].map(p => '<button type="button" data-p="' + p + '" class="p' + p + (m.priority === p ? ' on' : '') + '">' + p + '<span>' + PRN[p] + '</span></button>').join('') + '</div><input type="hidden" name="priority" value="' + esc(m.priority || '') + '">' +
      '<p class="optional">' + (isNew ? 'Any one is enough to save: a selfie, the company or their name. Everything else — the priority too — can be added later' + (S.reading ? ', and Gemini fills what it can from a card.' : '.') : 'Everything below is optional.') + '</p>' +
      '<div class="g2">' + UI.field('Email', '<input class="in" type="email" name="email" inputmode="email" autocomplete="off" value="' + esc(m.email || '') + '">') + UI.field('Phone', '<input class="in" type="tel" name="phone" value="' + esc(m.phone || '') + '">') + '</div>' +
      '<div class="g2">' + UI.field('Job title', '<input class="in" name="title" value="' + esc(m.title || '') + '">') + UI.field('Country', UI.pick('country', 'country', m.country || '')) + '</div>' +
      '<div class="g3">' + UI.field('Follow up by', '<input class="in" type="date" name="nextDate" value="' + esc(m.nextDate || '') + '">') + UI.field('Who follows up', '<select class="in" name="owner">' + ownOpts + '</select>') +
      (isNew ? '' : UI.field('Where it stands', '<select class="in" name="status">' + Object.keys(STATUS).map(k => '<option value="' + k + '"' + (m.status === k ? ' selected' : '') + '>' + STATUS[k] + '</option>').join('') + '</select>')) + '</div>' +
      UI.field('Next step', '<input class="in" name="nextStep" placeholder="e.g. Send the golf brochure" value="' + esc(m.nextStep || '') + '">') +
      UI.field('Notes', '<textarea class="in" name="notes" rows="3" placeholder="What they want, group sizes, dates — or press the microphone on the keyboard and say it">' + esc(m.notes || '') + '</textarea>') +
      (isNew ? '' : UI.field('Keywords', '<input class="in" name="tags" value="' + esc(m.tags || '') + '">', 'Commas between them — Gemini adds these from the notes')) +
      '<label class="chk"><input type="checkbox" name="canEmail"' + (m.canEmail === 'yes' ? ' checked' : '') + '> Happy to get JOR’s emails</label></div>';
  }
  /* A photo box: Take photo opens the camera, From photos the phone's own photos. */
  function shotBox(which, icon, title, hint, facing) {
    return '<div class="shot" id="shot-' + which + '">' + I(icon, 'lg') + '<span class="st">' + title + '</span><em>' + hint + '</em><div class="shotbtns">' +
      '<label class="btn sm">' + I('camera', 'sm') + 'Take photo<input type="file" accept="image/*" capture="' + facing + '" hidden data-shot="' + which + '"></label>' +
      '<label class="btn sm">' + I('img', 'sm') + 'From photos<input type="file" accept="image/*" hidden data-shot="' + which + '" data-library></label></div></div>';
  }
  function wireForm(el, m) {
    const sel = el.querySelector('[name=showId]'), ns = el.querySelector('#newshow');
    sel.onchange = () => { ns.classList.toggle('hidden', sel.value !== '+'); if (sel.value === '+') el.querySelector('[name=sname]').focus(); };
    const nd = el.querySelector('[name=nextDate]');
    let touched = !!m.nextDate;
    nd.addEventListener('input', () => { touched = true; });
    const ss = el.querySelector('[name=sstarts]'), se = el.querySelector('[name=sends]');
    ss.addEventListener('change', () => { if (se.value < ss.value) se.value = ss.value; });
    $$('[data-p]', el).forEach(b => b.onclick = () => {
      const on = !b.classList.contains('on');
      $$('[data-p]', el).forEach(x => x.classList.remove('on'));
      if (on) b.classList.add('on');
      el.querySelector('[name=priority]').value = on ? b.dataset.p : '';
      if (on && !touched) nd.value = D.addDays(el.querySelector('[name=met]').value || today(), { '1': 3, '2': 14, '3': 30 }[b.dataset.p]);
    });
    /* Met before? Said as they are typed — tap to bring their details over. */
    const box = el.querySelector('#before');
    const look = () => {
      const v = n => (el.querySelector('[name=' + n + ']') || {}).value || '';
      const b = metBefore({ email: v('email'), company: v('company'), name: v('name') }, m.id);
      const seen = {}, same = b.same.filter(x => !seen[x._pk] && (seen[x._pk] = 1)).slice(0, 3), co = b.company;      // one line a person: their latest meeting
      const coOthers = co ? co.met.filter(x => x.id !== m.id) : [];
      if (!same.length && !coOthers.length) { box.innerHTML = ''; return; }
      box.innerHTML = '<div class="before">' + same.map(x => '<button type="button" class="bf" data-use="' + esc(x.id) + '">' + I('user', 'sm') + '<span><b>Met before:</b> ' + esc([x.name, x.company].filter(Boolean).join(', ')) + ' — ' + esc(showOf(x.showId).name) + ', ' + esc(UI.nice(x.met, true)) + (x.priority ? ' · priority ' + x.priority : '') + (b.same.filter(y => y._pk === x._pk).length > 1 ? ' · met ' + b.same.filter(y => y._pk === x._pk).length + ' times' : '') + '</span><em>Use their details</em></button>').join('') +
        (co && coOthers.length && !same.length ? '<div class="bf co">' + I('grid', 'sm') + '<span>' + Object.keys(co.people).length + (Object.keys(co.people).length === 1 ? ' person' : ' people') + ' from <b>' + esc(co.name) + '</b> met before, at ' + esc(Object.keys(co.shows).map(id => showOf(id).name).join(', ')) + (co.rfps.length ? ' · ' + co.rfps.length + ' RFP' + (co.rfps.length === 1 ? '' : 's') + ' in JORIS' : '') + '</span></div>' : '') + '</div>';
      $$('[data-use]', box).forEach(btn => btn.onclick = () => {
        const x = S.met.find(y => y.id === btn.dataset.use);
        ['company', 'name', 'title', 'email', 'phone'].forEach(k => {
          const f = el.querySelector('[name=' + k + ']'), typed = f.value.trim();
          /* Blanks filled; a company typed in part becomes the whole name. */
          if (x[k] && (!typed || (k === 'company' && keyOf(x[k]).indexOf(keyOf(typed)) === 0 && typed !== x[k]))) { f.value = x[k]; f.classList.add('filled'); }
        });
        const c = el.querySelector('[name=country]'); if (x.country && !c.value) c.value = x.country;
        if (x.canEmail === 'yes') el.querySelector('[name=canEmail]').checked = true;
        setTimeout(() => $$('.filled', el).forEach(f => f.classList.remove('filled')), 2000);
        box.innerHTML = '';
      });
    };
    ['company', 'name', 'email'].forEach(n => { const f = el.querySelector('[name=' + n + ']'); f.addEventListener('input', () => { clearTimeout(look._t); look._t = setTimeout(look, 250); }); });
    el._look = look;
    if (m.id) look();
  }
  /* Any one thing to know them by is enough (his call, 26 Nov 2026): a selfie or card, the company, or their name.
     Everything else — the priority too — can be added later; those wait under "still to finish". */
  function needThree(el, x, photo) {
    $$('.need', el).forEach(f => f.classList.remove('need'));
    if (x.company || x.name || photo) return;
    ['company', 'name'].forEach(k => { const box = el.querySelector('[name=' + k + ']'); if (box) box.classList.add('need'); });
    const first = el.querySelector('.need'); if (first) first.scrollIntoView({ block: 'center', behavior: 'smooth' });
    throw new Error(x.checked ? 'Type the company or their name from the photo, please.' : 'A selfie, the company or their name, please — any one is enough.');
  }
  /* What an appointment sheet adds: its slot, everyone else listed (tap the one actually met to swap them in), and JOR's research. */
  function sheetBits(m) {
    const others = String(m.others || '').split(/;\s*/).filter(Boolean);
    return (m.slot ? '<p class="mini" style="margin:0 0 8px;color:var(--ink-2)">' + I('clock', 'sm') + ' ' + esc(m.slot) + '</p>' : '') +
      (others.length ? '<div class="listed"><span>Also listed on the sheet — tap whoever you actually met:</span><div>' + others.map((o, i) => '<button type="button" class="chip" data-swap="' + i + '">' + esc(o) + '</button>').join('') + '</div></div>' : '') +
      '<input type="hidden" name="others" value="' + esc(m.others || '') + '">' +
      (m.profile ? '<details class="profile"><summary>' + I('doc', 'sm') + ' What JOR knew beforehand</summary><p>' + esc(m.profile) + '</p></details>' : '');
  }
  function wireSheetBits(el) {
    $$('[data-swap]', el).forEach(b => b.onclick = () => {
      const oth = el.querySelector('[name=others]'), list = oth.value.split(/;\s*/).filter(Boolean), pick = list[+b.dataset.swap];
      const mm = /^(.*?)\s*(?:\(([^)]*)\))?\s*(\S+@\S+)?$/.exec(pick) || [], nm = el.querySelector('[name=name]'), ti = el.querySelector('[name=title]'), em = el.querySelector('[name=email]');
      const was = nm.value.trim() ? nm.value.trim() + (ti.value.trim() ? ' (' + ti.value.trim() + ')' : '') + (em.value.trim() ? ' ' + em.value.trim() : '') : '';
      list.splice(+b.dataset.swap, 1, ...(was ? [was] : []));
      nm.value = (mm[1] || pick).trim(); ti.value = (mm[2] || '').trim(); em.value = (mm[3] || '').trim();
      [nm, ti, em].forEach(f => f.classList.add('filled'));
      oth.value = list.join('; ');
      $$('[data-swap]', el).forEach((c, i) => { c.textContent = list[i] || ''; c.classList.toggle('hidden', !list[i]); });
      setTimeout(() => [nm, ti, em].forEach(f => f.classList.remove('filled')), 2000);
    });
  }
  function formValues(el) {
    const v = n => { const f = el.querySelector('[name=' + n + ']'); if (f && n === 'read' && f.dataset.changed !== '1') return undefined;      // the text read from the photo goes only when someone put it right
    return f ? (f.type === 'checkbox' ? (f.checked ? 'yes' : '') : f.value.trim()) : undefined; };
    const o = {};
    ['showId', 'met', 'company', 'name', 'title', 'country', 'email', 'phone', 'priority', 'nextDate', 'owner', 'status', 'nextStep', 'notes', 'tags', 'canEmail', 'others', 'read'].forEach(k => { const x = v(k); if (x !== undefined) o[k] = x; });
    return o;
  }
  /* A new show typed in the form: made on the phone at once, sent first. */
  async function showFrom(el) {
    const sel = el.querySelector('[name=showId]');
    if (sel.value !== '+') return sel.value;
    const v = n => el.querySelector('[name=' + n + ']').value.trim();
    if (!v('sname')) throw new Error('Give the new show a name — like “ITB Berlin 2027”.');
    if (!v('scountry') && !v('scity')) throw new Error('Where is the show? Type the city, or start typing the country and tap it in the list.');
    const twin = S.shows.find(s => s.name.toLowerCase() === v('sname').toLowerCase());
    if (twin) { sel.insertAdjacentHTML('afterbegin', ''); sel.value = twin.id; return twin.id; }
    const key = uid(), local = 'sh' + key;
    const show = { local, key, name: v('sname'), city: v('scity'), country: v('scountry'), starts: v('sstarts') || today(), ends: v('sends') || v('sstarts') || today() };
    S.shows.push({ id: local, name: show.name, city: show.city, country: show.country, starts: show.starts, ends: show.ends, lat: null, lng: null, _local: true });
    await API.keep();
    await API.queue({ a: 'show.save', body: { show }, after: 'show' });
    sel.insertAdjacentHTML('afterbegin', '<option value="' + esc(local) + '">' + esc(show.name) + '</option>');
    sel.value = local; el.querySelector('#newshow').classList.add('hidden');
    return local;
  }

  /* ══ Met someone ══════════════════════════════════════════════════════ */
  function capture() {
    S = API.S || S;
    const shots = {};
    let readDone = false;
    UI.dialog({
      title: 'Met someone', wide: true, body: personForm({}, true),
      foot: '<button class="btn" data-x>Cancel</button><button class="btn" data-next>Save &amp; next</button><button class="btn p" data-ok>' + I('check', 'sm') + 'Save</button>',
      on: (el, close) => {
        el.classList.add('cap');
        const sel = el.querySelector('[name=showId]');
        if (!S.shows.length) { sel.value = '+'; el.querySelector('#newshow').classList.remove('hidden'); }
        wireForm(el, {});
        $$('[data-shot]', el).forEach(inp => inp.addEventListener('change', async () => {
          const file = inp.files[0]; inp.value = '';
          if (!file) return;
          const which = inp.dataset.shot, box = el.querySelector('#shot-' + which);
          try {
            const img = await prepImage(file, which === 'card' ? 2200 : 1600);       // a page of notes: sharp enough to read every line
            shots[which] = img;
            box.classList.add('has');
            box.querySelectorAll(':scope > img').forEach(x => x.remove());
            box.insertAdjacentHTML('afterbegin', '<img alt="" src="' + img.url + '">');
            if (which === 'card') readCard(img);
          } catch (e) { UI.toast(e.message); }
        }));
        const readBox = el.querySelector('#readbox');
        async function readCard(img) {
          readDone = false;
          if (!S.reading) { readBox.innerHTML = '<div class="readbox off">' + I('warn', 'sm') + '<span>Gemini isn’t switched on yet, so the card is kept with them but not read.</span></div>'; return; }
          readBox.innerHTML = '<div class="readbox wait">' + I('spark', 'sm') + '<span>Gemini is reading it… no need to wait. Press Save &amp; next and it fills them in on its own.</span></div>';
          try {
            const r = await API.call('met.read', { photo: { data: img.data } }, { wait: 45000 });
            if (!r.draft) { readBox.innerHTML = '<div class="readbox off">' + I('warn', 'sm') + '<span>Couldn’t read it just now — it is read when it is sent.</span></div>'; return; }
            const p = r.draft.people[0] || {}, filled = [];
            ['company', 'name', 'title', 'email', 'phone'].forEach(k => { const f = el.querySelector('[name=' + k + ']'); if (p[k] && !f.value.trim()) { f.value = p[k]; f.classList.add('filled'); filled.push(k); } });
            const cf = el.querySelector('[name=country]'); if (p.country && !cf.value) { cf.value = p.country; filled.push('country'); }
            if (r.draft.priority && !el.querySelector('[name=priority]').value) el.querySelector('[data-p="' + r.draft.priority + '"]').click();
            shots.read = r.draft; readDone = true;
            readBox.innerHTML = '<div class="readbox done">' + I('check', 'sm') + '<div><b>' + (filled.length ? 'Filled in from the ' + (r.draft.kind === 'card' ? 'card' : 'picture') + ' — check it.' : 'Read.') + '</b>' +
              (r.draft.summary ? '<div>' + esc(r.draft.summary) + '</div>' : '') + (r.draft.tags ? '<div>' + r.draft.tags.split(', ').map(t => '<span class="tagc">' + esc(t) + '</span>').join('') + '</div>' : '') + '</div></div>';
            el._look();
            setTimeout(() => $$('.filled', el).forEach(x => x.classList.remove('filled')), 2500);
          } catch (e) { readBox.innerHTML = '<div class="readbox off">' + I('nosignal', 'sm') + '<span>No signal to read it now — it is read when it is sent.</span></div>'; }
        }
        const save = async next => {
          const btns = $$('.ft .btn', el); btns.forEach(b => b.disabled = true);
          try {
            const showId = await showFrom(el);
            const key = uid(), x = Object.assign(formValues(el), { showId, key });
            delete x.status;
            if (shots.read) { x.tags = shots.read.tags; x.summary = shots.read.summary; x.readText = shots.read.notes; }
            needThree(el, x, !!(shots.selfie || shots.card));
            try { localStorage.setItem('jorshows.lastShow', showId); } catch (e) { }
            /* On the phone at once, sent behind. */
            const local = 'tmp' + key;
            S.met.push(Object.assign({ id: local, by: S.me.id, owner: x.owner || S.me.id, status: 'new', created: new Date().toISOString().slice(0, 19), read: x.readText || '', check: '', _local: true, _photo: (shots.selfie || shots.card || {}).thumb || '', _shots: ['selfie', 'card'].filter(k => shots[k]) }, x));
            await API.keep();
            const photos = {};
            ['selfie', 'card'].forEach(k => { if (shots[k]) photos[k] = { data: shots[k].data, thumb: shots[k].thumb }; });
            await API.queue({ a: 'met.save', body: { met: x, photos, read: !readDone && !!shots.card }, after: 'met', local });
            UI.toast((x.name || x.company || 'Saved') + ' — saved.' + (Object.keys(photos).length ? ' The photos send on their own — carry on.' : ''));
            close(); paint();
            if (next) capture();
          } catch (e) { UI.toast(e.message, 6000); btns.forEach(b => b.disabled = false); }
        };
        el.querySelector('[data-ok]').onclick = () => save(false);
        el.querySelector('[data-next]').onclick = () => save(true);
      }
    });
  }

  /* ══ Opening someone ══════════════════════════════════════════════════ */
  function openMet(id) {
    const m = S.met.find(x => x.id === id);
    if (!m) { UI.toast('That one isn’t here — it may have been removed.'); return; }
    links();
    const s = showOf(m.showId), mine = m.by === S.me.id || m.owner === S.me.id || isAdmin();
    const ph = (k, label) => m[k] ? '<div class="ph" data-photo="' + k + '" data-thumb="' + esc(m[k]) + '"><span>' + label + '</span></div>' : '';
    const photos = ph('selfie', 'Selfie') + ph('card', 'Card or notes') + ph('sheet', 'Sales sheet');
    const others = (links().people[m._pk] || []).filter(x => x.id !== m.id).sort((a, b) => b.met.localeCompare(a.met));
    const co = m._ck && links().companies[m._ck];
    UI.dialog({
      title: (m.name || m.company || 'Someone met') + ' — ' + s.name, wide: true,
      body: (m._local ? '<div class="warnbox" style="margin-bottom:12px">' + I('nosignal', 'sm') + ' Still sending. You can add a photo now; the rest can be changed once it has gone to Trade Shows.</div>' : '') +
        (m.check === 'yes' ? '<div class="warnbox" style="margin-bottom:12px">' + I('warn', 'sm') + ' Read from a scanned sheet — check it against the picture, then press “Looks right”.</div>' : '') +
        (m.rfps ? '<div class="okbox" style="margin-bottom:12px">' + I('check', 'sm') + ' Since ' + esc(s.name) + ': ' + m.rfps + ' RFP' + (m.rfps === 1 ? '' : 's') + (m.groups ? ', ' + m.groups + ' became a group' : '') + ' in JORIS — ' + m.refs.map(esc).join(', ') + '</div>' : '') +
        (others.length || co ? '<div class="links">' + (others.length ? I('user', 'sm') + ' Also met at ' + others.map(x => '<a href="#" data-goto="' + esc(x.id) + '">' + esc(showOf(x.showId).name) + '</a>').join(', ') + '. ' : '') +
          (co ? '<a href="#" data-co="' + esc(co.key) + '">' + I('grid', 'sm') + ' Everyone from ' + esc(co.name) + ' (' + Object.keys(co.people).length + ')</a>' : '') + '</div>' : '') +
        (photos ? '<div class="photos3">' + photos + '</div>' : '') +
        addShots(m) +
        (m.summary ? '<p style="margin:0 0 8px"><b>' + I('spark', 'sm') + ' ' + esc(m.summary) + '</b></p>' : '') +
        readField(m, 'Read from the photo') +
        sheetBits(m) + personForm(m, false) + '<p class="mini" style="color:var(--ink-3);margin-top:10px">Met by ' + esc(nameOf(m.by) || 'someone who has left') + (m.created ? ' · put in ' + esc(UI.when(m.created)) : '') + '</p>',
      foot: (mine && !m._local ? '<button class="btn dngr" data-rm>' + I('trash', 'sm') + 'Remove</button>' : '') + '<span style="flex:1"></span><button class="btn" data-x>Close</button>' +
        (m._local ? '' : m.check === 'yes' ? '<button class="btn p" data-ok data-checked>' + I('check', 'sm') + 'Looks right</button>' : '<button class="btn p" data-ok>Save</button>'),
      on: (el, close) => {
        el.classList.add('cap');
        wireForm(el, m); wireSheetBits(el); wireRead(el, m);
        if (m._local) $$('input,select,textarea,button[data-p],[data-reread]', el).forEach(x => { if (!x.dataset.add) x.disabled = true; });
        wireAddShots(el, m);
        thumbs(el);
        $$('[data-photo]', el).forEach(p => p.onclick = () => bigPhoto(m, p.dataset.photo));
        $$('[data-goto]', el).forEach(a => a.onclick = e => { e.preventDefault(); close(); openMet(a.dataset.goto); });
        $$('[data-co]', el).forEach(a => a.onclick = e => { e.preventDefault(); close(); openCompany(a.dataset.co); });
        const ok = el.querySelector('[data-ok]');
        if (ok) ok.onclick = async () => {
          try {
            const showId = await showFrom(el);
            const x = Object.assign({}, formValues(el), { id: m.id, rev: m.rev, showId, summary: m.summary });
            if (ok.dataset.checked !== undefined) x.checked = true;
            if (m.check !== 'yes' || x.checked) needThree(el, x, x.checked ? false : !!(m.selfie || m.card || m.sheet || (m._shots || []).length));
            /* Changed here at once; the change goes behind. */
            Object.assign(m, x, { tags: x.tags !== undefined ? x.tags : m.tags, check: x.checked ? '' : m.check });
            delete m._h;
            await API.keep();
            await API.queue({ a: 'met.save', body: { met: x }, after: 'met', local: m.id });
            close(); paint(); UI.toast('Saved.');
            if (x.checked) { const next = S.met.find(y => y.check === 'yes'); if (next) checkOne(next.id); }
          } catch (e) { UI.toast(e.message, 6000); }
        };
        const rm = el.querySelector('[data-rm]');
        if (rm) rm.onclick = async () => {
          if (!(await UI.confirm('Remove ' + (m.name || m.company || 'this one') + '?', 'They go out of the lists and the counts. Whoever looks after Trade Shows can put them back.', 'Remove', true))) return;
          S.met = S.met.filter(x => x.id !== m.id); await API.keep();
          await API.queue({ a: 'met.remove', body: { id: m.id } });
          close(); paint(); UI.toast('Removed.');
        };
      }
    });
  }
  /* A selfie or their card added later (Bernard: the company and a selfie at the stand, the rest afterwards).
     It goes at once, on its own, even while the first save is still sending — no Save needed. */
  function addShots(m) {
    const need = ['selfie', 'card'].filter(k => !m[k] && !(m._shots || []).includes(k));
    if (!need.length) return '';
    return '<div class="addshots">' + need.map(k => '<div class="addshot" id="add-' + k + '"><span class="at">' + I(k === 'selfie' ? 'selfie' : 'camera', 'sm') + (k === 'selfie' ? 'Add a selfie' : 'Add their card or notes') + '</span><div class="shotbtns">' +
      '<label class="btn sm">' + I('camera', 'sm') + 'Take photo<input type="file" accept="image/*" capture="' + (k === 'selfie' ? 'user' : 'environment') + '" hidden data-add="' + k + '"></label>' +
      '<label class="btn sm">' + I('img', 'sm') + 'From photos<input type="file" accept="image/*" hidden data-add="' + k + '"></label></div></div>').join('') + '</div>';
  }
  function wireAddShots(el, m) {
    $$('[data-add]', el).forEach(inp => inp.addEventListener('change', async () => {
      const file = inp.files[0]; inp.value = '';
      if (!file) return;
      const which = inp.dataset.add, box = el.querySelector('#add-' + which);
      try {
        const img = await prepImage(file, which === 'card' ? 2200 : 1600);
        box.classList.add('has');
        box.innerHTML = '<img alt="" src="' + img.url + '"><span class="at">' + I('check', 'sm') + (which === 'selfie' ? 'Selfie added' : 'Card added') + ' — it sends on its own' + (which === 'card' && S.reading ? ' and Gemini reads it' : '') + '.</span>';
        if (which === 'selfie' || !m._photo) m._photo = img.thumb;
        (m._shots = m._shots || []).push(which);
        await API.keep();
        await API.queue({ a: 'met.addphoto', body: { id: m.id, which, rev: m.rev, photo: { data: img.data, thumb: img.thumb } }, after: 'photo' });
        paint();
      } catch (e) { UI.toast(e.message, 6000); }
    }));
  }
  /* What Gemini read from the photo: all of it, in a box that grows to fit, and it can be put right by hand.
     "Read the photo again" reads the whole page afresh (photos read before 26 Nov 2026 got only the handwriting). */
  function readField(m, label) {
    if (!m.read && !m.card && !m.sheet) return '';
    return '<div class="readhead"><span>' + esc(label) + '</span>' + ((m.card || m.sheet) && S.reading ? '<button type="button" class="btn sm" data-reread>' + I('spark', 'sm') + 'Read the photo again</button>' : '') + '</div>' +
      '<textarea class="in readnotes" name="read" rows="3" placeholder="Nothing read from the photo yet">' + esc(m.read || '') + '</textarea>' +
      '<p class="readhint">Put right anything Gemini got wrong — it is saved with them, and searched.</p>';
  }
  function wireRead(el, m) {
    const t = el.querySelector('textarea[name=read]');
    if (!t) return;
    const fit = () => { t.style.height = 'auto'; t.style.height = (t.scrollHeight + 2) + 'px'; };
    t.addEventListener('input', () => { t.dataset.changed = '1'; fit(); });
    requestAnimationFrame(fit); setTimeout(fit, 250);
    const b = el.querySelector('[data-reread]');
    if (b) b.onclick = async () => {
      if (t.value.trim() && t.value !== (m.read || '') && !(await UI.confirm('Read the photo again?', 'What you changed in the box is replaced by a fresh reading.', 'Read it again'))) return;
      b.disabled = true; const was = b.innerHTML; b.innerHTML = I('spark', 'sm') + 'Reading the whole page…';
      try {
        const r = await API.call('met.reread', { id: m.id }, { wait: 150000 });
        Object.assign(m, r.met); delete m._h; await API.keep();
        t.value = m.read || ''; t.dataset.changed = ''; fit();
        UI.toast('Read again — check it, then Save.');
      } catch (e) { UI.toast(e.offline ? 'This needs signal — try again in a moment.' : e.message, 7000); }
      b.disabled = false; b.innerHTML = was;
    };
  }
  async function bigPhoto(m, which) {
    const d = UI.dialog({ title: { selfie: 'Selfie', card: 'Card or notes', sheet: 'Sales sheet' }[which] + ' — ' + (m.name || m.company || ''), wide: true, body: '<div class="empty">Loading the photo…</div>' });
    try { const r = await API.call('met.photo', { id: m.id, which }); d.el.querySelector('.b').innerHTML = '<img class="bigview" alt="" src="data:' + esc(r.type) + ';base64,' + r.data + '">'; }
    catch (e) { d.el.querySelector('.b').innerHTML = '<p class="err">' + esc(e.offline ? 'No signal — the photo is on Google and comes when there is signal.' : e.message) + '</p>'; }
  }

  /* ══ To check: what a scan made, beside its picture ══════════════════ */
  function checkView() {
    const list = MET.filter(m => m.check === 'yes').sort((a, b) => a.created.localeCompare(b.created));
    if (!list.length) { $('#view').innerHTML = '<div class="empty">Nothing waiting to be checked.</div>'; return; }
    $('#view').innerHTML = '<p class="sh-count">' + list.length + ' read from scanned sales sheets. Open each, check it against the picture, and press “Looks right”.</p><div class="mlist">' + list.map(m => row(m)).join('') + '</div>';
    $$('#view .mrow').forEach(r => r.onclick = () => checkOne(r.dataset.id));
    thumbs($('#view'));
  }
  function checkOne(id) {
    const m = S.met.find(x => x.id === id);
    if (!m) return;
    UI.dialog({
      title: 'Check: ' + (m.name || m.company || 'a scanned sheet') + ' — ' + showOf(m.showId).name, wide: true,
      body: '<div class="ckwrap"><div class="pic" id="ckpic"><div class="empty">Loading the sheet…</div></div><div>' + readField(m, 'The handwriting, as Gemini read it') + sheetBits(m) + personForm(m, false) + '</div></div>',
      foot: '<button class="btn dngr" data-rm>' + I('trash', 'sm') + 'Not a person — remove</button><span style="flex:1"></span><button class="btn" data-x>Later</button><button class="btn p" data-ok>' + I('check', 'sm') + 'Looks right</button>',
      on: (el, close) => {
        el.classList.add('cap'); el.style.maxWidth = '1100px';
        wireForm(el, m); wireSheetBits(el); wireRead(el, m);
        API.call('met.photo', { id: m.id, which: 'sheet' }).then(r => { el.querySelector('#ckpic').innerHTML = '<img alt="The scanned sheet" src="data:' + esc(r.type) + ';base64,' + r.data + '">'; }).catch(e => { el.querySelector('#ckpic').innerHTML = '<p class="err">' + esc(e.message) + '</p>'; });
        el.querySelector('[data-ok]').onclick = async () => {
          try {
            const x = Object.assign({}, formValues(el), { id: m.id, rev: m.rev, showId: await showFrom(el), summary: m.summary, checked: true });
            needThree(el, x, false);
            Object.assign(m, x, { check: '' }); delete m._h; await API.keep();
            await API.queue({ a: 'met.save', body: { met: x }, after: 'met', local: m.id });
            close(); paint();
            const next = S.met.find(y => y.check === 'yes');
            if (next) checkOne(next.id); else { UI.toast('All checked.'); go('people'); }
          } catch (e) { UI.toast(e.message, 6000); }
        };
        el.querySelector('[data-rm]').onclick = async () => { S.met = S.met.filter(x => x.id !== m.id); await API.keep(); await API.queue({ a: 'met.remove', body: { id: m.id } }); close(); paint(); };
      }
    });
  }

  /* ══ The scanner's PDF, a page at a time (needs signal: each page is read as it goes) ══ */
  const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/';
  let pdfjs = null;
  async function loadPdf() { if (pdfjs) return pdfjs; const lib = await import(PDFJS + 'build/pdf.min.mjs'); lib.GlobalWorkerOptions.workerSrc = PDFJS + 'build/pdf.worker.min.mjs'; return (pdfjs = lib); }
  async function pdfPage(pdf, n) {
    const page = await pdf.getPage(n), v1 = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: 1800 / Math.max(v1.width, v1.height) }), c = document.createElement('canvas');
    c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
    await page.render({ canvasContext: c.getContext('2d'), canvas: c, viewport: vp, background: '#ffffff' }).promise;
    return fromCanvas(c);
  }
  function scanDialog() {
    const s = defaultShow();
    UI.dialog({
      title: 'Scan a PDF of sales sheets', wide: true,
      body: '<p class="sub" style="margin-top:0"><b>Before the show:</b> scan the printed sheets — each becomes a meeting under “Today’s meetings” on its day, to tap at the stand. <b>After:</b> scan them again with the writing on — each goes onto its own meeting.</p><p class="sub">Each page is ' + (S.reading ? 'read by Gemini — the people on it, the priority in the PTY box, the handwritten notes — and waits under “To check” until someone says it looks right.' : 'kept and waits under “To check” to be typed in from the picture (Gemini isn’t switched on yet).') + '</p>' +
        '<div class="showline">' + UI.field('Which show', '<select class="in" name="showId">' + S.shows.slice().sort((a, b) => (b.starts || '').localeCompare(a.starts || '')).map(x => '<option value="' + esc(x.id) + '"' + (x.id === s ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '<option value="+">＋ A new show…</option></select>') + '</div>' +
        '<div class="newshow hidden" id="newshow"><div class="g2">' + UI.field('Name of the show', '<input class="in" name="sname">') + UI.field('City', '<input class="in" name="scity">') + '</div>' +
        '<div class="g3">' + UI.field('Country', UI.pick('scountry', 'country', '')) + UI.field('Starts', '<input class="in" type="date" name="sstarts" value="' + esc(today()) + '">') + UI.field('Ends', '<input class="in" type="date" name="sends" value="' + esc(today()) + '">') + '</div></div>' +
        '<label class="shot" style="min-height:110px;margin-top:6px">' + I('upload', 'lg') + 'Choose the scanner’s PDF — or photos of the sheets<em>several at once is fine</em><input type="file" accept="application/pdf,image/*" multiple hidden id="scanfiles"></label><div id="scanprog"></div>',
      foot: '<button class="btn" data-x>Close</button>',
      on: (el, close) => {
        const sel = el.querySelector('[name=showId]'), ns = el.querySelector('#newshow');
        if (!S.shows.length) { sel.value = '+'; ns.classList.remove('hidden'); }
        sel.onchange = () => ns.classList.toggle('hidden', sel.value !== '+');
        el.querySelector('#scanfiles').addEventListener('change', async e => {
          const files = [...e.target.files]; e.target.value = '';
          if (!files.length) return;
          let showId;
          try { showId = await showFrom(el); await API.flush(); showId = S.shows.some(x => x.id === showId) ? showId : (S.shows.find(x => x.name === (el.querySelector('[name=sname]') || {}).value) || {}).id || showId; } catch (x) { UI.toast(x.message, 6000); return; }
          if (/^sh/.test(showId) && S.shows.find(x => x.id === showId && x._local)) { UI.toast('The new show hasn’t reached Trade Shows yet — try again when there is signal.', 6000); return; }
          await scanFiles(files, showId, el.querySelector('#scanprog'));
          close(); await API.sync().catch(() => { }); if (S.met.some(m => m.check === 'yes')) go('check'); else paint();
        });
      }
    });
  }
  async function scanFiles(files, showId, box) {
    const st = { done: 0, total: 0, made: 0, blank: 0, errors: [], label: 'Getting the pages ready…' };
    const pr = () => { box.innerHTML = '<div style="margin-top:12px"><div class="mini">' + esc(st.label) + ' <b>' + st.done + ' of ' + st.total + '</b>' + (st.made ? ' · ' + st.made + ' people' : '') + (st.blank ? ' · ' + st.blank + ' blank' : '') + '</div>' +
      '<div class="prog"><i style="width:' + (st.total ? Math.round(100 * st.done / st.total) : 0) + '%"></i></div>' + (st.errors.length ? '<p class="err">' + st.errors.map(esc).join('<br>') + '</p>' : '') + '</div>'; };
    pr();
    const jobs = [];
    for (const f of files) {
      try {
        if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
          const lib = await loadPdf(), pdf = await lib.getDocument({ data: new Uint8Array(await f.arrayBuffer()), isEvalSupported: false }).promise;
          st.total += pdf.numPages; pr();
          for (let n = 1; n <= pdf.numPages; n++) jobs.push({ name: f.name + ' page ' + n, from: f.name, page: n, make: () => pdfPage(pdf, n) });
        } else if (/^image\//.test(f.type)) { st.total++; jobs.push({ name: f.name, from: f.name, page: 1, make: () => prepImage(f, 1800) }); }
        else st.errors.push(f.name + ': only PDFs and photos.');
      } catch (e) { st.errors.push(f.name + ': ' + e.message); }
    }
    st.label = 'Sending and reading each page…'; pr();
    let next = 0;
    const worker = async () => {
      while (next < jobs.length) {
        const j = jobs[next++];
        for (let attempt = 0; attempt < 3; attempt++) {
          try { const img = await j.make(); const r = await API.call('scan.page', { showId, from: j.from, page: j.page, image: img.data, thumb: img.thumb }, { wait: 90000 }); st.made += r.made.length; if (r.blank) st.blank++; break; }
          catch (e) { if (attempt === 2 || !e.offline) { st.errors.push(j.name + ': ' + e.message); break; } await new Promise(r => setTimeout(r, 2000 * (attempt + 1))); }
        }
        st.done++; pr();
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    st.label = st.errors.length ? 'Done, with problems:' : 'All in.'; pr();
    UI.toast(st.made + (st.made === 1 ? ' person' : ' people') + ' read from ' + st.done + (st.done === 1 ? ' page' : ' pages') + (st.blank ? ' (' + st.blank + ' blank)' : '') + '.', 6000);
  }

  /* ══ Admin: people and their links, the Gemini key, JORIS ════════════ */
  async function adminView() {
    if (!isAdmin()) { go('dash'); return; }
    $('#view').innerHTML = '<div class="empty">Loading…</div>';
    let A;
    try { A = await API.call('admin.get'); } catch (e) { $('#view').innerHTML = '<div class="empty">' + esc(e.offline ? 'Admin needs signal.' : e.message) + '</div>'; return; }
    if (view !== 'admin') return;
    $('#view').innerHTML = '<div class="panels" style="margin-top:0">' +
      '<div class="panel" style="grid-column:1/-1"><h3>Team</h3><p class="sub2">One link for everyone at JOR. Opened on a phone it asks “Who are you?” once; after that the phone (and its home-screen app) opens straight in.</p>' +
      '<div class="linkbox"><div id="qr"></div><div><textarea class="in" rows="2" readonly id="lk">' + esc(A.team) + '</textarea><div class="acts" style="margin-top:8px"><button class="btn p" id="lcopy">' + I('copy', 'sm') + 'Copy the team link</button>' +
      '<button class="btn" id="lnew">' + I('refresh', 'sm') + 'Make a new team link</button><button class="btn dngr" id="lout">Sign out every other phone</button></div><p class="mini" style="color:var(--ink-3)">Send it by WhatsApp or email, or let them scan the code. A new link stops the old one for phones that haven’t joined yet.</p></div></div>' +
      '<div class="mlist" style="margin-top:12px">' + A.people.filter(p => p.status === 'active').map(p => '<div class="mrow" style="cursor:default"><div class="av2">' + esc(p.initials) + '</div><div class="bd"><b>' + esc(p.name) + (p.admin === 'yes' ? ' <span class="pill">Admin</span>' : '') + (p.pin ? ' <span class="pill">' + I('lock', 'sm') + 'PIN</span>' : '') + '</b>' +
        '<div class="l2">' + esc(p.email || 'no email — no morning follow-up email') + ' · ' + (p.phones ? p.phones + (p.phones === 1 ? ' phone' : ' phones') : 'not on a phone yet') + (p.lastSeen ? ' · last here ' + esc(UI.when(p.lastSeen)) : '') + '</div></div><div class="rt" style="flex-direction:row;flex-wrap:wrap;justify-content:flex-end">' +
        '<button class="btn sm" data-pin="' + esc(p.id) + '">' + I('lock', 'sm') + (p.pin ? 'New PIN' : 'Give a PIN') + '</button>' + (p.phones ? '<button class="btn sm" data-out="' + esc(p.id) + '">Sign out of phones</button>' : '') +
        (p.id !== S.me.id ? '<button class="btn sm dngr" data-leave="' + esc(p.id) + '">Off the team</button>' : '') + '</div></div>').join('') + '</div>' +
      '<div class="g3" style="margin-top:12px;align-items:end">' + UI.field('Name', '<input class="in" id="pname" placeholder="e.g. Bernard O’Reilly">') + UI.field('Initials', '<input class="in" id="pini" maxlength="4" placeholder="BOR">') + UI.field('Email (for the morning follow-ups)', '<input class="in" id="pmail" type="email">') + '</div>' +
      '<label class="chk"><input type="checkbox" id="padm"> Looks after Trade Shows too (Admin — needs a PIN)</label><div id="padmpin" class="hidden">' + UI.field('Their PIN (4 to 8 numbers)', '<input class="in" id="ppin" inputmode="numeric" maxlength="8">') + '</div>' +
      '<button class="btn p" id="padd">' + I('plus', 'sm') + 'Add to the team</button></div>' +
      '<div class="panel"><h3>Gemini</h3><p class="sub2">' + (A.gemini ? '<b style="color:var(--jor-dark)">The key is in</b> — kept on Google, never shown again. Cards, notes and scanned sheets are read.' : 'No key yet: photos are kept but not read.') + '</p>' +
      UI.field(A.gemini ? 'Replace the key' : 'Paste the Gemini key', '<input class="in" id="gkey" autocomplete="off" placeholder="Paste the key (AQ.… or AIza…)">', 'Use a paid key (Google AI Studio, with billing on) so cards and notes are never used to train Google’s models.') +
      '<div class="acts"><button class="btn p" id="gset">Put the key in</button>' + (A.gemini ? '<button class="btn" id="gtest">' + I('check', 'sm') + 'Test the key</button><button class="btn" id="gread">' + (A.reading ? 'Stop reading for now' : 'Start reading again') + '</button><button class="btn dngr" id="gclear">Take the key out</button>' : '') + '</div></div>' +
      '<div class="panel"><h3>JORIS</h3><p class="sub2">' + (A.joris.url ? 'Linked. Every quarter of an hour the people met go to JORIS’s contacts, and JORIS says which companies have sent an RFP.' + (A.joris.said ? '<br>Last: ' + esc(A.joris.said) : '') : 'Not linked yet.') + '</p>' +
      UI.field('JORIS’s web app link', '<input class="in" id="jurl" placeholder="https://script.google.com/macros/s/…/exec" value="' + esc(A.joris.url) + '">') +
      '<div class="acts"><button class="btn p" id="jset">' + (A.joris.url ? 'Link again (new code)' : 'Link') + '</button>' + (A.joris.url ? '<button class="btn" id="jnow">' + I('refresh', 'sm') + 'Link with JORIS now</button><button class="btn dngr" id="joff">Unlink</button>' : '') + '</div><div id="jcode"></div></div>' +
      '<div class="panel" style="grid-column:1/-1"><h3>Removed</h3>' + (A.removed.length ? '<div class="mlist">' + A.removed.map(m => '<div class="mrow" style="cursor:default"><div class="bd"><b>' + esc(m.name || m.company || '—') + '</b><div class="l2">' + esc(showOf(m.showId).name) + ' · removed ' + esc(UI.when(m.removed)) + '</div></div><button class="btn sm" data-back="' + esc(m.id) + '">Put back</button></div>').join('') + '</div>' : '<p class="sub2">Nothing removed.</p>') + '</div></div>';
    try { const q = window.qrcode(0, 'M'); q.addData(A.team); q.make(); $('#qr').innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); } catch (e) { $('#qr').textContent = ''; }
    $('#lcopy').onclick = () => { navigator.clipboard.writeText(A.team).then(() => UI.toast('Copied — send it to the team.')); };
    $('#lnew').onclick = async () => { if (!(await UI.confirm('Make a new team link?', 'The old link stops working for phones that haven’t said who they are yet. Phones already in stay in. Send the new one round.', 'Make a new link'))) return; try { await API.call('admin.team', { renew: true }); adminView(); } catch (e) { UI.toast(e.message, 6000); } };
    $('#lout').onclick = async () => { if (!(await UI.confirm('Sign out every other phone?', 'Everyone (but this phone) is asked “Who are you?” again next time. Do it with a new team link if the link got out.', 'Sign them out', true))) return; try { await API.call('admin.team', { signOut: true }); adminView(); } catch (e) { UI.toast(e.message, 6000); } };
    $('#padm').onchange = () => $('#padmpin').classList.toggle('hidden', !$('#padm').checked);
    $('#padd').onclick = async () => {
      try { await API.call('admin.person', { person: { name: $('#pname').value, initials: $('#pini').value, email: $('#pmail').value, admin: $('#padm').checked ? 'yes' : '', pin: $('#padm').checked ? $('#ppin').value.trim() : undefined } }); UI.toast('Added — their name is on “Who are you?”'); await API.sync(); adminView(); } catch (e) { UI.toast(e.message, 6000); }
    };
    $$('[data-pin]').forEach(b => b.onclick = () => {
      const p = A.people.find(x => x.id === b.dataset.pin);
      UI.dialog({ title: (p.pin ? 'A new PIN for ' : 'A PIN for ') + p.name, body: '<p>' + (p.admin === 'yes' ? 'They type it once on each phone, when they tap their name.' : 'With a PIN, tapping their name isn’t enough on a new phone.') + '</p>' + UI.field('PIN (4 to 8 numbers)', '<input class="in" id="np" inputmode="numeric" maxlength="8">'),
        foot: '<button class="btn" data-x>Cancel</button><button class="btn p" data-ok>Save the PIN</button>',
        on: (el, close) => { el.querySelector('[data-ok]').onclick = async () => { try { await API.call('admin.person', { person: { id: p.id, pin: el.querySelector('#np').value.trim() } }); close(); UI.toast('PIN saved.'); adminView(); } catch (e) { UI.toast(e.message, 6000); } }; } });
    });
    $$('[data-out]').forEach(b => b.onclick = async () => {
      const p = A.people.find(x => x.id === b.dataset.out);
      if (!(await UI.confirm('Sign ' + p.name + ' out of their phones?', 'For a lost phone. They tap their name again on the team link to get back in.', 'Sign out', true))) return;
      try { await API.call('admin.person', { person: { id: p.id, signOut: true } }); adminView(); } catch (e) { UI.toast(e.message, 6000); }
    });
    $$('[data-leave]').forEach(b => b.onclick = async () => {
      const p = A.people.find(x => x.id === b.dataset.leave);
      if (!(await UI.confirm('Take ' + p.name + ' off the team?', 'Their name goes from “Who are you?” and their phones are signed out at once. Everyone they met stays in Trade Shows.', 'Take them off', true))) return;
      try { await API.call('admin.person', { person: { id: p.id, leave: true } }); adminView(); } catch (e) { UI.toast(e.message, 6000); }
    });
    $('#gset').onclick = async () => { try { const r = await API.call('admin.gemini', { key: $('#gkey').value }); UI.toast('The key works — reading with ' + r.model + '.'); await API.sync(); adminView(); } catch (e) { UI.toast(e.message, 7000); } };
    const gt = $('#gtest'); if (gt) gt.onclick = async () => {
      gt.disabled = true; gt.textContent = 'Asking Google…';
      try { const t = (await API.call('admin.gemini', { test: true }, { wait: 90000 })).test; UI.dialog({ title: t.ok ? 'The key works' : 'The key didn’t work', body: '<p>' + (t.ok ? 'Gemini answered through <b>' + esc(t.api) + '</b>, with <b>' + esc(t.model) + '</b>. Cards, sheets and handwriting will be read.' : 'Google said: <b>' + esc(t.said) + '</b></p><p class="mini">Check the key was copied whole, and that billing is on for it in Google AI Studio (or Google Cloud, for an AQ. key).') + '</p>' }); }
      catch (e) { UI.toast(e.message, 7000); }
      gt.disabled = false; gt.innerHTML = I('check', 'sm') + 'Test the key';
    };
    const gr = $('#gread'); if (gr) gr.onclick = async () => { await API.call('admin.gemini', { reading: !A.reading }); await API.sync(); adminView(); };
    const gc = $('#gclear'); if (gc) gc.onclick = async () => { if (await UI.confirm('Take the Gemini key out?', 'Photos are still kept, but nothing is read until a key is put in again.', 'Take it out', true)) { await API.call('admin.gemini', { clear: true }); await API.sync(); adminView(); } };
    $('#jset').onclick = async () => {
      try {
        const r = await API.call('admin.joris', { url: $('#jurl').value.trim() });
        $('#jcode').innerHTML = '<div class="okbox" style="margin-top:10px"><b>Now in JORIS’s Apps Script project:</b> Project Settings › Script Properties › Add script property. Name <code>SHOWS_LINK</code>, value:<textarea class="in" rows="2" readonly style="margin-top:6px">' + esc(r.secret) + '</textarea>Shown only now. Then press “Link with JORIS now”.</div>';
      } catch (e) { UI.toast(e.message, 7000); }
    };
    const jn = $('#jnow'); if (jn) jn.onclick = async () => { jn.disabled = true; try { const r = await API.call('admin.joris', { now: true }, { wait: 120000 }); UI.toast(r.said === 'ok' ? 'Linked with JORIS.' : 'JORIS: ' + r.said, 7000); await API.sync(); } catch (e) { UI.toast(e.message, 7000); } adminView(); };
    const jo = $('#joff'); if (jo) jo.onclick = async () => { if (await UI.confirm('Unlink JORIS?', 'Nothing more goes to JORIS, and its RFPs stop coming back.', 'Unlink', true)) { await API.call('admin.joris', { off: true }); adminView(); } };
    $$('[data-back]').forEach(b => b.onclick = async () => { try { await API.call('met.remove', { id: b.dataset.back, back: true }); await API.sync(); adminView(); UI.toast('Put back.'); } catch (e) { UI.toast(e.message); } });
  }

  window.JOR_SHOWS = { get S() { return API.S || S; }, go, capture, openMet, openCompany, links, proj, scanFiles };

  /* ══ Starting ═════════════════════════════════════════════════════════ */
  frame();
  API.onChange(why => {
    S = API.S || S;
    if (why && why.problem) UI.toast(why.problem, 8000);
    if (why === 'outbox') { syncLine(); return; }
    if (why === 'same') { syncLine(); return; }
    if (!$('.scrim')) paint(); else syncLine();
  });
  S = await API.load();
  if (S) { paint(); route(); }
  try {
    await API.sync();
    S = API.S;
    if (!document.querySelector('#view .mrow, #view .scard, #view .panel')) { paint(); route(); } else if (!$('.scrim')) paint();
  } catch (e) {
    if (e.signin) { API.forget(); if (API.team()) whoAreYou(e.message); else noLink(e.message); return; }
    if (!S) { $('#view').innerHTML = '<div class="empty">No signal, and nothing on this phone yet. Open Trade Shows again when there is signal.</div>'; }
  }
  /* Kept up to date while it is open: a quick question every minute, and on coming back to it. */
  setInterval(() => { if (!document.hidden) API.sync().then(() => { S = API.S; }).catch(() => { }); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) API.sync().then(() => { S = API.S; }).catch(() => { }); });
  API.flush();
  setTimeout(() => offerInstall(false), 2500);
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });

  function route() {
    const h = decodeURIComponent(location.hash.slice(1));
    if (/^met=/.test(h)) { view = 'people'; paint(); openMet(h.slice(4)); return; }
    if (['people', 'companies', 'map', 'check', 'admin'].indexOf(h) >= 0) go(h);
    if (h === 'new') capture();
    if (h === 'scan') scanDialog();
  }
  window.addEventListener('hashchange', () => { if (!document.querySelector('.scrim') && /^(met=|scan|new)/.test(decodeURIComponent(location.hash.slice(1)))) route(); });
})();
