/* ═══════════════════════════════════════════════════════════════════════
   JOR's own history: the RFP window and the OPS file, read as they are kept
   The RFP window (Quote Live Board, Follow up, Confirmed / Cancelled per
   season) and the OPS file (a tab per season, a row per group) are typed
   by many hands over years: dates in a dozen forms, "Y" for done, initials
   for account managers, X-codes for lost files, and rows from an older
   layout where Source, Country and Pax sit a cell off. Every field is
   found by what it holds, not only where it sits. merge() puts the two
   together, one record per reference. No drawing, no storage: the same
   file runs on the server and in the tests.
   ═══════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  const RU = root.JOR_RULES, D = root.JORWF_DATES;

  const norm = v => String(v === undefined || v === null ? '' : v).replace(/[ \s]+/g, ' ').trim();
  const pad = n => String(n).padStart(2, '0');
  const isoOf = (y, m, d) => {
    if (!(y > 1990 && y < 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return '';
    const t = new Date(y, m - 1, d, 12);
    return t.getFullYear() === y && t.getMonth() === m - 1 && t.getDate() === d ? y + '-' + pad(m) + '-' + pad(d) : '';
  };
  /* An Excel day number (what a date cell holds) as a date. */
  const fromSerial = n => { const t = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 864e5); return t.toISOString().slice(0, 10); };
  const isSerial = v => typeof v === 'number' && v > 25000 && v < 80000;
  const plain = s => norm(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/�/g, 'e');

  const MONTHS = {
    jan: 1, janv: 1, january: 1, janvier: 1, feb: 2, fev: 2, fevr: 2, february: 2, fevrier: 2, mar: 3, march: 3, mars: 3,
    apr: 4, april: 4, avr: 4, avril: 4, may: 5, mai: 5, jun: 6, june: 6, juin: 6, jul: 7, july: 7, juil: 7, juillet: 7,
    aug: 8, august: 8, aout: 8, sep: 9, sept: 9, september: 9, septembre: 9, oct: 10, october: 10, octobre: 10,
    nov: 11, november: 11, novembre: 11, dec: 12, december: 12, decembre: 12
  };
  /* Long month names, for the misspelt ones ("Septemeber"). */
  const LONG = Object.keys(MONTHS).filter(k => k.length >= 6);
  function lev(a, b) {
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[b.length];
  }
  function monthOf(w) {
    const k = plain(w).replace(/\.$/, '');
    if (MONTHS[k]) return MONTHS[k];
    if (k.length >= 6) for (let i = 0; i < LONG.length; i++) if (Math.abs(LONG[i].length - k.length) <= 2 && lev(k, LONG[i]) <= (k.length >= 7 ? 2 : 1)) return MONTHS[LONG[i]];
    return 0;
  }

  /* A day and month with no year: the year that puts it nearest `near`
     (a follow-up date, either side of today); or nearest on or before
     `before` (an invoice goes out before the group comes, give or take
     `slack` days); failing that, `year`. */
  function noYear(d, mo, o) {
    if (o.near) {
      const ny = +o.near.slice(0, 4);
      let best = '', gap = Infinity;
      [ny - 1, ny, ny + 1].forEach(y => { const iso = isoOf(y, mo, d); if (iso && Math.abs(D.diffDays(o.near, iso)) < gap) { gap = Math.abs(D.diffDays(o.near, iso)); best = iso; } });
      return best;
    }
    if (o.before) {
      const by = +o.before.slice(0, 4), lim = D.addDays(o.before, o.slack === undefined ? 45 : o.slack);
      for (let y = by + 1; y >= by - 2; y--) { const iso = isoOf(y, mo, d); if (iso && iso <= lim) return iso; }
    }
    return o.year ? isoOf(+o.year, mo, d) : '';
  }
  /* A date however it was typed: a date cell, 2026-05-14, 14/05/2026, 14.5.26,
     14/05 (no year), 14 May 2026, 23 June, May 14, 2026. */
  function date(v, o) {
    o = o || {};
    if (isSerial(v)) return fromSerial(v);
    const s = plain(v).replace(/(\d)(st|nd|rd|th)\b/g, '$1');
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return isoOf(+m[1], +m[2], +m[3]);
    m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/);
    if (m) { let y = +m[3]; if (y < 100) y += 2000; return isoOf(y, +m[2], +m[1]); }
    m = s.match(/^(\d{1,2})\s*[\/.]\s*(\d{1,2})\b/);
    if (m) return noYear(+m[1], +m[2], o);
    m = s.match(/^(\d{1,2})\s+([a-z]+)\.?,?(?:\s+(\d{4}))?\b/);
    if (m && monthOf(m[2])) return m[3] ? isoOf(+m[3], monthOf(m[2]), +m[1]) : noYear(+m[1], monthOf(m[2]), o);
    m = s.match(/^([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})\b/);
    if (m && monthOf(m[1])) return isoOf(+m[3], monthOf(m[1]), +m[2]);
    return '';
  }

  /* Done, not done, or not needed — with the date when one was written. */
  function done(v, o) {
    if (v === true) return { done: true, date: '' };
    if (v === false) return { done: false, date: '' };
    const s = norm(v);
    if (!s || /^[-\/\\.]+$/.test(s)) return { done: null, date: '' };
    if (/^(n\s*[\/\\?.]*\s*a|none|not needed|not required)$/i.test(s)) return { done: null, na: true, date: '' };
    if (/^(no|not paid|not sent|not yet|waiting|n)$/i.test(s) || /^cxl\b/i.test(s)) return { done: false, date: '' };
    const d = isSerial(v) ? fromSerial(v) : date(s.replace(/^(y|yes|paid|sent)\b\s*[-:(]?\s*/i, '').replace(/\)$/, ''), o);
    if (d) return { done: true, date: d };
    if (/^(y|yes|yee|gone|sent|paid|done|ok|booked)\b/i.test(s)) return { done: true, date: '' };
    return { done: null, date: '', text: s };
  }

  /* When the group travels, from "9 to 14 March 2027", "22-30th April 2027",
     "27 July to 08 August 2026", "06.-09.05.2027", "28/06 to 05/07",
     "October 10th, 2027", "TBC June 2027", "2027 Aug / Sept", a date cell or
     just a year. A month with no day gives the month only, never a made-up
     first of the month. */
  function travel(v, yearHint) {
    const none = { arrival: '', departure: '', month: '', exact: false, year: '' };
    if (isSerial(v)) { const d = fromSerial(v); return { arrival: d, departure: '', month: d.slice(0, 7), exact: true, year: d.slice(0, 4) }; }
    const s = plain(v).replace(/(\d)(st|nd|rd|th)\b/g, '$1').replace(/\s+/g, ' ');
    if (!s || /^(tbc|tba|#value!|n\/?a|\?+)$/.test(s)) return none;
    const yr = (s.match(/\b(20\d{2})\b/) || [])[1] || yearHint || '';
    const out = (a, b) => (a ? { arrival: a, departure: b && b > a ? b : '', month: a.slice(0, 7), exact: true, year: a.slice(0, 4) } : null);
    const W = '([a-zà-ÿ]+)\\.?';
    let m, r;
    m = s.match(/\b(\d{1,2})\.?\s*(?:-|–|to|au)\s*(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})\b/);
    if (m) { let y = +m[4]; if (y < 100) y += 2000; if ((r = out(isoOf(y, +m[3], +m[1]), isoOf(y, +m[3], +m[2])))) return r; }
    m = s.match(/\b(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})\b(?:\s*(?:-|–|to|au|until)\s*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})\b)?/);
    if (m && (r = out(date(m[1]), m[2] ? date(m[2]) : ''))) return r;
    m = s.match(/\b(\d{4}-\d{1,2}-\d{1,2})\b/);
    if (m && (r = out(date(m[1]), ''))) return r;
    m = s.match(/\b(\d{1,2})[\/.](\d{1,2})\s*(?:-|–|to|au|until)\s*(\d{1,2})[\/.](\d{1,2})\b/);
    if (m && yr) {
      const a = isoOf(+yr, +m[2], +m[1]); let b = isoOf(+yr, +m[4], +m[3]);
      if (a && b && b < a) b = isoOf(+yr + 1, +m[4], +m[3]);
      if ((r = out(a, b))) return r;
    }
    m = s.match(new RegExp('\\b(\\d{1,2})\\s+' + W + ',?\\s*(?:\\d{4}\\s*)?(?:-|–|to|au|until)\\s*(\\d{1,2})\\s+' + W));
    if (m && monthOf(m[2]) && monthOf(m[4]) && yr) {
      const a = isoOf(+yr, monthOf(m[2]), +m[1]); let b = isoOf(+yr, monthOf(m[4]), +m[3]);
      if (a && b && b < a) b = isoOf(+yr + 1, monthOf(m[4]), +m[3]);
      if ((r = out(a, b))) return r;
    }
    m = s.match(new RegExp('\\b(\\d{1,2})(?:\\/\\d{1,2})?\\s*(?:-|–|to|au|&|and)\\s*(\\d{1,2})(?:\\/\\d{1,2})?\\s+' + W));
    if (m && monthOf(m[3]) && yr && (r = out(isoOf(+yr, monthOf(m[3]), +m[1]), isoOf(+yr, monthOf(m[3]), +m[2])))) return r;
    m = s.match(new RegExp('\\b' + W + '\\s+(\\d{1,2})\\b(?!\\s*[\\/.:]\\d)'));
    if (m && monthOf(m[1]) && yr && (r = out(isoOf(+yr, monthOf(m[1]), +m[2]), ''))) return r;
    m = s.match(new RegExp('\\b(\\d{1,2})\\s+' + W));
    if (m && monthOf(m[2]) && yr && (r = out(isoOf(+yr, monthOf(m[2]), +m[1]), ''))) return r;
    const words = s.split(/[^a-zà-ÿ]+/).filter(w => monthOf(w));
    if (words.length && yr) return { arrival: '', departure: '', month: yr + '-' + pad(monthOf(words[0])), exact: false, year: yr };
    return Object.assign({}, none, { year: (s.match(/\b(20\d{2})\b/) || [])[1] || '' });
  }

  /* People: "35", "20-24", "30/40", "35 pax", "TBC" — the first number. */
  function pax(v) {
    if (typeof v === 'number') return v >= 1 && v < 2000 && v % 1 === 0 ? v : '';
    const m = norm(v).match(/^(\d{1,4})\s*(?:pax|people|persons?|ppl)?(?:\s*[-\/–]\s*\d{1,4}\s*(?:pax)?)?$/i);
    return m && +m[1] >= 1 && +m[1] < 2000 ? +m[1] : '';
  }
  /* The number in "02.05 - 26 pax", "24 pax - final number", "0 - 23/03". */
  function paxNote(v) {
    if (typeof v === 'number') return v >= 0 && v < 2000 ? v : '';
    const s = norm(v), m = s.match(/(\d{1,4})\s*pax/i) || s.match(/^(\d{1,4})\s*-\s*\d{1,2}[\/.]\d{1,2}/) || s.match(/(?:^|[-\s])(\d{1,4})$/);
    return m ? +m[1] : '';
  }

  /* Account managers' initials: "MB/MC", "SM /MB", "AC / ID", "MB2". */
  function initials(v) {
    const s = norm(v).toUpperCase();
    if (!s || /^(TBC|TBA|N\/A)$/.test(s)) return [];
    return s.split(/[\/,&+]|\s+/).map(x => x.trim()).filter(x => /^[A-Z]{2,4}\d?$/.test(x) && x !== 'TBC' && x !== 'TBA');
  }

  /* A country however it was written, as its two-letter code. */
  const ISO2 = new Set(('AD AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FR GA GB GD GE GH GM GN GQ GR GT GW GY HK HN HR HT HU IE IL IN IQ IR IS IT JM JO JP KE KG KH KI KM KN KP KR KW KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MO MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA PE PG PH PK PL PR PS PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VN VU WS XK YE ZA ZM ZW').split(' '));
  const C_ALIAS = {
    USA: 'US', 'U.S.': 'US', 'U.S.A.': 'US', AMERICA: 'US', 'UNITED STATES': 'US', UK: 'GB', EN: 'GB', ENG: 'GB', ENGLAND: 'GB', SCOTLAND: 'GB', WALES: 'GB',
    'UNITED KINGDOM': 'GB', 'NORTHERN IRELAND': 'GB', IRL: 'IE', IR: 'IE', EIRE: 'IE', IRELAND: 'IE', CAN: 'CA', CANADA: 'CA', FIN: 'FI', FINLAND: 'FI',
    BEL: 'BE', BELGIUM: 'BE', BELGIQUE: 'BE', NETHERLAND: 'NL', NETHERLANDS: 'NL', HOLLAND: 'NL', LUX: 'LU', LUXEMBOURG: 'LU', AUSTRIA: 'AT', UAE: 'AE',
    SP: 'ES', SPA: 'ES', SPAIN: 'ES', TU: 'TR', TURKEY: 'TR', SW: 'SE', SWE: 'SE', SWEDEN: 'SE', DN: 'DK', DEN: 'DK', DENMARK: 'DK', GER: 'DE', GERMANY: 'DE',
    FRA: 'FR', FRANCE: 'FR', ITA: 'IT', ITALY: 'IT', MONACO: 'MC', SWITZERLAND: 'CH', SUISSE: 'CH', JAPAN: 'JP', CHINA: 'CN', INDIA: 'IN', KOREA: 'KR',
    'SOUTH KOREA': 'KR', BRAZIL: 'BR', MEXICO: 'MX', AUSTRALIA: 'AU', AUS: 'AU', 'NEW ZEALAND': 'NZ', POLAND: 'PL', PORTUGAL: 'PT', GREECE: 'GR',
    HUNGARY: 'HU', ROMANIA: 'RO', BULGARIA: 'BG', SERBIA: 'RS', SLOVENIA: 'SI', PHILIPPINES: 'PH', OMAN: 'OM', ISRAEL: 'IL', 'SOUTH AFRICA': 'ZA',
    NORWAY: 'NO', CZECH: 'CZ', CZECHIA: 'CZ', TUNISIA: 'TN'
  };
  /* Two letters that are something else in these sheets: ID is Iain's initials, AS a source. */
  const NOT_A_COUNTRY = new Set(['ID', 'AS', 'AM', 'PM', 'BOR', 'TBC', 'TBA', 'NA']);
  function country(v) {
    const s = norm(v).toUpperCase().replace(/\.$/, '');
    if (!s || NOT_A_COUNTRY.has(s)) return '';
    if (C_ALIAS[s]) return C_ALIAS[s];
    if (s.length === 2 && ISO2.has(s)) return s;
    const named = (RU.COUNTRIES || []).filter(c => c[1].toUpperCase() === s)[0];
    return named ? named[0] : '';
  }

  /* Where the request came from, in the words of the app's list (shared/rules.js SOURCES). */
  function source(v) {
    const s = plain(v);
    if (!s) return '';
    if (/^(agency|agence|agent|selectour)$/.test(s)) return 'Agency';
    if (/^hub|website|web site/.test(s)) return 'Website (HubSpot)';
    if (/top ?resa|fam ?trip|sales call|trade|itb|wtm/.test(s)) return 'Trade show';
    if (/^(client|direct|email client|contact)$/.test(s)) return 'Client (direct)';
    if (/^(bernard|bor)$/.test(s)) return 'Bernard';
    if (/^(iain|id)\b/.test(s)) return 'Iain';
    if (/^(jor|maude|arti|wfm|as|other)$/.test(s)) return 'Other';
    return '';
  }
  /* The department letter (Iain, 29 Oct): L Leisure, G Golf, R Rugby, P Pilgrimage, ARTI the Active Retired groups; M MICE, FAM. */
  function dept(v) {
    const s = plain(v);
    if (!s) return '';
    if (/^l$|leisure|lesiure|^fit/.test(s)) return 'Leisure';
    if (/^g$|golf/.test(s)) return 'Golf';
    if (/^m$|mice/.test(s)) return 'MICE';
    if (/^(r|ru)$|rugby|sport|six nations|6 nations/.test(s)) return 'Rugby';
    if (/^p$|pilgrim|pelgrin/.test(s)) return 'Pilgrimage';
    if (/^(a|arti)$|active retire/.test(s)) return 'ARTI';
    if (/^fam/.test(s)) return 'FAM trip';
    return '';
  }
  /* The reference, and any others in the same cell: "26/1237\n26/1239", "27/1010-27/1057". */
  function refs(v) {
    const s = norm(v), out = [];
    const re = /(\d{2})\s*\/\s*(\d{3,5})/g;
    let m;
    while ((m = re.exec(s))) out.push(m[1] + '/' + (+m[2]));
    const range = s.match(/(\d{2})\s*\/\s*(\d{3,5})\s*(?:-|–|to)\s*(?:(\d{2})\s*\/\s*)?(\d{3,5})/);
    if (range && (!range[3] || range[3] === range[1]) && +range[4] > +range[2] && +range[4] - +range[2] < 200) {
      for (let n = +range[2] + 1; n <= +range[4]; n++) { const r = range[1] + '/' + n; if (out.indexOf(r) < 0) out.push(r); }
      out.sort((a, b) => (a.slice(0, 2) === b.slice(0, 2) ? +a.split('/')[1] - +b.split('/')[1] : a < b ? -1 : 1));
    }
    return out;
  }
  /* A week written "35/2024", as the Monday it starts — or a date cell. */
  function week(v) {
    if (isSerial(v)) return fromSerial(v);
    const s = norm(v), m = s.match(/^(\d{1,2})\s*\/\s*(\d{4})$/);
    if (m && +m[1] >= 1 && +m[1] <= 53) {
      const jan4 = new Date(+m[2], 0, 4, 12), mon = new Date(jan4);
      mon.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (+m[1] - 1) * 7);
      return mon.getFullYear() + '-' + pad(mon.getMonth() + 1) + '-' + pad(mon.getDate());
    }
    return date(s);
  }
  /* A lost file's reason code: "X8", "x3 Riga chosen instead", "XA", "QX" (Covid). */
  function lostCode(v) {
    const s = norm(v), m = s.match(/^(q?)x\s*([0-9a-z])?(?![a-z])\s*[-:.]?\s*(.*)$/i);
    return m ? { code: (m[1] ? 'Q' : '') + 'X' + (m[2] || '').toUpperCase(), text: norm(m[3]) } : null;
  }
  /* Where the group lands or is met: airports by name, anything else as written. */
  function arrivePoint(v) {
    const s = plain(v);
    if (!s || /^(n\/?a|none|-|tbc|tba)$/.test(s)) return '';
    if (/ferry|port|dfp/.test(s)) return /cork/.test(s) ? 'Cork Port' : 'Dublin Port';
    if (/^(dub|dublin)/.test(s)) return 'Dublin Airport';
    if (/^(snn|shan)/.test(s)) return 'Shannon Airport';
    if (/^(ork|cork)/.test(s)) return 'Cork Airport';
    if (/^(bfs|belfast)/.test(s)) return 'Belfast';
    if (/^(kir|kerry)/.test(s)) return 'Kerry Airport';
    return norm(v).slice(0, 40).replace(/^[a-z]/, c => c.toUpperCase());
  }
  /* A proposal gone to the client, in the words the account managers use. */
  const SENT = /\b(?:sent|send|envoy\w*)\s+(?:(?:the|a|an|our|client|updated|new|revised|final|to)\s+){0,3}(?:offer|quote|quotation|proposal|devis|programme|program|sample|itinerary|costing|prices?)\b|\b(?:offer|quote|proposal|devis|programme|program)\s+(?:sent|envoy)|\bsent\s+to\s+(?:the\s+)?client\b/i;

  /* The heading row of a tab: the first with the names we look for. */
  function heading(rows, must) {
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const h = (rows[i] || []).map(x => plain(x));
      if (must.every(re => h.some(x => re.test(x)))) return { at: i, h: h };
    }
    return null;
  }
  const find = (h, re, from) => { for (let i = from || 0; i < h.length; i++) if (re.test(h[i])) return i; return -1; };

  /* ══ The RFP window ══════════════════════════════════════════════════ */
  const RFP_TABS = [[/quote live board/i, 'live'], [/^follow ?up/i, 'followup'], [/^confirmed\s*(\d{4})/i, 'confirmed'], [/^cancell?ed\s*(\d{4})/i, 'lost']];
  function rfp(tabs, o) {
    o = o || {};
    const today = o.today || new Date().toISOString().slice(0, 10);
    const files = [], problems = [], seen = [];
    tabs.forEach(t => {
      const kind = RFP_TABS.filter(k => k[0].test(norm(t.name)))[0];
      if (!kind) { seen.push({ tab: norm(t.name), used: 0, why: 'not part of the RFP window' }); return; }
      const season = (norm(t.name).match(/(\d{4})/) || [])[1] || '';
      const hd = heading(t.rows || [], [/^agency/, /date of travel/]);
      if (!hd) { problems.push({ tab: norm(t.name), row: 0, why: 'no heading row with Agency and Date of travel' }); return; }
      const h = hd.h;
      const c = {
        week: find(h, /^week/), request: find(h, /date of request/), follow: find(h, /date follow/), agency: find(h, /^agency/),
        am: find(h, /^(am|ae|pm)$/), travel: find(h, /date of travel/), ref: find(h, /^ref/), lastCom: find(h, /^last com/), update: find(h, /rfp update/),
        type: find(h, /type of tour/), dept: find(h, /^dept/), option: find(h, /option follow/), reason: find(h, /raison|reason/), contact: find(h, /contact/)
      };
      let used = 0;
      for (let i = hd.at + 1; i < t.rows.length; i++) {
        const r = t.rows[i] || [], cell = k => (c[k] >= 0 ? r[c[k]] : '');
        const agency = norm(cell('agency'));
        if (!agency || /^agency$/i.test(agency) || /^\d{4} rfp/i.test(agency)) continue;           // blank, repeated heading, section title
        const row = i + 1;
        const refList = refs(cell('ref'));
        if (!refList.length) { problems.push({ tab: norm(t.name), row: row, why: 'no reference' }); continue; }
        /* Between Agency and the account manager the cells may sit one off: find each by what it is. */
        const win = [];
        for (let k = c.agency + 1; k < (c.am > 0 ? c.am : c.agency + 6); k++) win.push({ k: k, v: r[k] });
        const take = (test, prefer) => {
          const order = win.slice().sort((a, b) => (a.k === prefer ? -1 : b.k === prefer ? 1 : 0));
          const hit = order.filter(x => !x.used && test(x.v))[0];
          if (hit) { hit.used = true; return hit.v; }
          return '';
        };
        const ctry = country(take(v => !!country(v), find(h, /^country/)));
        const src = source(take(v => !!source(v), find(h, /^source/)));
        const paxV = take(v => pax(v) !== '' || /^(tbc|tba)$/i.test(norm(v)), find(h, /^pax/));
        const ne = norm(take(v => /^[nNeE]$/.test(norm(v)), find(h, /^n ?\/ ?e$/))).toUpperCase();
        const q = norm(take(v => /^[qQrRcC]$/.test(norm(v)), find(h, /^q$|quote/))).toUpperCase();
        const tv = travel(cell('travel'), '20' + refList[0].slice(0, 2));
        const said = norm(isSerial(cell('lastCom')) ? '' : cell('lastCom')) + ' ‖ ' + norm(isSerial(cell('update')) ? '' : cell('update'));
        const received = date(cell('request')) || (kind[1] === 'live' && isSerial(r[0]) ? fromSerial(r[0]) : '');
        const rec = {
          tab: norm(t.name), row: row, kind: kind[1], ref: refList[0], more: refList.slice(1), agency: agency.slice(0, 120), contact: '',
          newClient: ne === 'N' ? 'yes' : ne === 'E' ? 'no' : '', requote: q === 'R', source: src, country: ctry, pax: pax(paxV), ams: initials(cell('am')),
          arrival: tv.arrival, departure: tv.departure, month: tv.month, season: season || tv.year || '20' + refList[0].slice(0, 2), travelText: norm(isSerial(cell('travel')) ? '' : cell('travel')),
          type: dept(cell('dept')) || dept(cell('type')), received: received,
          status: kind[1] === 'confirmed' ? 'confirmed' : kind[1] === 'lost' ? 'lost' : kind[1] === 'followup' || SENT.test(said) ? 'quoted' : 'enquiry',
          decided: kind[1] === 'confirmed' || kind[1] === 'lost' ? week(cell('week')) : '',
          followUp: kind[1] === 'followup' ? date(cell('follow'), { near: today }) : '', quotedAt: '', notes: [], lost: null
        };
        /* When the proposal went: the date the note starts with, if it says it was sent. */
        if (rec.status === 'quoted') {
          const part = [cell('lastCom'), cell('update')].map(norm).filter(x => SENT.test(x))[0];
          if (part) rec.quotedAt = date(part, { before: today, slack: 0 });
          if (rec.quotedAt && received && rec.quotedAt < received) rec.quotedAt = '';
        }
        /* The contact's name, unless the cell holds a reason code (Cancelled 2026 keeps X-codes there). */
        const cn = norm(cell('contact'));
        if (cn && !lostCode(cn) && !isSerial(r[c.contact]) && !/^(booked|confirmed|tbc|\?\?)$/i.test(cn) && !/\d/.test(cn)) rec.contact = cn.slice(0, 120);
        if (rec.status === 'lost') rec.lost = [cell('reason'), cell('contact'), c.contact >= 0 ? r[c.contact + 1] : ''].map(lostCode).filter(Boolean)[0] || { code: '', text: '' };
        [['Last contact with the client', cell('lastCom')], ['Account manager’s update', cell('update')], ['Programme', cell('type')],
          ['Option', c.option >= 0 ? cell('option') : ''], ['Travel, as written', tv.exact ? '' : cell('travel')]]
          .forEach(n => { const v = isSerial(n[1]) ? fromSerial(n[1]) : norm(n[1]); if (v) rec.notes.push(n[0] + ': ' + v); });
        if (rec.more.length) rec.notes.push('Also on this line: ' + rec.more.join(', '));
        files.push(rec); used++;
      }
      seen.push({ tab: norm(t.name), used: used, kind: kind[1] });
    });
    return { files: files, problems: problems, tabs: seen };
  }

  /* ══ The OPS file ═══════════════════════════════════════════════════ */
  function ops(tabs) {
    const groups = [], problems = [], seen = [], series = [];
    tabs.forEach(t => {
      const season = (norm(t.name).match(/^(\d{4})$/) || [])[1];
      const hd = season && heading(t.rows || [], [/^ref$/, /^group name/]);
      if (!hd) { seen.push({ tab: norm(t.name), used: 0, why: 'not a season tab' }); return; }
      const h = hd.h, a = find(h, /^(t ?)?a$/);
      const c = {
        complete: find(h, /complete/), arrive: a, depart: find(h, /^dep$/, a + 1), am: find(h, /^a ?m$/), ref: find(h, /^ref$/), name: find(h, /^group name/),
        pax: find(h, /^pax$/), paxUpdate: find(h, /^pax update/), paxOnly: find(h, /^pax no only/), airport: find(h, /^arr$/), depInv: find(h, /^d inv/),
        depPaid: find(h, /^d ?p$/), finSent: find(h, /^fi sent/), finPaid: find(h, /^fi paid/), coach: find(h, /^coach/), guide: find(h, /^guide$/),
        report: find(h, /guide report/), accom: find(h, /^accom/), lv: find(h, /^l ?& ?v/), rooming: find(h, /^r ?l$/), guideFile: find(h, /^g ?f/), notes: find(h, /^notes?$/)
      };
      let used = 0;
      for (let i = hd.at + 1; i < t.rows.length; i++) {
        const r = t.rows[i] || [], cell = k => (c[k] >= 0 ? r[c[k]] : '');
        const name = norm(cell('name')), rl = refs(cell('ref'));
        if (!name && !rl.length) continue;                                                            // month titles and empty rows
        if (/joe o.?reilly team/i.test(name)) continue;                                                // the worked example at the top of each tab
        const row = i + 1, fixed = [];
        /* A full date typed with last year's year (copied from the row before) is taken as this season. */
        const seasonDate = (v, what) => {
          const d = date(v, { year: season });
          if (d && +d.slice(0, 4) === +season - 1 && isoOf(+season, +d.slice(5, 7), +d.slice(8, 10)) && !isSerial(v)) { fixed.push(what); return season + d.slice(4); }
          return d;
        };
        const arrival = seasonDate(cell('arrive'), 'arrival');
        let departure = seasonDate(cell('depart'), 'departure');
        if (departure && arrival && departure < arrival) departure = '';
        const latest = c.paxOnly >= 0 && pax(cell('paxOnly')) !== '' ? pax(cell('paxOnly')) : c.paxUpdate >= 0 && paxNote(cell('paxUpdate')) > 0 ? paxNote(cell('paxUpdate')) : pax(cell('pax'));
        if (rl.length && Math.abs(2000 + +rl[0].slice(0, 2) - +season) > 1) {
          problems.push({ tab: norm(t.name), row: row, why: 'the reference ' + rl[0] + ' is on the ' + season + ' tab — mistyped?' });
          continue;
        }
        if (!rl.length) {
          /* No reference: a series departure (the same tour every few days) — kept apart, not brought in as a file. */
          series.push({ tab: norm(t.name), row: row, season: season, name: name.slice(0, 120), arrival: arrival, departure: departure, pax: latest, ams: initials(cell('am')) });
          continue;
        }
        const before = arrival || departure || season + '-12-31';
        const inv = k => done(cell(k), { before: before, slack: k === 'finPaid' || k === 'depPaid' ? 120 : 45 });
        const named = v => { const s = norm(v); return { done: s ? !/^(no|n|tbc|tba|-)$/i.test(s) : null, note: /^(y|yes|no|n|tbc|tba|ok|booked|-)$/i.test(s) ? '' : s.slice(0, 80) }; };
        const g = {
          tab: norm(t.name), row: row, ref: rl[0], more: rl.slice(1), name: name.slice(0, 120), season: season, arrival: arrival, departure: departure,
          pax: latest, ams: initials(cell('am')), arrivePoint: arrivePoint(cell('airport')),
          complete: typeof r[c.complete] === 'number' ? Math.round(Math.min(100, r[c.complete] <= 1 ? r[c.complete] * 100 : r[c.complete])) : '',
          ops: {
            coach: named(cell('coach')), guide: named(cell('guide')), accom: { done: done(cell('accom')).done }, lv: { done: done(cell('lv')).done },
            rooming: { done: done(cell('rooming')).done }, guidefile: { done: done(cell('guideFile'), { before: before }).done }
          },
          pay: { deposit: { sent: inv('depInv'), paid: inv('depPaid') }, final: { sent: inv('finSent'), paid: inv('finPaid') } },
          cancelled: /\bcxl\b|cancel/i.test(name + ' ' + norm(cell('lv')) + ' ' + norm(cell('notes'))), fixed: fixed, notes: []
        };
        const upd = norm(cell('paxUpdate'));
        if (upd) g.notes.push('Numbers: ' + upd);
        if (c.report >= 0 && norm(cell('report'))) g.notes.push('Guide’s report: ' + norm(cell('report')));
        if (c.notes >= 0 && norm(cell('notes'))) g.notes.push(norm(cell('notes')));
        if (g.more.length) g.notes.push('Also on this line: ' + g.more.join(', '));
        groups.push(g); used++;
      }
      seen.push({ tab: norm(t.name), used: used, kind: 'season' });
    });
    return { groups: groups, problems: problems, tabs: seen, series: series };
  }

  /* ══ Together: one record per reference ═════════════════════════════
     The RFP window says how a request went, the OPS file what became of a
     confirmed group, and the quotes window (Q, Jess's sheet) fills in what
     the other two don't have — and brings in the requests neither has. */
  const STEP = { live: 1, followup: 2, lost: 3, confirmed: 4 };
  const ORIGIN = { rfp: 'RFP window', quotes: 'Quotes window', ops: 'OPS file' };
  function merge(R, O, o, Q) {
    o = o || {};
    const today = o.today || new Date().toISOString().slice(0, 10);
    const rf = {}, og = {}, qf = {};
    ((R && R.files) || []).forEach(f => (rf[f.ref] = rf[f.ref] || []).push(f));
    ((O && O.groups) || []).forEach(g => { if (!og[g.ref]) og[g.ref] = g; });
    ((Q && Q.files) || []).forEach(f => { if (!qf[f.ref]) qf[f.ref] = f; });
    /* Agencies as the RFP window and the quotes window spell them, longest first, with the country each is usually in. */
    const agency = {};
    ((R && R.files) || []).concat((Q && Q.files) || []).forEach(f => {
      const k = f.agency.toLowerCase();
      const a = agency[k] = agency[k] || { name: f.agency, n: 0, c: {} };
      a.n++;
      if (f.country) a.c[f.country] = (a.c[f.country] || 0) + 1;
    });
    const names = Object.keys(agency).filter(k => k.length >= 4).sort((a, b) => b.length - a.length);
    const countryOf = k => { const c = agency[k] ? agency[k].c : {}; return Object.keys(c).sort((a, b) => c[b] - c[a])[0] || ''; };
    const out = [];
    const keys = Object.keys(rf), had = Object.assign({}, rf);
    Object.keys(qf).concat(Object.keys(og)).forEach(r => { if (!had[r]) { had[r] = 1; keys.push(r); } });
    keys.forEach(ref => {
      const rows = (rf[ref] || []).slice().sort((a, b) => STEP[b.kind] - STEP[a.kind]);
      const g = og[ref], top = rows[0];
      const pick = k => { for (let i = 0; i < rows.length; i++) if (rows[i][k] !== '' && rows[i][k] !== undefined && rows[i][k] !== null) return rows[i][k]; return ''; };
      const x = { ref: ref, year: ref.slice(0, 2), num: +ref.split('/')[1], from: [], notes: [], status: '', agent: '', tourName: '', contact: pick('contact'),
        country: pick('country'), source: pick('source'), type: pick('type'), newClient: pick('newClient'), pax: pick('pax'), arrival: '', departure: '', month: '',
        received: pick('received'), quotedAt: pick('quotedAt'), confirmedAt: '', closedAt: '', decidedAt: '', followUp: '', lostCode: '', lostText: '',
        ams: [], season: '', ops: null, pay: null, arrivePoint: '', complete: '' };
      if (rows.length) {
        x.from.push('rfp');
        x.agent = top.agency;
        x.ams = (rows.filter(r => r.ams.length)[0] || { ams: [] }).ams;
        const exact = rows.filter(r => r.arrival)[0];
        if (exact) { x.arrival = exact.arrival; x.departure = exact.departure; }
        x.month = exact ? exact.month : pick('month');
        x.season = top.season;
        /* Confirmed and also on a Cancelled list: whichever was decided later. */
        const conf = rows.filter(r => r.kind === 'confirmed')[0], lost = rows.filter(r => r.kind === 'lost')[0];
        if (conf && lost) {
          x.status = lost.decided && conf.decided && lost.decided > conf.decided ? 'cancelled' : 'confirmed';
          x.notes.push(x.status === 'cancelled' ? 'Confirmed, then on the Cancelled list' : 'Also on the Cancelled list');
        } else x.status = top.status;
        if (x.status === 'confirmed') x.confirmedAt = conf.decided || '';
        if (x.status === 'lost' || x.status === 'cancelled') { x.decidedAt = lost.decided || ''; x.lostCode = lost.lost.code; x.lostText = lost.lost.text; }
        if (x.status === 'quoted') x.followUp = pick('followUp');
        rows.forEach(r => r.notes.forEach(n => { if (x.notes.indexOf(n) < 0) x.notes.push(n); }));
      }
      /* On the quotes window: what the RFP window left blank — or, if it isn't on the RFP window, the request itself. */
      const q = qf[ref];
      if (q) {
        x.from.push('quotes');
        if (!rows.length) { x.agent = q.agency; x.status = 'enquiry'; x.season = q.season; q.notes.forEach(n => x.notes.push(n)); }
        ['contact', 'country', 'type', 'pax', 'received'].forEach(k => { if (x[k] === '' && q[k] !== '') x[k] = q[k]; });
        if (!x.ams.length) x.ams = q.ams;
        if (!x.arrival && q.arrival) { x.arrival = q.arrival; x.departure = q.departure; x.month = q.month; }
        if (!x.month) x.month = q.month;
      }
      if (g) {
        x.from.push('ops');
        const gname = g.name.replace(/\s*[-–(]?\s*\b(cxl|cancell?ed)\b\)?\s*/ig, ' ').trim() || g.name;
        if (!x.agent) {
          const low = gname.toLowerCase();
          const k = names.filter(n => low === n || (low.indexOf(n) === 0 && /^[\s\-–:\/,(]/.test(low.slice(n.length))))[0];
          if (k) { x.agent = agency[k].name; x.tourName = gname.slice(k.length).replace(/^[\s\-–:\/,(]+/, '').replace(/\)$/, ''); x.country = x.country || countryOf(k); }
          else if (/ - /.test(gname)) { x.agent = gname.split(' - ')[0]; x.tourName = gname.split(' - ').slice(1).join(' - '); }
          else x.agent = gname;
        } else {
          /* The group's name, less the agency's when it starts with it. */
          const low = gname.toLowerCase(), ag = x.agent.toLowerCase();
          x.tourName = low === ag ? '' : low.indexOf(ag) === 0 && /^[\s\-–:\/,(]/.test(low.slice(ag.length)) ? gname.slice(ag.length).replace(/^[\s\-–:\/,(]+/, '').replace(/\)$/, '') : gname;
        }
        if (g.arrival) { x.arrival = g.arrival; x.departure = g.departure || (x.departure > g.arrival ? x.departure : ''); x.month = g.arrival.slice(0, 7); }
        if (g.pax !== '') x.pax = g.pax;
        if (g.ams.length) {
          if (x.ams.length && x.ams[0] !== g.ams[0]) x.notes.push('Account manager on the RFP window: ' + x.ams.join('/') + '; on the OPS file: ' + g.ams.join('/'));
          x.ams = g.ams;
        }
        x.season = g.season;
        x.ops = g.ops; x.pay = g.pay; x.arrivePoint = g.arrivePoint; x.complete = g.complete;
        /* The OPS file is where a group goes once it is confirmed. */
        if (g.cancelled) { x.status = 'cancelled'; x.lostText = x.lostText || 'Cancelled (OPS file)'; }
        else {
          if (x.status === 'lost' || x.status === 'cancelled') x.notes.push('On the Cancelled list of the RFP window, but a live group in the OPS file');
          if (rows.length && (x.status === 'quoted' || x.status === 'enquiry')) x.notes.push('Still on the RFP ' + (x.status === 'quoted' ? 'follow-up list' : 'live board') + ', but in the OPS file');
          x.status = 'confirmed'; x.lostCode = ''; x.lostText = ''; x.followUp = '';
        }
        if (g.fixed.length) x.notes.push('The OPS file had last year’s year on the ' + g.fixed.join(' and ') + ' — taken as ' + g.season);
        g.notes.forEach(n => x.notes.push(n));
      }
      x.season = '20' + x.year;
      x.origin = x.from.map(k => ORIGIN[k]).join(' + ');
      /* Old work closed off: a group already home is closed (the old sheets
         see it through), and a quote whose travel dates have gone without a
         yes is lost. */
      const lastDay = x.departure || x.arrival || (x.month ? D.addDays(D.addMonths(x.month + '-01', 1), -1) : '');
      if (x.status === 'confirmed' && lastDay && lastDay < today) { x.status = 'closed'; x.closedAt = lastDay; }
      if ((x.status === 'quoted' || x.status === 'enquiry') && lastDay && lastDay < today) {
        x.status = 'lost'; x.lostText = 'Travel dates passed without a confirmation'; x.decidedAt = lastDay; x.followUp = '';
      }
      if (x.arrival && x.departure && x.departure < x.arrival) x.departure = '';
      out.push(x);
    });
    out.sort((a, b) => (a.year === b.year ? a.num - b.num : a.year < b.year ? -1 : 1));
    return out;
  }

  /* ══ The quotes window (Jess's sheet) ════════════════════════════════
     Every RFP as it is registered, a tab per month: Office (the
     department), Ref, the agency, Rec. (the day it came in), Ac/Ex (the
     account manager), then the contact, country, pax and travel month —
     their headings differ from tab to tab and the cells don't always sit
     under them, so after Ac/Ex each is found by what it holds. It says
     nothing of how a request ended: that is the RFP window's and the OPS
     file's to say. */
  const QUOTE_HEAD = [/^ref$/, /^rec/];
  const looksPax = v => pax(v) !== '' || /^(tbc|tba)$/i.test(norm(v)) || /^\d{1,4}\s*(?:-|\/|or|to)\s*\d{1,4}\s*(?:pax)?$/i.test(norm(v));
  function quotes(tabs) {
    const files = [], problems = [], seen = [];
    tabs.forEach(t => {
      const hd = heading(t.rows || [], QUOTE_HEAD);
      if (!hd) { seen.push({ tab: norm(t.name), used: 0, why: 'no heading row with Ref and Rec.' }); return; }
      const h = hd.h, c = { office: find(h, /^office|^dept/), ref: find(h, /^ref$/), rec: find(h, /^rec/), am: find(h, /^ac ?\/ ?ex|^a ?m$/) };
      const agencyAt = c.ref + 1;
      let used = 0;
      for (let i = hd.at + 1; i < t.rows.length; i++) {
        const r = t.rows[i] || [], row = i + 1;
        const rl = refs(r[c.ref]), agency = norm(r[agencyAt]);
        if (/^next number/i.test(agency)) continue;                                                     // Jess's note of the next free numbers
        if (!rl.length) { if (agency) problems.push({ tab: norm(t.name), row: row, why: 'no reference' }); continue; }
        if (!agency) { problems.push({ tab: norm(t.name), row: row, why: 'no agency' }); continue; }
        /* After Ac/Ex: the contact, the country, the pax and the travel dates, found by what each holds. */
        const items = [];
        for (let k = (c.am >= 0 ? c.am : c.rec) + 1; k < r.length; k++) if (norm(r[k]) !== '') items.push(r[k]);
        let ci = items.findIndex(v => typeof v !== 'number' && norm(v).length <= 14 && !!country(v) && (norm(v).length <= 3 || !!C_ALIAS[norm(v).toUpperCase()]));
        let contact = '', paxV = '', travelV = '';
        const rest = ci >= 0 ? items.slice(ci + 1) : items.slice();
        if (ci >= 0) contact = items.slice(0, ci).filter(v => typeof v !== 'number')[0] || '';
        else if (rest.length && typeof rest[0] !== 'number' && !looksPax(rest[0])) contact = rest.shift();
        const pi = rest.findIndex(looksPax);
        if (pi >= 0) { paxV = rest[pi]; travelV = rest[pi + 1] !== undefined ? rest[pi + 1] : ''; }
        else travelV = rest[0] !== undefined ? rest[0] : '';
        const tv = travel(travelV, '20' + rl[0].slice(0, 2));
        const rec = {
          tab: norm(t.name), row: row, kind: 'quotes', ref: rl[0], more: rl.slice(1), agency: agency.slice(0, 120),
          contact: /^(tbc|tba|\?+)$/i.test(norm(contact)) ? '' : norm(contact).slice(0, 120), country: ci >= 0 ? country(items[ci]) : '',
          pax: pax(paxV), ams: initials(String(r[c.am] === undefined ? '' : r[c.am]).replace(/[`'’]/g, '')), type: c.office >= 0 ? dept(r[c.office]) : '',
          received: date(r[c.rec]), arrival: tv.arrival, departure: tv.departure, month: tv.month, season: tv.year || '20' + rl[0].slice(0, 2), notes: []
        };
        if (!tv.exact && norm(isSerial(travelV) ? '' : travelV)) rec.notes.push('Travel, as written: ' + norm(travelV));
        if (norm(paxV) !== '' && norm(paxV) !== String(rec.pax)) rec.notes.push('Numbers, as written: ' + norm(paxV));
        if (rec.more.length) rec.notes.push('Registered together with ' + rec.more.join(', '));
        /* A series on one line ("27/1500 -27/1503"): each departure has a number of its own (Iain, 29 Oct), so each is a request. */
        [rec].concat(rec.more.map(r2 => Object.assign({}, rec, { ref: r2, more: [], notes: rec.notes.slice() }))).forEach(x => files.push(x));
        used++;
      }
      seen.push({ tab: norm(t.name), used: used, kind: 'month' });
    });
    return { files: files, problems: problems, tabs: seen };
  }

  /* ══ JOR's agreed rates card ═════════════════════════════════════════
     "Coach - Guide - Lunches & Dinners Agreed Rates": a block per year side
     by side ("Rates 2026", "Rates 2027"), each with sections (COACH, GUIDE,
     LUNCH / DINNER & DRINKS, Visits) headed "Cost Price" and "Sales Rates in
     Program". Inside a section, a line with no prices heads what follows
     (the coach size bands, the guide's language, the region); a line with
     prices is a rate. Read here as an ordinary rates table — supplier, type,
     year, service, unit, amount, sell — so it goes in like any other. */
  const CARD_SUPPLIER = { coach: 'Coach — JOR agreed rates', guide: 'Guide — JOR agreed rates', restaurant: 'Lunches & dinners — JOR agreed rates' };
  function rateCard(rows) {
    rows = rows || [];
    const blocks = [];
    for (let i = 0; i < Math.min(rows.length, 6); i++) (rows[i] || []).forEach((v, k) => { const m = norm(v).match(/^rates?\s+(20\d{2})$/i); if (m) blocks.push({ at: k, year: m[1] }); });
    if (!blocks.length || !rows.some(r => (r || []).some(v => /^cost price$/i.test(norm(v))))) return null;
    const out = [['Supplier', 'Type', 'Year', 'Service', 'Unit', 'Amount', 'Sell']];
    const num = v => (typeof v === 'number' ? v : /^\d+(\.\d+)?$/.test(norm(v)) ? +norm(v) : null);
    blocks.forEach(b => {
      const o = b.at;
      let type = '', group = '', lang = '', bands = [], sellAt = -1;
      rows.forEach(r => {
        r = r || [];
        const head = norm(r[o]), label = norm(r[o + 1]);
        if (/^cost price$/i.test(norm(r[o + 2]))) {
          type = /coach/i.test(head) ? 'coach' : /guide/i.test(head) ? 'guide' : /lunch|dinner|drink/i.test(head) ? 'restaurant' : /visit/i.test(head) ? 'visit' : '';
          sellAt = [o + 3, o + 4, o + 5, o + 6].filter(k => /sales? rate/i.test(norm(r[k])))[0];
          if (sellAt === undefined) sellAt = -1;
          group = ''; lang = ''; bands = [];
          return;
        }
        if (!type || !label) return;
        const costs = [o + 2, o + 3, o + 4].map(k => r[k]);
        const prices = costs.map(num);
        /* A heading line: size bands across ("6 to 15 pax", "16 seaters"), or a language or a region. */
        if (prices.every(p => p === null)) {
          if (costs.some(c => /pax|seater/i.test(norm(c)))) { group = label; bands = costs.map(norm); }
          else if (costs.some(c => norm(c) !== '')) return;                                     // "on demand": a service with no price

          else if (type === 'guide' && /^guide\b/i.test(label)) { lang = label; group = ''; }
          else group = label;
          return;
        }
        const sell = sellAt >= 0 ? num(r[sellAt]) : null;
        const unit = type === 'coach' || type === 'guide' ? 'group' : 'pp';
        prices.forEach((p, k) => {
          if (p === null) return;
          const band = type === 'coach' && bands[k] ? bands[k] : '';
          const what = [lang, group, label, band].filter(Boolean).join(' — ').replace(/\s+/g, ' ');
          const supplier = type === 'visit' ? label : CARD_SUPPLIER[type];
          out.push([supplier, type, b.year, type === 'visit' ? 'Entry' : what.slice(0, 120), unit, p, sell === null ? '' : sell]);
        });
      });
    });
    return out.length > 1 ? out : null;
  }

  /* Which of JOR's files this is. */
  function kind(tabs) {
    const names = tabs.map(t => norm(t.name));
    if (names.some(n => RFP_TABS.some(k => k[0].test(n)))) return 'rfp';
    if (tabs.some(t => /^\d{4}$/.test(norm(t.name)) && heading(t.rows || [], [/^ref$/, /^group name/]))) return 'ops';
    if (tabs.some(t => heading(t.rows || [], QUOTE_HEAD) && heading(t.rows || [], [/^ac ?\/ ?ex|^office/]))) return 'quotes';
    return '';
  }

  root.JOR_HISTORY = { kind, rfp, ops, quotes, rateCard, merge, date, done, travel, pax, paxNote, initials, country, source, dept, refs, week, lostCode, arrivePoint, monthOf, SENT };
})(typeof window !== 'undefined' ? window : globalThis);
