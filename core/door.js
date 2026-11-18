/* ═══════════════════════════════════════════════════════════════════════
   JORIS — the door
   Until a computer or phone has given JOR's door code, a page of JORIS shows
   nothing: a white page, and a small box at the bottom to type the code in.
   No name, no logo, no sign-in form — to a stranger or a bot the link looks
   blank. The code is given once; the computer is remembered after that.

   This file only keeps things out of sight. The lock is the server's: while
   a door code is set it lets nobody try a password without the key it gave
   this computer in return for the code (server/src/10-auth.js). The code is
   checked there, never here — nothing in these pages says what it is.

   Loaded in the <head> of every office page, before anything is drawn. The
   guide's page and the complaint form don't load it: they are for people
   outside JOR.
   ═══════════════════════════════════════════════════════════════════════ */
window.JOR_DOOR = (function () {
  'use strict';
  const K = 'jor.office.door', OPEN = 'open';      // OPEN: the server has said there is no door code
  const get = () => { try { return localStorage.getItem(K) || ''; } catch (e) { return ''; } };
  const put = v => { try { if (v) localStorage.setItem(K, v); else localStorage.removeItem(K); } catch (e) { } };
  const had = get();
  let letIn = null;
  const D = {
    key: had && had !== OPEN ? had : '',
    shut: !had,
    /* Everything that talks to the server waits for this. */
    wait: had ? Promise.resolve() : new Promise(ok => { letIn = ok; }),
    keep: v => { put(v || OPEN); D.key = v && v !== OPEN ? v : ''; },
    forget: () => { put(''); D.key = ''; }
  };
  if (had) return D;

  /* Shut: nothing of the page shows, and the tab says nothing either. */
  const root = document.documentElement, title = document.title, BLANK = '‎';
  const css = document.createElement('style');
  css.textContent = 'html.jdoor,html.jdoor body{background:#fff!important}' +
    'html.jdoor body>*:not(#jdoor){display:none!important}' +
    '#jdoor{position:fixed;left:0;right:0;bottom:22px;display:flex;justify-content:center}' +
    '#jdoor input{width:170px;max-width:60vw;border:1px solid #E4E7E6;border-radius:10px;padding:9px 12px;font:16px system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center;color:#333;background:#fff;outline:none}' +
    '#jdoor input:focus{border-color:#C5CCC9}' +
    '#jdoor.no{animation:jdoor .3s}' +
    '@keyframes jdoor{25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}';
  root.classList.add('jdoor');
  document.head.appendChild(css);
  document.title = BLANK;
  const icon = document.querySelector('link[rel="icon"]'), iconWas = icon ? icon.getAttribute('href') : '';
  if (icon) icon.setAttribute('href', 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==');

  function open(v) {
    D.keep(v); D.shut = false;
    const box = document.getElementById('jdoor');
    if (box) box.remove();
    root.classList.remove('jdoor'); css.remove();
    if (document.title === BLANK) document.title = title;
    if (icon && iconWas) icon.setAttribute('href', iconWas);
    letIn();
  }
  async function ask(a, extra) {
    const server = (window.JOR_CONFIG || {}).server;
    if (!server) return { ok: true, on: false };           // a copy with no server yet: nothing to guard
    const res = await fetch(server, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ a: a }, extra || {})) });
    return res.json();
  }
  function start() {
    const box = document.createElement('div');
    box.id = 'jdoor';
    box.innerHTML = '<input type="password" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="go" aria-label="Code">';
    document.body.appendChild(box);
    const inp = box.firstChild;
    let busy = false;
    inp.addEventListener('keydown', async e => {
      if (e.key !== 'Enter' || busy || !inp.value.trim()) return;
      busy = true; inp.disabled = true;
      let r = null;
      try { r = await ask('door.open', { code: inp.value }); } catch (x) { /* no connection: as a wrong code */ }
      if (r && r.ok && (r.key || r.on === false)) { open(r.key || OPEN); return; }
      inp.value = ''; inp.disabled = false; busy = false;
      box.classList.remove('no'); void box.offsetWidth; box.classList.add('no');
      inp.focus();
    });
    inp.focus();
    /* No door code set (or a server from before there was one): nothing to ask for. */
    ask('door.state').then(r => { if (D.shut && r && ((r.ok && r.on === false) || (!r.ok && /Unknown request/.test(r.error || '')))) open(OPEN); }).catch(() => { });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  return D;
})();
