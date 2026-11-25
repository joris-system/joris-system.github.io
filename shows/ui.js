/* JOR Shows — small pieces the page uses: escaping, icons, dialogs, the toast, dates, pick-from-a-list.
   Taken from JORIS so the two look and work alike. */
window.UI = (function () {
  'use strict';
  const D = window.JORWF_DATES, RU = window.JOR_RULES;

  /* Everything a person typed goes through this before it is shown. */
  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  const ICONS = {
    plus: '<path d="M12 5v14M5 12h14"/>', back: '<path d="M15 18l-6-6 6-6"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>', check: '<path d="M20 6 9 17l-5-5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    users: '<circle cx="9" cy="8" r="4"/><path d="M1 21a8 8 0 0 1 16 0"/><path d="M17 4a4 4 0 0 1 0 8M23 21a8 8 0 0 0-5-7.4"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>', chart: '<path d="M3 3v18h18"/><path d="M7 15v3M12 10v8M17 6v12"/>',
    bed: '<path d="M2 4v16M2 12h20v8M22 12a4 4 0 0 0-4-4H10v4"/><circle cx="6" cy="9" r="2"/>', doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>', out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    flag: '<path d="M4 22V4M4 4h13l-2 4 2 4H4"/>', key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.3-9.3M17 6l3 3"/>',
    hash: '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>', map: '<path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3z"/><path d="M9 3v15M15 6v15"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>',
    euro: '<path d="M18 7a7 7 0 1 0 0 10"/><path d="M4 10h10M4 14h10"/>', calc: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h8"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>',
    down: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
    print: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>', mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>',
    tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.5"/>',
    home: '<path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>', warn: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>', trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    plane: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
    swap: '<path d="M17 3l4 4-4 4"/><path d="M3 7h18"/><path d="M7 21l-4-4 4-4"/><path d="M21 17H3"/>', grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
    msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>', img: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-9 8"/>',
    pin: '<path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
    camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    selfie: '<circle cx="12" cy="9" r="3.2"/><path d="M6.5 19a5.5 5.5 0 0 1 11 0"/><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>',
    nosignal: '<path d="M2 2l20 20"/><path d="M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5.2-2.8M19 13a10 10 0 0 0-2.4-1.7M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8A15 15 0 0 0 10.7 5"/><path d="M12 20h.01"/>',
    bus: '<rect x="4" y="3" width="16" height="15" rx="2"/><path d="M4 11h16M8 18v3M16 18v3M7.5 14.5h.01M16.5 14.5h.01"/>'
  };
  function icon(n, cls) { return '<svg class="i ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[n] || '') + '</svg>'; }

  function toast(msg, ms) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('on');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), ms || 3500);
  }

  /* A dialog. body is HTML; on(el, close) wires it up. Esc or the backdrop closes it. */
  function dialog(o) {
    const wrap = document.createElement('div');
    wrap.className = 'scrim';
    wrap.innerHTML = '<div class="dlg' + (o.wide ? ' wide' : '') + '" role="dialog" aria-modal="true"><div class="h">' + esc(o.title) + '</div>' +
      '<div class="b">' + o.body + '</div>' + (o.foot === false ? '' : '<div class="ft">' + (o.foot || '<button class="btn" data-x>Close</button>') + '</div>') + '</div>';
    document.body.appendChild(wrap);
    const close = () => { wrap.remove(); document.removeEventListener('keydown', key); };
    const key = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', key);
    wrap.addEventListener('mousedown', e => { if (e.target === wrap) close(); });
    wrap.querySelectorAll('[data-x]').forEach(b => b.addEventListener('click', close));
    const first = wrap.querySelector('[data-focus]') || wrap.querySelector('input,select,textarea');
    if (first) setTimeout(() => first.focus(), 30);
    if (o.on) o.on(wrap.querySelector('.dlg'), close);
    return { el: wrap.querySelector('.dlg'), close: close };
  }

  /* Yes or no, saying what will happen. */
  function confirm(title, body, yes, danger) {
    return new Promise(ok => {
      dialog({
        title: title, body: '<p>' + body + '</p>',
        foot: '<button class="btn" data-x data-no>Cancel</button><button class="btn ' + (danger ? 'dngr' : 'p') + '" data-yes>' + esc(yes || 'Yes') + '</button>',
        on: (el, close) => {
          el.querySelector('[data-yes]').addEventListener('click', () => { close(); ok(true); });
          el.querySelector('[data-no]').addEventListener('click', () => ok(false));
        }
      });
    });
  }

  /* Dates: 'yyyy-mm-dd' and 'yyyy-mm-ddTHH:MM(:SS)' as people say them. */
  function nice(d, year) { return d ? D.nice(String(d).slice(0, 10), year) : ''; }
  function when(stamp) {
    if (!stamp) return '';
    const s = String(stamp), day = s.slice(0, 10), time = s.slice(11, 16), today = D.today();
    const w = day === today ? 'today' : day === D.addDays(today, -1) ? 'yesterday' : day === D.addDays(today, 1) ? 'tomorrow' : nice(day, day.slice(0, 4) !== today.slice(0, 4));
    return w + (time ? ' ' + time : '');
  }
  function nowLocal() {
    const d = new Date(), p = n => String(n).padStart(2, '0');
    return { date: D.iso(d), time: p(d.getHours()) + ':' + p(d.getMinutes()) };
  }
  function pill(status) { return '<span class="pill ' + esc(status) + '">' + esc((RU.STATUS[status] || {}).t || status) + '</span>'; }

  /* A field: label, the input, an optional hint. */
  function field(label, inner, hint) { return '<label class="f"><span>' + esc(label) + '</span>' + inner + (hint ? '<em>' + hint + '</em>' : '') + '</label>'; }
  function options(list, val) { return list.map(o => { const v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o; return '<option value="' + esc(v) + '"' + (String(v) === String(val) ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join(''); }

  /* ── Pick from a list: type a few letters, choose, and the right value goes in ──
     UI.pick('country', 'country', 'FR') shows "France (FR)" in a box people type
     into — "fra", "frankreich", "fr" all find it — and keeps FR in a hidden input
     with the name, so a code is never typed by hand. Anything that isn't on the
     list is put back. Lists: 'country', 'nationality', or an array of
     { v, t, h } (value, what it says, a hint). */
  const PICKS = {};
  let pickN = 0, pickOpen = null;
  const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  function builtIn(kind) {
    const also = {};
    Object.keys(RU.COUNTRY_ALSO).forEach(k => { if (k.length > 1) (also[RU.COUNTRY_ALSO[k]] = also[RU.COUNTRY_ALSO[k]] || []).push(k); });
    const mk = RU.COUNTRIES.map(c => c[0]), rank = c => mk.indexOf(c) < 0 ? 999 : mk.indexOf(c);
    const sort = l => l.sort((a, b) => a.r - b.r || a.t.localeCompare(b.t));
    if (kind === 'country') return sort(RU.WORLD.map(c => ({ v: c[0], t: c[1], h: c[0], a: [fold(c[2])].concat(also[c[0]] || []), r: rank(c[0]) })));
    if (kind === 'nationality') return sort(RU.WORLD.map(c => { const n = RU.NATIONALITY[c[0]]; return { v: n || c[1], t: n || c[1], h: n ? c[1] : '', a: [fold(c[1]), fold(c[2]), c[0].toLowerCase()].concat(also[c[0]] || []), r: rank(c[0]) }; })
      .concat([{ v: 'Mixed nationalities', t: 'Mixed nationalities', h: '', a: ['mixed'], r: 500 }]));
    return [];
  }
  const pickLabel = (items, v) => { const it = items.find(i => i.v === v); return it ? it.t + (it.h ? ' (' + it.h + ')' : '') : (v || ''); };
  function pickMatch(items, q) {
    const f = fold(q);
    if (!f) return items.slice(0, 8);
    const out = [];
    items.forEach(it => {
      const t = fold(it.t), h = fold(it.h), words = ' ' + [t, h].concat(it.a || []).join(' ');
      const s = h === f || fold(it.v) === f ? 0 : t.indexOf(f) === 0 ? 1 : words.indexOf(' ' + f) >= 0 ? 2 : words.indexOf(f) >= 0 ? 3 : -1;
      if (s >= 0) out.push([s, it]);
    });
    return out.sort((a, b) => a[0] - b[0] || (a[1].r || 0) - (b[1].r || 0)).slice(0, 8).map(x => x[1]);
  }
  function pick(name, kind, value, o) {
    o = o || {};
    const id = typeof kind === 'string' ? kind : 'p' + (++pickN);
    if (!PICKS[id]) PICKS[id] = typeof kind === 'string' ? builtIn(kind) : kind.map(x => Object.assign({ a: [], r: 0 }, x));
    return '<div class="pk" data-pick="' + id + '"' + (o.free ? ' data-free="1"' : '') + '><input class="in" autocomplete="off" spellcheck="false" value="' + esc(value ? pickLabel(PICKS[id], value) : '') + '" placeholder="' +
      esc(o.placeholder || 'Start typing, then pick') + '"' + (o.focus ? ' data-focus' : '') + (o.disabled ? ' disabled' : '') + '><input type="hidden" name="' + esc(name) + '" value="' + esc(value || '') + '"></div>';
  }
  let pickList = null;
  function wirePick(box) {
    if (box._pk) return;
    box._pk = true;
    const vis = box.querySelector('input:not([type=hidden])'), hid = box.querySelector('input[type=hidden]');
    const items = PICKS[box.dataset.pick] || [], free = box.dataset.free === '1';
    if (!pickList) { pickList = document.createElement('aside'); pickList.className = 'pk-l hidden'; pickList.setAttribute('role', 'listbox'); document.body.appendChild(pickList); }
    /* Setting the value from code (an agent quoted before fills the country) shows it too. */
    const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    Object.defineProperty(hid, 'value', { configurable: true, get() { return proto.get.call(hid); }, set(v) { proto.set.call(hid, v); vis.value = v ? pickLabel(items, v) : ''; box.classList.remove('bad'); } });
    let shown = [], at = 0;
    const place = () => { const r = vis.getBoundingClientRect(); pickList.style.left = r.left + 'px'; pickList.style.top = (r.bottom + 4) + 'px'; pickList.style.width = Math.max(r.width, 260) + 'px'; };
    const paint = () => pickList.querySelectorAll('[data-i]').forEach(e => e.classList.toggle('on', +e.dataset.i === at));
    const draw = () => {
      shown = pickMatch(items, vis.value === pickLabel(items, hid.value) ? '' : vis.value); at = 0;
      pickList.innerHTML = shown.length ? shown.map((it, i) => '<div class="pk-o" data-i="' + i + '" role="option">' + esc(it.t) + (it.h ? '<em>' + esc(it.h) + '</em>' : '') + '</div>').join('') :
        '<div class="pk-none">' + (free ? 'Not on the list — it goes in as typed' : 'Nothing matches — try another spelling') + '</div>';
      pickList._box = box; pickOpen = place; place(); paint(); pickList.classList.remove('hidden');
    };
    const hide = () => { if (pickList._box === box) { pickList.classList.add('hidden'); pickOpen = null; } };
    const choose = it => { hid.value = it.v; hide(); hid.dispatchEvent(new Event('change', { bubbles: true })); };
    vis.addEventListener('focus', () => { vis.select(); draw(); });
    vis.addEventListener('input', () => { box.classList.remove('bad'); draw(); });
    vis.addEventListener('keydown', e => {
      const open = !pickList.classList.contains('hidden') && pickList._box === box;
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && open && shown.length) { e.preventDefault(); at = (at + (e.key === 'ArrowDown' ? 1 : shown.length - 1)) % shown.length; paint(); }
      else if (e.key === 'Enter' && open && shown[at]) { e.preventDefault(); e.stopPropagation(); choose(shown[at]); }
      else if (e.key === 'Escape' && open) { e.stopPropagation(); hide(); }
      else if (e.key === 'Tab' && open && shown[at] && vis.value.trim() && vis.value !== pickLabel(items, hid.value)) choose(shown[at]);
    });
    /* A tap on a phone: pointerdown comes before the box loses focus (mousedown comes after, when the list has gone). */
    const tap = e => { if (pickList._box !== box) return; const o = e.target.closest('[data-i]'); if (o) { e.preventDefault(); choose(shown[+o.dataset.i]); } };
    pickList.addEventListener('pointerdown', tap);
    pickList.addEventListener('mousedown', e => { if (pickList._box === box && e.target.closest('[data-i]')) e.preventDefault(); });
    /* Losing focus: a moment's grace, so a tap on the list still lands, then whatever was typed is matched. */
    vis.addEventListener('blur', () => setTimeout(() => {
      if (document.activeElement === vis) return;
      hide();
      const t = vis.value.trim(), f = fold(t);
      if (!t) { if (hid.value) { hid.value = ''; hid.dispatchEvent(new Event('change', { bubbles: true })); } return; }
      if (t === pickLabel(items, hid.value)) return;
      const m = pickMatch(items, t), exact = m.filter(it => fold(it.t) === f || fold(it.v) === f || fold(it.h) === f || (it.a || []).indexOf(f.replace(/ /g, '')) >= 0);
      const it = exact.length === 1 ? exact[0] : m.length === 1 ? m[0] : null;
      if (it) choose(it);
      else if (free) { hid.value = t; hid.dispatchEvent(new Event('change', { bubbles: true })); }
      else { vis.value = pickLabel(items, hid.value); box.classList.add('bad'); }
    }, 180));
  }
  /* Every pick box wires itself the moment it is on the page, in a dialog or not. */
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType !== 1) return; if (n.classList.contains('pk')) wirePick(n); n.querySelectorAll('.pk').forEach(wirePick); })))
    .observe(document.documentElement, { childList: true, subtree: true });
  document.querySelectorAll('.pk').forEach(wirePick);
  window.addEventListener('scroll', () => { if (pickOpen) pickOpen(); }, true);
  window.addEventListener('resize', () => { if (pickOpen) pickOpen(); });

  function download(name, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  return { esc, icon, toast, dialog, confirm, nice, when, nowLocal, field, options, pick, download, D, RU };
})();
