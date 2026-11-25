/* ═══════════════════════════════════════════════════════════════════════
   JOR Shows — talking to the server, and keeping everything on the phone
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
    let res, j;
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), (opts && opts.wait) || 60000);
    try {
      res = await fetch(cfg.server, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, signal: ctl.signal,
        body: JSON.stringify(Object.assign({ a: a, k: key() }, extra || {})) });
      if (!res.ok) throw new Error(String(res.status));
      j = await res.json();
    } catch (e) { const err = new Error('No signal — or JOR Shows didn’t answer.'); err.offline = true; throw err; }
    finally { clearTimeout(t); }
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
          merge(S.met, r.met || []);
          S.met = S.met.filter(m => !m.removed);
          S.people = r.people || S.people; S.joris = r.joris || S.joris; S.jorisAt = r.jorisAt; S.reading = r.reading; S.linked = r.linked;
        }
        if (r.today) S.today = r.today;
        S.syncedAt = Date.now();
        await keep();
        changed(r.same ? 'same' : 'sync');
        return r;
      } finally { syncing = null; }
    })();
    return syncing;
  }

  /* ── The outbox: saved here first, sent in order ── */
  const OUT = { busy: false, n: 0 };
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
    OUT.busy = true;
    let sent = 0, problem = '';
    try {
      for (const [k, it] of await pending()) {
        try {
          const r = await call(it.a, it.body, { wait: it.a === 'met.save' && it.body.read ? 90000 : 45000 });
          await del('outbox', k); sent++;
          if (it.after) await AFTER[it.after](it, r);
        } catch (e) {
          if (e.offline) break;
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
      const i = S.met.findIndex(m => m.id === it.local || m.id === r.met.id);
      if (i >= 0) S.met[i] = r.met; else S.met.push(r.met);
      await keep();
    }
  };
  window.addEventListener('online', () => flush());
  setInterval(() => { if (navigator.onLine !== false) flush(); }, 30000);

  return { call, key, forget, team, setKey, load, sync, keep, queue, flush, onChange, changed, OUT, get S() { return S; }, set S(v) { S = v; }, thumbs: { get: k => get('thumbs', k), put: (k, v) => put('thumbs', k, v) }, fresh: () => API_FRESH };
})();
