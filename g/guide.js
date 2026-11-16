/* JORIS — the guide file on the guide's phone. Moved in from the JOR Guide
   File trial: the same phone, the same offline copy, now kept on the file. */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = GF.esc, I = GF.icon;
  const KEY = 'jorgf.guide', OUTBOX = 'jorgf.outbox';
  const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/';

  /* A guide often has two groups at once — back to back, the last day of one
     is the first of the next — so the phone keeps every group it is given. */
  let book = load();           // { groups: { code: { code, group, docs, checkedAt } }, current }
  let state = book.current ? book.groups[book.current] || null : null;   // the group on screen
  let saved = {}, savedIn = {}; // doc id -> date saved on this phone, and its group's code
  let busy = false;
  const codes = () => Object.keys(book.groups);

  /* ══ What this phone keeps ═══════════════════════════════════════════
     The code and the list in localStorage; the documents themselves in
     IndexedDB, so they open with no signal.                            */
  function load() {
    let b = null;
    try { b = JSON.parse(localStorage.getItem(KEY)); } catch (e) { }
    if (b && b.code && !b.groups) b = { groups: { [b.code]: b }, current: b.code };   // a phone from before there could be two
    return b && b.groups ? b : { groups: {}, current: null };
  }
  function keep() { try { localStorage.setItem(KEY, JSON.stringify(book)); } catch (e) { /* private mode */ } }
  function outbox() { try { return JSON.parse(localStorage.getItem(OUTBOX)) || []; } catch (e) { return []; } }
  function setOutbox(list) { try { localStorage.setItem(OUTBOX, JSON.stringify(list)); } catch (e) { } }

  let dbp = null;
  function db() {
    if (!dbp) dbp = new Promise((ok, bad) => {
      const r = indexedDB.open('jor-guide-file', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('files');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => bad(r.error);
    });
    return dbp;
  }
  async function idb(mode, fn) {
    const d = await db();
    return new Promise((ok, bad) => {
      const t = d.transaction('files', mode), s = t.objectStore('files');
      const r = fn(s);
      t.oncomplete = () => ok(r && 'result' in r ? r.result : undefined);
      t.onerror = () => bad(t.error);
    });
  }
  const getFile = id => idb('readonly', s => s.get(id));
  const putFile = (id, v) => idb('readwrite', s => s.put(v, id));
  const delFile = id => idb('readwrite', s => s.delete(id));
  const allKeys = () => idb('readonly', s => s.getAllKeys());
  async function savedList() {
    saved = {}; savedIn = {};
    try {
      for (const id of await allKeys()) { const f = await getFile(id); if (f) { saved[id] = f.uploaded; savedIn[id] = f.code || ''; } }
    } catch (e) { /* storage blocked: everything comes from the server */ }
  }

  /* Take one group off the phone: its documents and any notes waiting to send. */
  async function dropGroup(code) {
    const g = book.groups[code];
    const ids = new Set(((g && g.docs) || []).map(d => d.id));
    try {
      for (const id of await allKeys()) if (ids.has(id) || savedIn[id] === code) { await delFile(id); delete saved[id]; delete savedIn[id]; }
    } catch (e) { }
    delete book.groups[code];
    setOutbox(outbox().filter(m => m.code !== code));
    if (book.current === code) book.current = pickCurrent();
    state = book.current ? book.groups[book.current] : null;
    keep();
    keepCodeInAddress();
  }

  /* The group to show: the one on tour today, else the next to arrive. On a
     changeover day both are on, and the one already showing stays. */
  function pickCurrent() {
    const list = codes().map(c => book.groups[c]);
    if (!list.length) return null;
    const today = GF.ymd(new Date());
    const on = list.filter(x => x.group.arrival && x.group.arrival <= today && (!x.group.departure || today <= x.group.departure));
    if (on.some(x => x.code === book.current)) return book.current;
    if (on.length) return on[0].code;
    const next = list.filter(x => !x.group.arrival || x.group.arrival >= today).sort((a, b) => (a.group.arrival || '9') < (b.group.arrival || '9') ? -1 : 1)[0];
    return (next || list[0]).code;
  }
  function show(code) { book.current = code; state = book.groups[code] || null; keep(); }

  function toast(msg, ms) {
    const t = $('#toast'); t.innerHTML = msg; t.classList.add('on');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), ms || 3200);
  }
  const IOS = /iPhone|iPad/.test(navigator.userAgent);
  const STANDALONE = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  /* An iPhone keeps a home-screen app's storage apart from Safari's, and opens
     it at the address it was added from. Keeping the code in that address
     (after the #, so it is never sent anywhere) lets it open straight in. */
  function keepCodeInAddress() {
    if (!IOS || STANDALONE) return;
    history.replaceState(null, '', location.pathname + (codes().length ? '#c=' + codes().join(',') : ''));
  }

  function device() {
    const u = navigator.userAgent;
    return /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) ? 'iPad' : /Android/.test(u) ? 'Android phone' : /Mobile/.test(u) ? 'phone' : 'computer';
  }

  /* ══ The way in ═════════════════════════════════════════════════════ */

  async function signIn(code) {
    if (book.groups[code]) { show(code); await showApp(); return true; }
    $('#gerr').textContent = '';
    $('#go').disabled = true; $('#go').textContent = 'Opening…';
    try {
      const r = await GF.api('guide.open', code, { device: device() });
      book.groups[code] = { code: code, group: r.group, docs: r.docs, checkedAt: new Date().toISOString() };
      show(code);
      keepCodeInAddress();
      await showApp();
      paintInstall();
      saveAll(state);
      return true;
    } catch (e) {
      $('#gerr').textContent = e.offline ? 'No signal just now — try again when you have some.' : e.message;
      return false;
    } finally {
      $('#go').disabled = false; $('#go').textContent = 'Open my guide file';
    }
  }

  function showGate(msg) {
    $('#app').classList.add('hidden'); $('#gate').classList.remove('hidden');
    $('#gerr').textContent = msg || '';
    $('#code').value = '';
    $('#back').classList.toggle('hidden', !codes().length);
    setTimeout(() => $('#code').focus(), 50);
  }

  async function showApp() {
    $('#gate').classList.add('hidden'); $('#app').classList.remove('hidden');
    await savedList();
    render();
    window.scrollTo(0, 0);
  }

  /* ══ The guide file ═════════════════════════════════════════════════ */

  function dayDate(day) { return state.group.arrival && day ? GF.addDays(state.group.arrival, day - 1) : ''; }

  function docRow(d) {
    const isImg = /^image\//.test(d.type);
    const bits = [];
    if (d.day) bits.push('Day ' + d.day + (dayDate(d.day) ? ' · ' + GF.nice(dayDate(d.day), true) : ''));
    bits.push(GF.size(d.size));
    if (d.category === 'Vouchers' && d.counted) bits.push(d.counted.pax + ' came' + (d.booked !== '' && d.booked !== undefined ? ' of ' + d.booked : ''));
    const ok = !!saved[d.id];
    return '<button class="doc" data-doc="' + esc(d.id) + '"><span class="ic">' + I(isImg ? 'img' : 'doc', 'lg') + '</span>' +
      '<span class="nm"><b>' + esc(d.name.replace(/\.(pdf|docx?|xlsx?|pptx?|jpe?g|png)$/i, '')) + '</b><span class="mini">' + esc(bits.join(' · ')) + '</span></span>' +
      '<span class="st' + (ok ? '' : ' wait') + '" title="' + (ok ? 'Saved on this phone' : 'Not saved on this phone yet') + '">' + I(ok ? 'check' : 'cloud', 'sm') + '</span></button>';
  }

  function paintGroups() {
    const list = codes().map(c => book.groups[c]).sort((a, b) => (a.group.arrival || '') < (b.group.arrival || '') ? -1 : 1);
    const el = $('#groups');
    if (list.length < 2) { el.classList.add('hidden'); el.innerHTML = ''; return; }
    el.innerHTML = list.map(x => '<button data-g="' + esc(x.code) + '" class="' + (x.code === book.current ? 'on' : '') + '"><b>' + esc(x.group.ref) + '</b><span>' +
      esc(x.group.arrival ? GF.nice(x.group.arrival) + (x.group.departure ? ' – ' + GF.nice(x.group.departure) : '') : x.group.tour) + '</span></button>').join('');
    el.classList.remove('hidden');
  }

  function render() {
    paintGroups();
    const g = state.group, docs = state.docs || [];
    $('#t-tour').textContent = g.tour;
    $('#t-sub').textContent = g.ref + (g.arrival ? ' · ' + GF.nice(g.arrival) + (g.departure ? ' – ' + GF.nice(g.departure) : '') : '') + (g.guide ? ' · ' + g.guide : '');
    $('#refresh').innerHTML = I('refresh');

    /* Today, if the tour is on */
    const today = GF.ymd(new Date());
    const td = GF.tourDay(g.arrival, today);
    let h = '';
    if (g.arrival && today >= g.arrival && (!g.departure || today <= g.departure)) {
      const mine = docs.filter(d => d.day === td);
      h = '<div class="today"><h3>Today<span>Day ' + td + ' · ' + esc(GF.nice(today, true)) + '</span></h3>' +
        (mine.length ? '<div class="list">' + mine.map(docRow).join('') + '</div><div style="height:8px"></div>'
          : '<div class="empty">Nothing marked for today — everything is below.</div>') + '</div>';
    }
    $('#today').innerHTML = h;

    /* Everything, section by section */
    $('#sections').innerHTML = docs.length ? GF.CATS.map(c => {
      const list = docs.filter(d => d.category === c);
      return list.length ? '<h2>' + esc(c) + '<span class="mini">' + list.length + '</span></h2><div class="list">' + list.map(docRow).join('') + '</div>' : '';
    }).join('') : '<div class="card blank">The office hasn’t added any documents yet. They’ll appear here, and save to this phone, as soon as they do.</div>';

    $('#notes').innerHTML = g.notes ? '<h2>From the office</h2><div class="card notes">' + esc(g.notes) + '</div>' : '';

    const tel = g.contactPhone ? GF.intl(g.contactPhone) : '';
    $('#contact').innerHTML = '<h3>' + esc(g.contact || 'The JOR office') + '</h3>' +
      '<div class="mini">' + esc([g.contactPhone, g.contactEmail].filter(Boolean).join(' · ') || 'Your contact at JOR') + '</div>' +
      '<div class="row">' +
      (tel ? '<a class="btn" href="tel:+' + esc(tel) + '">' + I('phone', 'sm') + 'Call</a><a class="btn" href="https://wa.me/' + esc(tel) + '" target="_blank" rel="noopener">' + I('msg', 'sm') + 'WhatsApp</a>' : '') +
      '</div>' +
      '<textarea class="in" id="note" placeholder="Something missing or wrong? Tell the office here."></textarea>' +
      '<div class="row"><button class="btn p" id="send">Send to the office</button></div>';
    $('#send').onclick = sendNote;
    paintStatus();
  }

  let status = { kind: 'ok' };
  function paintStatus() {
    const s = status, el = $('#status');
    el.className = 'status' + (s.kind === 'off' ? ' off' : '');
    const at = state && state.checkedAt;
    if (s.kind === 'saving') el.innerHTML = I('cloud', 'sm') + 'Saving to this phone — ' + s.done + ' of ' + s.of + '<span class="bar"><i style="width:' + Math.round(100 * s.done / s.of) + '%"></i></span>';
    else if (s.kind === 'checking') el.innerHTML = I('refresh', 'sm') + 'Checking for new documents…';
    else if (s.kind === 'off') el.innerHTML = I('off', 'sm') + 'No signal — showing what’s saved on this phone' + (at ? ' (checked ' + esc(localWhen(state.checkedAt)) + ')' : '');
    else {
      const all = (state.docs || []).length, have = (state.docs || []).filter(d => saved[d.id]).length;
      el.innerHTML = I('check', 'sm') + (all ? (have === all ? 'All ' + all + ' saved on this phone — they open without signal' : have + ' of ' + all + ' saved on this phone') : 'Up to date') +
        (state.checkedAt ? ' · checked ' + esc(localWhen(state.checkedAt)) : '');
    }
  }
  function localWhen(iso) { const d = new Date(iso); return GF.when(GF.ymd(d) + 'T' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2)); }

  /* ══ Keeping the phone up to date ═══════════════════════════════════ */

  /* A tour that went home over a week ago comes off the phone by itself, signal or no signal —
     the same week the office's side allows. A phone that never comes back online doesn't keep
     passengers' names for ever. */
  const isoDay = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const dayPlus = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoDay(d); };
  async function tidyOld() {
    const now = isoDay(new Date());
    for (const code of codes()) {
      const g = (book.groups[code] || {}).group || {};
      const home = g.departure || (g.arrival ? dayPlus(g.arrival, 23) : '');
      if (/^\d{4}-\d{2}-\d{2}$/.test(home) && now > dayPlus(home, 7)) await dropGroup(code);
    }
  }

  async function sync(quiet) {
    if (!busy) await tidyOld();
    if (busy || !codes().length) return;
    busy = true;
    status = { kind: 'checking' }; paintStatus();
    let changed = false;
    const gone = [];
    try {
      await flush();
      for (const code of codes()) {
        const entry = book.groups[code];
        try {
          const r = await GF.api('guide.open', code, { device: device() });
          const before = (entry.docs || []).map(d => d.id + d.uploaded).join();
          entry.group = r.group; entry.docs = r.docs; entry.checkedAt = new Date().toISOString();
          if (code === book.current && r.docs.map(d => d.id + d.uploaded).join() !== before) changed = true;
        } catch (e) {
          if (e.closed) gone.push({ code: code, ref: entry.group.ref, why: e.message });
          else if (e.server && /code isn’t right/.test(e.message)) gone.push({ code: code, ref: entry.group.ref, why: 'Its code has changed — ask the office for the new one.' });
          else throw e;
        }
      }
    } catch (e) {
      busy = false;
      status = { kind: 'off' }; paintStatus();
      return;
    }
    for (const x of gone) await dropGroup(x.code);
    keep();
    busy = false;
    if (!codes().length) { showGate(gone[0].why + ' Its documents have been removed from this phone.'); return; }
    if (!state) show(pickCurrent());
    render();
    if (gone.length) toast(esc(gone.map(x => x.ref).join(', ') + ': ' + gone[0].why + ' Removed from this phone.'), 6000);
    else if (!quiet && changed) toast('The office has updated your guide file.');
    for (const code of codes()) await saveAll(book.groups[code]);
  }

  /* Every document onto the phone; anything the office removed comes off. */
  async function saveAll(entry) {
    if (!entry) return;
    busy = true;
    try {
      const want = {}; entry.docs.forEach(d => { want[d.id] = d; });
      for (const id of Object.keys(saved)) if (savedIn[id] === entry.code && !want[id]) { await delFile(id).catch(() => {}); delete saved[id]; delete savedIn[id]; }
      const need = entry.docs.filter(d => saved[d.id] !== d.uploaded);
      for (let i = 0; i < need.length; i++) {
        status = { kind: 'saving', done: i, of: need.length }; paintStatus();
        const d = need[i];
        const f = await GF.api('guide.file', entry.code, { docId: d.id, save: true });
        try { await putFile(d.id, { bytes: GF.b64ToBytes(f.data).buffer, type: f.type, uploaded: d.uploaded, code: entry.code }); saved[d.id] = d.uploaded; savedIn[d.id] = entry.code; }
        catch (e) { /* storage full or blocked: it still opens online */ }
        const row = document.querySelectorAll('[data-doc="' + d.id + '"] .st');
        row.forEach(r => { r.classList.remove('wait'); r.innerHTML = I('check', 'sm'); });
      }
      status = { kind: 'ok' };
    } catch (e) {
      status = { kind: e.offline ? 'off' : 'ok' };
    } finally {
      busy = false; paintStatus();
    }
  }

  /* Notes and "opened" marks wait here while there's no signal. */
  async function flush() {
    const list = outbox();
    if (!list.length) return;
    const left = [];
    for (const m of list) {
      const code = m.code || (state && state.code);
      if (!code || !book.groups[code]) continue;
      try {
        if (m.kind === 'note') await GF.api('guide.note', code, { text: m.text });
        else if (m.kind === 'seen') await GF.api('guide.seen', code, { docId: m.docId, at: m.at });
        else if (m.kind === 'count') await GF.api('guide.count', code, { docId: m.docId, pax: m.pax, note: m.note, device: device() });
      } catch (e) { if (e.offline) left.push(m); }
    }
    setOutbox(left);
  }
  function queue(m) { const l = outbox(); l.push(m); setOutbox(l); flush().catch(() => {}); }

  async function sendNote() {
    const t = $('#note').value.trim();
    if (!t) { $('#note').focus(); return; }
    $('#send').disabled = true;
    try {
      await GF.api('guide.note', state.code, { text: t });
      $('#note').value = ''; toast('Sent to the office.');
    } catch (e) {
      if (e.offline) { queue({ kind: 'note', text: t, code: state.code }); $('#note').value = ''; toast('No signal — it will send as soon as there is.'); }
      else toast(esc(e.message));
    } finally { $('#send').disabled = false; }
  }

  /* ══ Opening a document ═════════════════════════════════════════════ */

  let pdfjs = null;
  async function loadPdf() {
    if (pdfjs) return pdfjs;
    const lib = await import(PDFJS + 'build/pdf.min.mjs');
    lib.GlobalWorkerOptions.workerSrc = PDFJS + 'build/pdf.worker.min.mjs';
    return (pdfjs = lib);
  }

  let current = null;
  async function openDoc(id) {
    const d = (state.docs || []).find(x => x.id === id);
    if (!d) return;
    current = { d: d, blob: null };
    $('#v-name').textContent = d.name.replace(/\.(pdf|docx?|xlsx?|pptx?|jpe?g|png)$/i, '');
    $('#v-sub').textContent = [d.category, d.day ? 'Day ' + d.day : ''].filter(Boolean).join(' · ');
    $('#v-back').innerHTML = I('back', 'lg'); $('#v-share').innerHTML = I('share');
    $('#pages').innerHTML = '<div class="msg">Opening…</div>';
    $('#viewer').classList.remove('hidden');
    paintCount(d);
    history.pushState({ v: 1 }, '');

    let f = await getFile(id).catch(() => null);
    if (!f) {
      try {
        const r = await GF.api('guide.file', state.code, { docId: id });
        f = { bytes: GF.b64ToBytes(r.data).buffer, type: r.type, uploaded: d.uploaded };
        const code = state.code;
        putFile(id, Object.assign({ code: code }, f)).then(() => { saved[id] = d.uploaded; savedIn[id] = code; paintStatus(); }).catch(() => {});
      } catch (e) {
        $('#pages').innerHTML = '<div class="msg">' + (e.offline ? 'This one isn’t saved on this phone yet, and there’s no signal. It will save itself the next time there is.' : esc(e.message)) + '</div>';
        return;
      }
    } else queue({ kind: 'seen', docId: id, at: new Date().toISOString(), code: state.code });
    current.blob = new Blob([f.bytes], { type: f.type });

    if (/^image\//.test(f.type)) {
      const u = URL.createObjectURL(current.blob);
      $('#pages').innerHTML = '<img alt="" src="' + u + '">';
      return;
    }
    if (f.type !== 'application/pdf') {
      $('#pages').innerHTML = '<div class="msg">This one can’t be shown here — the office couldn’t turn it into a PDF. Open it in another app on your phone.<br><button class="btn p" id="v-open">Open it</button></div>';
      $('#v-open').onclick = shareDoc;
      return;
    }
    try {
      const lib = await loadPdf();
      const pdf = await lib.getDocument({ data: new Uint8Array(f.bytes.slice(0)), isEvalSupported: false }).promise;
      if (!current || current.d.id !== id) return;
      $('#pages').innerHTML = '';
      const w = Math.min($('#pages').clientWidth - 16, 900);
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      for (let n = 1; n <= pdf.numPages; n++) {
        if (!current || current.d.id !== id) return;
        const page = await pdf.getPage(n);
        const v1 = page.getViewport({ scale: 1 });
        const vp = page.getViewport({ scale: (w * dpr) / v1.width });
        const c = document.createElement('canvas');
        c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
        $('#pages').appendChild(c);
        await page.render({ canvasContext: c.getContext('2d'), canvas: c, viewport: vp, background: '#ffffff' }).promise;
      }
    } catch (e) {
      $('#pages').innerHTML = '<div class="msg">This PDF wouldn’t open here' + (navigator.onLine ? '' : ' without signal the first time') + '. Open it in another app instead.<br><button class="btn p" id="v-open">Open it</button></div>';
      $('#v-open').onclick = shareDoc;
    }
  }

  function closeDoc() {
    current = null;
    $('#viewer').classList.add('hidden');
    $('#count').classList.add('hidden');
    $('#pages').innerHTML = '';
  }

  /* On a voucher: who actually turned up. 36 booked, 30 on the bus — the
     supplier bills for 30, and the office checks the bill against it. */
  function paintCount(d) {
    const el = $('#count');
    if (d.category !== 'Vouchers') { el.classList.add('hidden'); el.innerHTML = ''; return; }
    const was = d.counted ? d.counted.pax : '';
    el.innerHTML = '<span>' + (d.booked !== '' && d.booked !== undefined ? 'Booked for <b>' + esc(d.booked) + '</b>. ' : '') + 'How many came?</span>' +
      '<input class="in" id="c-pax" type="number" min="0" inputmode="numeric" value="' + esc(was !== '' ? was : d.booked !== undefined ? d.booked : '') + '">' +
      '<button class="btn sm p" id="c-go">' + (was !== '' ? 'Change' : 'Send') + '</button>' + (was !== '' ? '<span class="mini">You sent ' + esc(was) + '</span>' : '');
    el.classList.remove('hidden');
    $('#c-go').onclick = async () => {
      const pax = $('#c-pax').value.trim();
      if (pax === '' || !(+pax >= 0)) { $('#c-pax').focus(); return; }
      const code = state.code;
      d.counted = { pax: +pax, at: new Date().toISOString(), note: '' };
      keep();
      try { await GF.api('guide.count', code, { docId: d.id, pax: +pax, device: device() }); toast('Sent: ' + esc(pax) + '. The office checks the bill against it.'); }
      catch (e) { if (e.offline) { queue({ kind: 'count', docId: d.id, pax: +pax, code: code }); toast('No signal — it will send as soon as there is.'); } else toast(esc(e.message)); }
      paintCount(d);
    };
  }

  /* Share it on (a voucher to a supplier on WhatsApp), or save it to the phone. */
  async function shareDoc() {
    if (!current || !current.blob) return;
    const ext = current.blob.type === 'application/pdf' ? '.pdf' : /^image\/(\w+)/.test(current.blob.type) ? '.' + RegExp.$1.replace('jpeg', 'jpg') : '';
    const name = current.d.name.replace(/\.[^.]+$/, '') + (ext || ('.' + (current.d.name.split('.').pop() || 'bin')));
    const file = new File([current.blob], name, { type: current.blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: current.d.name }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  }

  /* ══ Putting it on the home screen ══════════════════════════════════ */

  let installEvt = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; paintInstall(); });
  function paintInstall() {
    let dismissed = false; try { dismissed = !!localStorage.getItem('jorgf.installHint'); } catch (e) { }
    const el = $('#install');
    if (STANDALONE || dismissed || !state) { el.classList.add('hidden'); return; }
    if (!installEvt && !IOS) { el.classList.add('hidden'); return; }
    el.innerHTML = '<span>' + (IOS ? 'Keep it on your home screen: tap <b>Share</b>, then <b>Add to Home Screen</b>. If it asks for the code there, it’s <b>' + esc(GF.prettyCode(state.code)) + '</b>.' : 'Keep it on your home screen, like an app.') + '</span>' +
      (installEvt ? '<button class="btn sm p" id="inst">Add</button>' : '') + '<button class="btn sm" id="inst-x">Not now</button>';
    el.classList.remove('hidden');
    if (installEvt) $('#inst').onclick = async () => { installEvt.prompt(); installEvt = null; el.classList.add('hidden'); };
    $('#inst-x').onclick = () => { try { localStorage.setItem('jorgf.installHint', '1'); } catch (e) { } el.classList.add('hidden'); };
  }

  /* ══ Start ══════════════════════════════════════════════════════════ */

  document.querySelectorAll('img[data-logo]').forEach(i => { i.src = window.JOR_MARKS.logo; });
  $('#go').onclick = () => { const c = $('#code').value.replace(/[^A-Za-z0-9]/g, '').toUpperCase(); if (c.length !== 8) { $('#gerr').textContent = 'The code is eight letters and numbers.'; return; } signIn(c); };
  $('#code').addEventListener('keydown', e => { if (e.key === 'Enter') $('#go').click(); });
  $('#refresh').onclick = () => sync();
  $('#forget').onclick = async () => {
    if (!confirm('Remove ' + state.group.ref + ' and its documents from this phone? You’ll need its code again to get them back.')) return;
    const ref = state.group.ref;
    await dropGroup(state.code);
    if (codes().length) { await showApp(); toast(esc(ref) + ' removed from this phone.'); } else showGate('Removed from this phone.');
  };
  $('#addg').onclick = () => showGate('Type the code for the other group — it’s in the office’s message.');
  $('#back').onclick = () => showApp();
  $('#groups').addEventListener('click', e => { const b = e.target.closest('[data-g]'); if (b) { show(b.dataset.g); render(); window.scrollTo(0, 0); } });
  $('#sections').addEventListener('click', e => { const b = e.target.closest('[data-doc]'); if (b) openDoc(b.dataset.doc); });
  $('#today').addEventListener('click', e => { const b = e.target.closest('[data-doc]'); if (b) openDoc(b.dataset.doc); });
  $('#v-back').onclick = () => history.back();
  $('#v-share').onclick = shareDoc;
  window.addEventListener('popstate', () => { if (!$('#viewer').classList.contains('hidden')) closeDoc(); });
  window.addEventListener('online', () => sync(true));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && codes().length) sync(true); });

  /* A link from the office carries a code: add that group (or show it, if the
     phone has it already), then take the code out of the address. An iPhone
     keeps every code after the #, as above. */
  const fromQuery = (new URLSearchParams(location.search).get('c') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const fromHash = ((location.hash.match(/^#c=([A-Za-z0-9,]+)/) || [])[1] || '').toUpperCase().split(',').filter(c => c.length === 8);
  const linked = (fromQuery.length === 8 ? [fromQuery] : []).concat(fromHash.filter(c => c !== fromQuery));
  if (location.search || location.hash) history.replaceState(null, '', location.pathname);
  keepCodeInAddress();

  (async () => {
    const fresh = linked.filter(c => !book.groups[c]);
    if (fresh.length) {
      $('#gate').classList.remove('hidden');
      for (const c of fresh.reverse()) { $('#code').value = GF.prettyCode(c); await signIn(c); }
      if (codes().length) sync(true);
      return;
    }
    if (codes().length) {
      show(fromQuery.length === 8 && book.groups[fromQuery] ? fromQuery : pickCurrent());
      await showApp(); paintInstall(); sync(true);
    } else showGate();
  })();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  window.JORGF = { state: () => state, book: () => book, saved: () => saved, sync: sync };
})();
