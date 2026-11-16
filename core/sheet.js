/* ═══════════════════════════════════════════════════════════════════════
   JORIS — spreadsheets in and out, with nothing from outside
   read(file): an .xlsx or .csv as tabs of rows (the browser's own unzip);
   write(tabs): an .xlsx Excel opens without a murmur. An old .xls has to
   be saved as .xlsx in Excel first — that format is a different beast.
   ═══════════════════════════════════════════════════════════════════════ */
window.SHEET = (function () {
  'use strict';

  /* ── Zip ── */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  const enc = new TextEncoder(), dec = new TextDecoder();

  function zip(files) {
    const parts = [], central = [];
    let offset = 0;
    files.forEach(f => {
      const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
      c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), name);
      offset += 30 + name.length + data.length;
    });
    const size = central.reduce((a, x) => a + x.length, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, size, true); e.setUint32(16, offset, true);
    return new Blob(parts.concat(central, [new Uint8Array(e.buffer)]), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  async function unzip(buf) {
    const u = new Uint8Array(buf), v = new DataView(buf);
    let e = -1;
    for (let i = u.length - 22; i >= Math.max(0, u.length - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error('That isn’t a spreadsheet I can open.');
    const n = v.getUint16(e + 10, true);
    let p = v.getUint32(e + 16, true);
    const out = {};
    for (let i = 0; i < n; i++) {
      const method = v.getUint16(p + 10, true), csize = v.getUint32(p + 20, true);
      const nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), local = v.getUint32(p + 42, true);
      const name = dec.decode(u.subarray(p + 46, p + 46 + nl));
      const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
      out[name] = { method: method, data: u.subarray(start, start + csize) };
      p += 46 + nl + xl + cl;
    }
    const text = async name => {
      const f = out[name];
      if (!f) return null;
      if (f.method === 0) return dec.decode(f.data);
      if (typeof DecompressionStream === 'undefined') throw new Error('This browser can’t open .xlsx files — save it as .csv from Excel instead.');
      const s = new Blob([f.data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return dec.decode(await new Response(s).arrayBuffer());
    };
    return { names: Object.keys(out), text: text };
  }

  /* ── Reading ── */
  const xml = s => new DOMParser().parseFromString(s, 'application/xml');
  const col = ref => { let n = 0; for (const ch of ref.replace(/\d+$/, '')) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
  const all = (node, tag) => Array.from(node.getElementsByTagNameNS('*', tag));
  async function readXlsx(buf) {
    const z = await unzip(buf);
    const wb = xml(await z.text('xl/workbook.xml') || '');
    const rels = xml(await z.text('xl/_rels/workbook.xml.rels') || '<x/>');
    const target = {};
    all(rels, 'Relationship').forEach(r => { target[r.getAttribute('Id')] = r.getAttribute('Target').replace(/^\/?(xl\/)?/, 'xl/'); });
    const ssx = await z.text('xl/sharedStrings.xml');
    const shared = ssx ? all(xml(ssx), 'si').map(si => all(si, 't').map(t => t.textContent).join('')) : [];
    const tabs = [];
    for (const s of all(wb, 'sheet')) {
      const rid = s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
      const doc = await z.text(target[rid] || '');
      if (!doc) continue;
      const rows = [];
      all(xml(doc), 'row').forEach(r => {
        const ri = (+r.getAttribute('r') || rows.length + 1) - 1, row = [];
        all(r, 'c').forEach((c, k) => {
          const t = c.getAttribute('t'), ref = c.getAttribute('r'), vEl = all(c, 'v')[0];
          let val = vEl ? vEl.textContent : '';
          if (t === 's') val = shared[+val] || '';
          else if (t === 'inlineStr') val = all(c, 't').map(x => x.textContent).join('');
          else if (t === 'b') val = val === '1';
          else if (t !== 'str' && t !== 'e' && val !== '' && !isNaN(val)) val = +val;
          row[ref ? col(ref) : k] = val;
        });
        rows[ri] = Array.from(row, x => x === undefined ? '' : x);
      });
      tabs.push({ name: s.getAttribute('name'), rows: Array.from(rows, x => x || []) });
    }
    return tabs;
  }
  function parseCsv(text) {
    const first = text.split(/\r?\n/)[0] || '';
    const sep = [',', ';', '\t'].sort((a, b) => first.split(b).length - first.split(a).length)[0];
    const rows = [];
    let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"') q = true;
      else if (ch === sep) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }
  async function read(file) {
    const name = file.name || '';
    if (/\.xls$/i.test(name)) throw new Error(name + ' is an old .xls file. Open it in Excel, Save As → Excel Workbook (.xlsx), and bring that in.');
    if (/\.(csv|txt)$/i.test(name)) return [{ name: name.replace(/\.[^.]+$/, ''), rows: parseCsv((await file.text()).replace(/^﻿/, '')) }];
    return readXlsx(await file.arrayBuffer());
  }

  /* ── Writing ── */
  const x = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '');
  const letters = i => { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  function sheetXml(t) {
    const widths = t.rows[0] ? t.rows[0].map((_, i) => Math.min(60, Math.max(8, ...t.rows.slice(0, 200).map(r => String(r[i] === undefined ? '' : r[i]).length + 2)))) : [];
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
      (widths.length ? '<cols>' + widths.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join('') + '</cols>' : '') +
      '<sheetData>' + t.rows.map((r, ri) => '<row r="' + (ri + 1) + '">' + r.map((v, ci) => {
        const ref = letters(ci) + (ri + 1), st = ri === 0 ? ' s="1"' : typeof v === 'number' && t.money && t.money.indexOf(ci) >= 0 ? ' s="2"' : '';
        if (v === null || v === undefined || v === '') return '';
        if (typeof v === 'number' && isFinite(v)) return '<c r="' + ref + '"' + st + '><v>' + v + '</v></c>';
        return '<c r="' + ref + '" t="inlineStr"' + st + '><is><t xml:space="preserve">' + x(v) + '</t></is></c>';
      }).join('') + '</row>').join('') + '</sheetData></worksheet>';
  }
  function write(tabs) {
    const used = {};
    const names = tabs.map(t => { let n = String(t.name || 'Sheet').replace(/[\\\/?*\[\]:]/g, ' ').slice(0, 31) || 'Sheet'; while (used[n]) n = n.slice(0, 28) + ' ' + (used[n]++ + 1); used[n] = 1; return n; });
    return zip([
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        tabs.map((t, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') + '</Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
        names.map((n, i) => '<sheet name="' + x(n) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets></workbook>' },
      { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        tabs.map((t, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') +
        '<Relationship Id="rId' + (tabs.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: 'xl/styles.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;€&quot;#,##0.00"/></numFmts>' +
        '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
        '<borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="3"><xf/><xf fontId="1" applyFont="1"/><xf numFmtId="164" applyNumberFormat="1"/></cellXfs></styleSheet>' }
    ].concat(tabs.map((t, i) => ({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: sheetXml(t) }))));
  }

  return { read: read, write: write, parseCsv: parseCsv, unzip: unzip };
})();
