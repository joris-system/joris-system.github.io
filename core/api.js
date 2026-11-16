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
  const TK = 'jor.office.token';
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
    try { sessionStorage.removeItem(TK); localStorage.removeItem(TK); } catch (e) { }
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
    location.href = ROOT + '?next=' + encodeURIComponent(here) + (msg ? '&why=' + encodeURIComponent(msg) : '');
  }

  /* One request. A plain-text POST, so the browser sends it straight to
     Google without asking first. */
  async function call(a, extra, opts) {
    if (!cfg.server) throw new Error('This copy has no server link yet. Run SET_SERVER.bat.');
    let res;
    try {
      res = await fetch(cfg.server, {
        method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({ a: a, t: token() }, extra || {}))
      });
    } catch (e) { const err = new Error('No connection to the JOR server just now. Try again in a moment.'); err.offline = true; throw err; }
    if (!res.ok) { const err = new Error('The JOR server answered ' + res.status + '. Try again in a moment.'); err.offline = true; throw err; }
    const j = await res.json();
    if (!j.ok) {
      const msg = String(j.error || 'Something went wrong');
      if (/^signin:/.test(msg) && !(opts && opts.quiet)) { toSignIn(msg.slice(7)); throw new Error(msg.slice(7)); }
      const err = new Error(msg.replace(/^(signin|stale):/, ''));
      err.stale = /^stale:/.test(msg); err.signin = /^signin:/.test(msg);
      throw err;
    }
    return j;
  }

  /* Who is signed in — or off to the sign-in page. */
  async function me() {
    if (!token()) { toSignIn(); return new Promise(() => {}); }
    const r = await call('auth.me');
    return r.me;
  }

  return { call: call, me: me, token: token, setToken: setToken, clearToken: clearToken, kept: kept, toSignIn: toSignIn, device: device, deviceLabel: deviceLabel, ROOT: ROOT, cfg: cfg };
})();
