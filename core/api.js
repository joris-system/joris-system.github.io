/* ═══════════════════════════════════════════════════════════════════════
   JORIS — talking to the server, and staying signed in
   The session token lives in this browser window only, unless the person
   ticked "keep me signed in on this computer". A request the server
   answers with "please sign in" sends the page back to the sign-in, and
   brings the person back here after.
   ═══════════════════════════════════════════════════════════════════════ */
window.JOR = (function () {
  'use strict';
  /* JORIS never opens inside another site's page: a frame is how a click gets borrowed. */
  if (window.top !== window.self) { document.documentElement.style.display = 'none'; throw new Error('JORIS does not open inside another page.'); }
  const cfg = window.JOR_CONFIG || {};
  const TK = 'jor.office.token', MK = 'jor.office.me', CK = 'jor.office.c:';
  /* The door (core/door.js): until this computer has given the door code, nothing is asked of
     the server; after that, every request carries the key the server gave it in return. */
  const DOOR = window.JOR_DOOR || null;
  const doorOpen = () => (DOOR ? DOOR.wait : Promise.resolve());
  const doorTag = () => (DOOR && DOOR.key ? { door: DOOR.key } : {});
  /* The site's root, worked out from where this file is, so every part
     (one folder down) finds the sign-in page. */
  const ROOT = new URL('../', document.currentScript.src).href;

  function token() {
    try { return sessionStorage.getItem(TK) || localStorage.getItem(TK) || ''; } catch (e) { return ''; }
  }
  function setToken(t, keep) {
    clearToken();
    try { (keep ? localStorage : sessionStorage).setItem(TK, t); } catch (e) { /* private mode: this page only */ }
  }
  function clearToken() {
    forget();
    try { sessionStorage.removeItem(TK); localStorage.removeItem(TK); sessionStorage.removeItem(MK); localStorage.removeItem(MK); } catch (e) { }
  }

  /* ── Not waiting twice ───────────────────────────────────────────────
     Every question to the server takes a few seconds, however small (it is
     Google's, and far away). So a page asks as few as it can, asks them
     together, and meanwhile shows what this tab last saw. None of it is
     trusted: the server checks every request for itself. */

  /* Who is signed in, remembered beside the token, so a page draws at once
     instead of asking first. */
  const tail = () => token().slice(-16);
  function meKept() {
    try { const o = JSON.parse(sessionStorage.getItem(MK) || localStorage.getItem(MK) || 'null'); return o && o.k === tail() && o.me ? o : null; } catch (e) { return null; }
  }
  function keepMe(m) {
    try { (kept() ? localStorage : sessionStorage).setItem(MK, JSON.stringify({ k: tail(), at: Date.now(), me: m })); } catch (e) { }
  }
  const sig = m => JSON.stringify([m.id, m.name, m.role, m.team, m.admin, m.finance, m.owner, m.status, m.perms, m.covers, m.viewer ? m.viewer.id : '']);

  /* What this tab last saw of a list, kept until the tab closes or the
     person signs out (half an hour at most). */
  const keyOf = (a, extra) => CK + tail() + ':' + a + ':' + JSON.stringify(extra || {});
  function forget() {
    try { Object.keys(sessionStorage).filter(k => k.indexOf(CK) === 0).forEach(k => sessionStorage.removeItem(k)); } catch (e) { }
  }
  function last(a, extra) {
    try { const o = JSON.parse(sessionStorage.getItem(keyOf(a, extra)) || 'null'); return o && Date.now() - o.at < 30 * 60000 ? o.v : null; } catch (e) { return null; }
  }
  function keep(a, extra, v) {
    let s;
    try { s = JSON.stringify({ at: Date.now(), v: v }); sessionStorage.setItem(keyOf(a, extra), s); }
    catch (e) { forget(); try { sessionStorage.setItem(keyOf(a, extra), s); } catch (x) { /* too big to keep: asked for each time */ } }
    try { sessionStorage.setItem(keyOf(a, extra) + '@', String(Date.now())); } catch (e) { }
  }
  /* How long ago this tab last kept it, in milliseconds. */
  function age(a, extra) {
    try { const t = +sessionStorage.getItem(keyOf(a, extra) + '@'); return t && sessionStorage.getItem(keyOf(a, extra)) ? Date.now() - t : Infinity; } catch (e) { return Infinity; }
  }
  /* A page's list: painted at once from what this tab last saw, then again
     when the server answers — if anything changed. A question asked later
     that has already been answered (the person did something meanwhile)
     wins: an older answer never paints over a newer one. */
  let order = 0;
  const answered = {}, lives = [];
  async function live(a, extra, paint) {
    if (!lives.some(x => x[0] === a && JSON.stringify(x[1] || {}) === JSON.stringify(extra || {}))) lives.push([a, extra, paint]);
    const seen = last(a, extra);
    let shown = '';
    if (seen) { shown = JSON.stringify(seen); try { paint(seen, true); } catch (e) { shown = ''; } }
    const p = call(a, extra), n = order;
    const r = await p;
    if ((answered[a] || 0) > n) return r;
    keep(a, extra, r);
    if (JSON.stringify(r) !== shown) paint(r, false);
    return r;
  }

  /* A thin line along the top while the server is being asked. */
  let asking = 0, bar = null;
  function busy(d) {
    asking = Math.max(0, asking + d);
    if (!bar && document.body) { bar = document.createElement('div'); bar.className = 'jbusy'; document.body.appendChild(bar); }
    if (bar) bar.classList.toggle('on', asking > 0);
  }
  function kept() { try { return !!localStorage.getItem(TK); } catch (e) { return false; } }

  /* This computer's own key: made once, kept in this browser, never shown.
     The server keeps only a hash of it, so it knows a computer it has seen. */
  const DK = 'jor.office.device';
  function device() {
    try {
      let k = localStorage.getItem(DK);
      if (!/^[A-Za-z0-9_-]{32,128}$/.test(k || '')) {
        const b = new Uint8Array(24); crypto.getRandomValues(b);
        k = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
        localStorage.setItem(DK, k);
      }
      return k;
    } catch (e) { return ''; }                     // storage blocked: a code each time
  }
  /* "Chrome on Windows" — what the email and the list of computers call it. */
  function deviceLabel() {
    const u = navigator.userAgent || '';
    const b = /Edg\//.test(u) ? 'Edge' : /OPR\//.test(u) ? 'Opera' : /Firefox\//.test(u) ? 'Firefox' : /Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : 'A browser';
    const o = /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) ? 'iPad' : /Android/.test(u) ? 'Android' : /Windows/.test(u) ? 'Windows' : /Mac OS X|Macintosh/.test(u) ? 'Mac' : /Linux/.test(u) ? 'Linux' : '';
    return b + (o ? ' on ' + o : '');
  }

  function toSignIn(msg) {
    clearToken();
    const here = location.href.replace(ROOT, '');
    location.replace(ROOT + '?next=' + encodeURIComponent(here) + (msg ? '&why=' + encodeURIComponent(msg) : ''));
  }

  /* ── Back ────────────────────────────────────────────────────────────
     Did this page come from another page of JORIS, in this tab? Pages send no
     referrer, so the tab keeps note: each page, once it is drawn for someone
     signed in, says so (seen), and the next one remembers it was reached from
     inside. Back then goes back — the browser keeps the page as it was, so it
     is there at once — and a page opened cold (a bookmark, a link in an email)
     goes Home instead. */
  const IN = 'jor.office.in';
  let inside = false;
  try {
    if (history.state && typeof history.state.jorIn === 'boolean') inside = history.state.jorIn;
    else { inside = sessionStorage.getItem(IN) === '1'; history.replaceState(Object.assign({}, history.state || {}, { jorIn: inside }), ''); }
  } catch (e) { }
  function seen() { try { sessionStorage.setItem(IN, '1'); } catch (e) { } }
  function back() { if (inside && history.length > 1) history.back(); else location.href = ROOT; }
  /* A page the browser kept and has now put back (Back, Forward): still the right person's? Then
     its lists are asked for again behind it; otherwise it is drawn afresh. */
  let drawn = '';
  window.addEventListener('pageshow', e => {
    if (!e.persisted) return;
    asking = 0; busy(0);
    const k = meKept();
    if (!token() || !k || (drawn && sig(k.me) !== drawn)) { location.reload(); return; }
    lives.slice().forEach(x => { live(x[0], x[1], x[2]).catch(() => { }); });
  });

  /* ── Ready before they click ─────────────────────────────────────────
     Once a page is drawn, the lists of the other parts this person can open are
     fetched quietly, one at a time, and kept — so the next part shows at once
     instead of after the wait. Skipped for anything this tab kept in the last
     few minutes, when the tab is in the background, or on a phone saving data. */
  let warming = false;
  async function warm(list) {
    if (cfg.warm === false || warming || document.hidden || (navigator.connection && navigator.connection.saveData)) return;
    warming = true;
    try {
      for (const a of list) {
        if (document.hidden) break;
        if (lives.some(x => x[0] === a) || age(a) < 4 * 60000) continue;
        try { keep(a, null, await call(a, null, { quiet: true, silent: true })); } catch (e) { if (e.signin || e.offline) break; }
      }
    } finally { warming = false; }
  }

  /* One request. A plain-text POST, so the browser sends it straight to
     Google without asking first. */
  async function call(a, extra, opts) {
    const n = ++order;
    if (!cfg.server) throw new Error('This copy has no server link yet. Run SET_SERVER.bat.');
    if (DOOR && DOOR.shut) await doorOpen();              // only a shut door makes a request wait
    let res, j;
    const shown = !(opts && opts.silent);
    if (shown) busy(1);
    try {
      try {
        res = await fetch(cfg.server, {
          method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(Object.assign({ a: a, t: token() }, doorTag(), lookTag(), extra || {}))
        });
      } catch (e) { const err = new Error('No connection to the JOR server just now. Try again in a moment.'); err.offline = true; throw err; }
      if (!res.ok) { const err = new Error('The JOR server answered ' + res.status + '. Try again in a moment.'); err.offline = true; throw err; }
      j = await res.json();
    } finally { if (shown) busy(-1); }
    if (j.ok) answered[a] = Math.max(answered[a] || 0, n);
    if (!j.ok) {
      const msg = String(j.error || 'Something went wrong');
      if (/^signin:/.test(msg) && !(opts && opts.quiet)) { toSignIn(msg.slice(7)); throw new Error(msg.slice(7)); }
      /* This page was drawn while seeing JORIS as someone else, and that has ended (or moved on): drawn again as whoever it is now. */
      if (/^look:/.test(msg)) { forgetMe(); location.reload(); throw new Error(msg.slice(5)); }
      /* The door code has changed, or this computer never gave it: the door again. */
      if (/^door:/.test(msg)) { if (DOOR) DOOR.forget(); location.reload(); throw new Error(msg.slice(5)); }
      const err = new Error(msg.replace(/^(signin|stale):/, ''));
      err.stale = /^stale:/.test(msg); err.signin = /^signin:/.test(msg);
      throw err;
    }
    return j;
  }

  /* ── Seeing JORIS as someone on the team ─────────────────────────────
     Management can look at JORIS as a colleague sees it. The server does the
     seeing — every answer is worked out as that person, and nothing can be
     changed meanwhile. A page drawn that way says so with each request, so a
     click made after the look has ended can't land as the person themselves.
     What this tab had seen belongs to the other view, so it is forgotten. */
  function lookTag() { const k = meKept(); return k && k.me.viewer ? { as: k.me.id } : {}; }
  function forgetMe() { forget(); try { sessionStorage.removeItem(MK); localStorage.removeItem(MK); } catch (e) { } }
  async function look(id) {
    const r = await call(id ? 'view.as' : 'view.stop', id ? { id: id } : {});
    forget(); keepMe(r.me);
    location.href = ROOT;
  }

  /* A door code has been set since this computer was last asked (it was signed in already, so it
     never was): the door now, like every other computer. */
  function unasked(r) {
    if (!(r && r.door && DOOR && !DOOR.key)) return false;
    DOOR.forget(); location.reload();
    return true;
  }

  /* Who is signed in — or off to the sign-in page. */
  async function me() {
    if (!token()) { toSignIn(); return new Promise(() => {}); }
    const seen = meKept();
    if (!seen) { const r = await call('auth.me'); if (unasked(r)) return new Promise(() => { }); keepMe(r.me); drawn = sig(r.me); return r.me; }
    /* Asked again behind the page, every time: a role or a tick changed since is picked up within
       a few seconds, and the page is drawn again if it was drawn with the old one. */
    drawn = sig(seen.me);
    call('auth.me').then(r => { if (unasked(r)) return; const changed = sig(r.me) !== sig(seen.me); keepMe(r.me); if (changed) location.reload(); }).catch(() => { });
    return seen.me;
  }

  return { call: call, me: me, token: token, setToken: setToken, clearToken: clearToken, kept: kept, toSignIn: toSignIn, device: device, deviceLabel: deviceLabel, ROOT: ROOT, cfg: cfg,
    meKept: meKept, keepMe: keepMe, last: last, keep: keep, live: live, look: look, warm: warm, back: back, seen: seen, door: DOOR };
})();
