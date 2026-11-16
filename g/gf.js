/* ═══════════════════════════════════════════════════════════════════════
   JORIS — the guide's phone: talking to the server, dates, sizes
   Talking to the server, dates, sizes and the house style's small pieces.
   ═══════════════════════════════════════════════════════════════════════ */
window.GF = (function () {
  'use strict';
  /* JORIS never opens inside another site's page: a frame is how a click gets borrowed. */
  if (window.top !== window.self) { document.documentElement.style.display = 'none'; throw new Error('JORIS does not open inside another page.'); }

  const SERVER = (window.JOR_CONFIG || {}).server || '';
  /* The order JOR's own guide notes list what is in a guide file. */
  const CATS = ['Guide notes', 'Itinerary', 'Hotels', 'Flights', 'Rooming lists', 'Vouchers', 'Contacts', 'Other'];
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* One request to the server. A plain-text POST, so the browser sends it
     straight to Google without asking permission first. */
  async function api(a, k, extra) {
    if (!SERVER) throw new Error('This copy of the app has no server link yet. Run SET_SERVER.bat.');
    let res;
    try {
      res = await fetch(SERVER, {
        method: 'POST', redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({ a: a, k: k }, extra || {}))
      });
    } catch (e) {
      const err = new Error('No connection to JOR just now.'); err.offline = true; throw err;
    }
    if (!res.ok) { const err = new Error('JOR’s server answered ' + res.status + '. Try again in a minute.'); err.offline = true; throw err; }
    const j = await res.json();
    if (!j.ok) {
      const msg = String(j.error || 'Something went wrong');
      const err = new Error(msg.replace(/^closed:/, ''));
      err.server = true; err.closed = /^closed:/.test(msg);
      throw err;
    }
    return j;
  }

  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* 'yyyy-mm-dd' as a calendar day, never shifted by the time zone. */
  function ymd(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function parse(s) { const p = String(s).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function addDays(s, n) { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); }
  function daysBetween(a, b) { return Math.round((parse(b) - parse(a)) / 864e5); }
  function nice(s, withDay) {
    if (!s) return '';
    const d = parse(s);
    return (withDay ? DAYS[d.getDay()] + ' ' : '') + d.getDate() + ' ' + MON[d.getMonth()];
  }
  function when(stamp) {
    if (!stamp) return '';
    const t = String(stamp);
    const day = t.slice(0, 10), time = t.slice(11, 16);
    const today = ymd(new Date());
    return (day === today ? 'today' : day === addDays(today, -1) ? 'yesterday' : nice(day, true)) + (time ? ' ' + time : '');
  }
  function size(n) {
    if (!n) return '';
    if (n < 1024 * 1024) return Math.max(1, Math.round(n / 1024)) + ' KB';
    return (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + ' MB';
  }
  /* Which day of the tour a date is: arrival is day 1. */
  function tourDay(arrival, date) { return arrival ? daysBetween(arrival, date) + 1 : null; }

  function b64ToBytes(b64) {
    const bin = atob(b64), out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function bytesToB64(buf) {
    const bytes = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }

  /* Small line icons, drawn here so nothing depends on an icon font. */
  const ICONS = {
    doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    img: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-9 8"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
    msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    back: '<path d="M15 18l-6-6 6-6"/>',
    share: '<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    cloud: '<path d="M18 10h-1.3A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>',
    off: '<path d="m2 2 20 20"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M2 8.8a15 15 0 0 1 4.2-2.7"/><path d="M10.7 5.1a15 15 0 0 1 11.3 3.7"/><path d="M5 12.6a10 10 0 0 1 5.2-2.8"/><path d="M16.9 11a10 10 0 0 1 2.1 1.6"/><path d="M12 20h.01"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>'
  };
  function icon(name, cls) { return '<svg class="i ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || '') + '</svg>'; }

  /* An Irish mobile as WhatsApp and the phone want it: 087 123 4567 → 353871234567. */
  function intl(phone) {
    let p = String(phone || '').replace(/[^\d+]/g, '');
    if (p.startsWith('+')) return p.slice(1);
    if (p.startsWith('00')) return p.slice(2);
    if (p.startsWith('0')) return '353' + p.slice(1);
    return p;
  }

  function prettyCode(c) { c = String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); return c.length === 8 ? c.slice(0, 4) + ' ' + c.slice(4) : c; }

  return {
    SERVER: SERVER, CATS: CATS, api: api, esc: esc, ymd: ymd, parse: parse, addDays: addDays, nice: nice, when: when,
    size: size, tourDay: tourDay, b64ToBytes: b64ToBytes, bytesToB64: bytesToB64, icon: icon, intl: intl, prettyCode: prettyCode
  };
})();
