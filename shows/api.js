/* ═══════════════════════════════════════════════════════════════════════
   Trade Shows — talking to the server, and keeping everything on the phone
   · The way in is the person's own link: …/#k=BOR-xxxxxxxx. The secret is
     taken out of the address at once and kept on this phone only.
   · Everything the page shows is kept here (IndexedDB), so it opens at once
     with no signal; then it asks the server only for what changed.
   · Anything saved goes into an outbox first and is shown straight away;
     the outbox sends itself, in order, whenever there is signal.
   ═══════════════════════════════════════════════════════════════════════ */
window.API = (function () {
  'use strict';
  const cfg = window.SHOWS_CONFIG || {};
  const KEY = 'jorshows.key', TEAM = 'jorshows.team';
  /* A link opened: keep its secret, and take it out of the address bar (and of history). */
  (function () {
    const t = /(?:^|[#&])t=([A-Za-z0-9]{24,40})/.exec(location.hash.slice(1));
    if (t) {
      try { localStorage.setItem(TEAM, t[1]); } catch (e) { }
      history.replaceState(null, '', location.pathname + location.search);
    }
    const m = /(?:^|[#&])k=([A-Za-z]{1,4}-[A-Za-z0-9]{20,40})/.exec(location.hash.slice(1));
    if (m) {
      try { if (localStorage.getItem(KEY) !== m[1]) { localStorage.setItem(KEY, m[1]); localStorage.removeItem('jorshows.rev'); } } catch (e) { }
      history.replaceState(null, '', location.pathname + location.search);
      API_FRESH = true;
    }
  })();
  var API_FRESH;
  /* A link opened while the page is already open (same tab): start again with it. */
  window.addEventListener('hashchange', () => { if (/(?:^|[#&])(?:k=[A-Za-z]{1,4}-|t=[A-Za-z0-9]{24})/.test(location.hash.slice(1))) location.reload(); });
  const key = () => { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } };
  function forget() { try { localStorage.removeItem(KEY); localStorage.removeItem('jorshows.rev'); } catch (e) { } }
  const team = () => { try { return localStorage.getItem(TEAM) || ''; } catch (e) { return ''; } };
  function setKey(k) { try { localStorage.setItem(KEY, k); } catch (e) { } }

  async function call(a, extra, opts) {
    if (!cfg.server) throw new Error('This copy has no server link yet.');
    let res, j, text = '';
    const wait = (opts && opts.wait) || 60000, ctl = new AbortController(), t = setTimeout(() => ctl.abort(), wait);
    /* Each way it can fail says so: no signal, too slow, or the server sent something that isn't an answer. All are tried again. */
    const fail = (msg, kind) => { const err = new Error(msg); err.offline = true; err.kind = kind; return err; };
    try {
      res = await fetch(cfg.server, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, signal: ctl.signal,
        body: JSON.stringify(Object.assign({ a: a, k: key() }, extra || {})) });
      text = await res.text();
    } catch (e) {
      clearTimeout(t);
      throw e && e.name === 'AbortError' ? fail('Trade Shows took over ' + Math.round(wait / 1000) + ' seconds to answer — it will try again.', 'slow') : fail(navigator.onLine === false ? 'No signal on this phone.' : 'Couldn’t reach Trade Shows just now.', 'offline');
    }
    clearTimeout(t);
    if (!res.ok) throw fail('Trade Shows’ server answered ' + res.status + ' — it will try again.', 'server');
    try { j = JSON.parse(text); }
    catch (e) { const said = ((/<title>([^<]*)/i.exec(text) || [])[1] || text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')).trim().slice(0, 160); throw fail('Google sent back a page instead of an answer: “' + said + '”', 'server'); }
    if (!j.ok) {
      const msg = String(j.error || 'Something went wrong');
      const err = new Error(msg.replace(/^(signin|stale):/, ''));
      err.signin = /^signin:/.test(msg); err.stale = /^stale:/.test(msg);
      throw err;
    }
    return j;
  }

  /* ── The phone's own database ── */
  let dbp = null;
  function db() {
    if (!dbp) dbp = new Promise((ok, no) => {
      const r = indexedDB.open('jor-shows', 1);
      r.onupgradeneeded = () => { ['data', 'outbox', 'thumbs'].forEach(n => r.result.createObjectStore(n)); };
      r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
    });
    return dbp;
  }
  async function tx(store, mode, fn) {
    const d = await db();
    return new Promise((ok, no) => { const t = d.transaction(store, mode), st = t.objectStore(store), q = fn(st); t.oncomplete = () => ok(q && q.result); t.onerror = () => no(t.error); });
  }
  const get = (store, k) => tx(store, 'readonly', st => st.get(k));
  const put = (store, k, v) => tx(store, 'readwrite', st => st.put(v, k));
  const del = (store, k) => tx(store, 'readwrite', st => st.delete(k));
  const all = store => tx(store, 'readonly', st => st.getAll());
  const keys = store => tx(store, 'readonly', st => st.getAllKeys());

  /* ── Everything, kept, and brought up to date ── */
  let S = null;
  const listeners = [];
  function onChange(fn) { listeners.push(fn); }
  function changed(why) { listeners.forEach(f => { try { f(why); } catch (e) { console.error(e); } }); }
  async function load() {
    try { S = await get('data', 'S'); } catch (e) { S = null; }
    if (S && S.me && S.key !== key()) S = null;            // another person's link on this phone: start afresh
    return S;
  }
  async function keep() { try { S.key = key(); await put('data', 'S', S); } catch (e) { /* private mode: kept for this visit */ } }
  let syncing = null;
  async function sync() {
    if (syncing) return syncing;
    syncing = (async () => {
      try {
        const r = await call('sync', { since: S && S.rev ? S.rev : 0 }, { wait: 25000 });
        if (r.full || !S) S = { rev: 0, shows: [], met: [], people: [], joris: [] };
        S.me = r.me; S.rev = r.rev;
        if (!r.same) {
          const merge = (list, rows) => { const at = {}; list.forEach((x, i) => { at[x.id] = i; }); rows.forEach(x => { if (at[x.id] !== undefined) list[at[x.id]] = x; else list.push(x); }); };
          merge(S.shows, r.shows || []);
          if (Array.isArray(r.showIds)) { const keep = new Set(r.showIds); S.shows = S.shows.filter(s => s._local || keep.has(s.id)); }
          merge(S.met, r.met || []);
          /* One already on the server (it got there, though the phone gave up waiting): the copy still "sending" goes. */
          const there = {};
          S.met.forEach(m => { if (m.key && !m._local) there['tmp' + m.key] = 1; });
          S.met = S.met.filter(m => !m.removed && !(m._local && there[m.id]));
          S.people = r.people || S.people; S.joris = r.joris || S.joris; S.jorisAt = r.jorisAt; S.reading = r.reading; S.linked = r.linked;
        }
        if (r.today) S.today = r.today;
        if (r.reading !== undefined) { S.reading = r.reading; S.linked = r.linked; }
        S.syncedAt = Date.now();
        await keep();
        changed(r.same ? 'same' : 'sync');
        return r;
      } finally { syncing = null; }
    })();
    return syncing;
  }

  /* ── The outbox: saved here first, sent in order ── */
  const OUT = { busy: false, n: 0, why: '', at: 0 };
  async function queue(item) {
    item.at = Date.now();
    const id = String(item.at) + '-' + Math.random().toString(36).slice(2, 8);
    await put('outbox', id, item);
    OUT.n = (await keys('outbox')).length;
    changed('outbox');
    flush();
  }
  async function pending() { const ks = await keys('outbox'); ks.sort(); const items = []; for (const k of ks) items.push([k, await get('outbox', k)]); return items; }
  async function flush() {
    if (OUT.busy) return;
    OUT.busy = true; changed('outbox');
    let sent = 0, problem = '';
    try {
      /* Everything waiting, oldest first — including anything saved while this was sending. */
      for (let guard = 0; guard < 200; guard++) {
        const first = (await pending())[0];
        if (!first) { OUT.why = ''; break; }
        const [k, it] = first;
        try {
          const big = it.a === 'met.save' && it.body.photos && Object.keys(it.body.photos).length;
          const r = await call(it.a, it.body, { wait: it.a === 'scan.page' || (it.a === 'met.save' && (it.body.read || big)) ? 150000 : 60000 });
          await del('outbox', k); sent++; OUT.why = '';
          if (it.after) await AFTER[it.after](it, r);
          changed('outbox');
        } catch (e) {
          if (e.offline) { OUT.why = e.message; OUT.at = Date.now(); break; }
          if (e.signin) { problem = e.message; break; }
          /* Refused (someone changed it meanwhile, or it can't go in): taken out, said, and the list brought up to date. */
          await del('outbox', k); problem = e.message;
        }
      }
    } catch (e) { /* no database: nothing kept */ } finally { OUT.busy = false; }
    OUT.n = (await keys('outbox').catch(() => [])).length;
    if (problem) { changed({ problem }); if (S) S.rev = 0; }          // refused: the whole list again, so the phone shows what is really there
    if (sent || problem) { await sync().catch(() => { }); }
    changed('outbox');
  }
  /* What to do with the answer, by kind. */
  const AFTER = {
    /* A show made on the phone: if it already existed (same name), what was saved under it moves to the real one. */
    async show(it, r) {
      const was = it.body.show.local, now = r.show.id;
      const i = S.shows.findIndex(s => s.id === was);
      if (i >= 0) S.shows.splice(i, 1);
      if (!S.shows.some(s => s.id === now)) S.shows.push(r.show);
      if (was !== now) {
        S.met.forEach(m => { if (m.showId === was) m.showId = now; });
        for (const [k, o] of await pending()) { if (o.body && o.body.met && o.body.met.showId === was) { o.body.met.showId = now; await put('outbox', k, o); } if (o.body && o.body.showId === was) { o.body.showId = now; await put('outbox', k, o); } }
      }
      await keep();
    },
    async met(it, r) {
      S.met = S.met.filter(m => m.id !== it.local && m.id !== r.met.id);
      S.met.push(r.met);
      await keep();
    }
  };
  window.addEventListener('online', () => flush());
  setInterval(() => { if (navigator.onLine !== false) flush(); }, 30000);

  const removeWaiting = async k => { await del('outbox', k); OUT.n = (await keys('outbox')).length; changed('outbox'); };
  return { call, key, forget, team, setKey, pending, removeWaiting, load, sync, keep, queue, flush, onChange, changed, OUT, get S() { return S; }, set S(v) { S = v; }, thumbs: { get: k => get('thumbs', k), put: (k, v) => put('thumbs', k, v) }, fresh: () => API_FRESH };
})();
