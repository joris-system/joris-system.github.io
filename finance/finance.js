/* ═══════════════════════════════════════════════════════════════════════
   JORIS — Finance & KPIs
   The whole business at a glance, for the people an owner has ticked to see
   it. Everything is worked out on the server from the records as
   they are now; this page only draws it — no figure here is made up. The
   counts come first (RFPs, groups, people, conversion, markets); the money
   cards appear once there is money in JORIS to show, because the old
   RFP window and OPS file never had amounts. A season is a travel year.
   ═══════════════════════════════════════════════════════════════════════ */
(async function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = UI.esc, I = UI.icon, RU = window.JOR_RULES;
  const me = await JOR.me();
  UI.topBar('Finance & KPIs', 'JORIS', me);
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const OPS_SHORT = { coach: ['C', 'Coach'], guide: ['G', 'Guide'], accom: ['A', 'Accommodation'], lv: ['L', 'Lunches and visits'], rooming: ['R', 'Rooming list'], guidefile: ['F', 'Guide file'] };
  const still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let season = new URLSearchParams(location.hash.slice(1)).get('season') || '', d = null;
  /* Two ways to see it (Dave, 26 Oct): the summary — one big number a card, the map, the next
     groups in — or the full dashboard. Remembered on this computer. */
  let view = 'full';
  try { if (localStorage.getItem('jor.finance.view') === 'summary') view = 'summary'; } catch (e) { /* private window: the full one */ }

  /* Money, short for the big figures (€1.24m, €198k) and in full in the tables. */
  const big = n => { n = +n || 0; const a = Math.abs(n); return (n < 0 ? '−' : '') + (a >= 1e6 ? '€' + (a / 1e6).toFixed(a >= 1e7 ? 1 : 2) + 'm' : a >= 1e4 ? '€' + Math.round(a / 1e3) + 'k' : RU.euro(Math.round(a))); };
  const full = n => RU.euro(Math.round(+n || 0));
  const num = n => (+n || 0).toLocaleString('en-IE');
  const pc = n => (n === null || n === undefined ? '—' : n.toFixed(1) + '%');
  const ses = y => '20' + y;
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many || one + 's');
  /* A number that counts up as the page opens: <b data-n="1234" data-f="int|pct|eur">. */
  const cnt = (n, f) => (n === null || n === undefined ? '—' : '<span data-n="' + n + '" data-f="' + (f || 'int') + '">' + (f === 'pct' ? pc(n) : f === 'eur' ? big(n) : num(n)) + '</span>');

  if (!me.perms['finance.view']) {
    $('#view').innerHTML = '<div class="card pad empty">Only the people ticked to see the finance dashboard can open it — ask an admin.</div>';
    return;
  }

  async function load() {
    /* The figures as this tab last saw them, at once; worked out again behind, and drawn if any changed. */
    const asked = { season: season }, seen = JOR.last('finance.view', asked);
    let shown = '';
    if (seen) { shown = JSON.stringify(seen); d = seen; season = d.season; draw(); }
    else $('#view').innerHTML = '<div class="empty">Working out the figures…</div>';
    try { d = await JOR.call('finance.view', asked); }
    catch (e) { $('#view').innerHTML = '<div class="card pad empty">' + esc(e.message) + '</div>'; return; }
    JOR.keep('finance.view', asked, d);
    season = d.season;
    history.replaceState(null, '', '#season=' + season);
    if (JSON.stringify(d) !== shown) draw();
  }

  function draw() {
    const k = d.kpi, money = d.hasMoney, f = d.funnel;
    $('#sub').textContent = 'Season ' + ses(d.season) + ' — travelling in ' + ses(d.season) + '. Worked out from the records as they are, ' + UI.nice(d.today, true) + '.';
    $('#seasons').innerHTML = d.seasons.map(y => '<button data-s="' + esc(y) + '" class="' + (y === d.season ? 'on' : '') + '">' + ses(y) + '</button>').join('');
    const markets = d.markets.filter(x => x.key && x.rfps > 0);
    $('#views').querySelectorAll('[data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === view));
    document.body.classList.toggle('fin-sum', view === 'summary');
    if (view === 'summary') { drawSummary(markets); return; }

    /* The season at a glance, over the map of where the work comes from. */
    let h = '<section class="hero"><div class="hero-in"><div>' +
      '<p class="eyebrow">Season ' + ses(d.season) + '</p>' +
      '<div class="big">' + cnt(k.groups) + '<small>group' + (k.groups === 1 ? '' : 's') + ' confirmed</small></div>' +
      '<div class="lines"><div><b>' + cnt(k.pax) + '</b><em>people travelling</em></div><div><b>' + cnt(k.rfps) + '</b><em>RFPs in</em></div>' +
      '<div><b>' + cnt(k.conversion, 'pct') + '</b><em>won, of those decided</em></div><div><b>' + cnt(markets.length) + '</b><em>market' + (markets.length === 1 ? '' : 's') + '</em></div></div>' +
      (d.history && d.history.files ? '<p class="src">Includes ' + num(d.history.files) + ' files brought in from the RFP window and the OPS file' + (d.history.at ? ' on ' + esc(UI.nice(d.history.at, true)) : '') + '.</p>' : '') +
      '</div><div class="map" id="map">' + worldMap(markets) + '<div class="tip" id="tip"></div></div></div>' +
      '<div class="maplegend"><span><i style="background:#FFC81E"></i>Groups confirmed, by market</span><span><i style="background:#2BC48A"></i>Where RFPs come from — the brighter, the more</span><span><i style="background:#fff"></i>Ireland</span></div></section>';

    /* The counts, then the money once there is any. */
    const why0 = d.lostWhy[0];
    h += '<div class="kpis">' +
      kpi('Quoted, waiting', cnt(k.pipeline.groups), plural(k.enquiries, 'new enquiry', 'new enquiries') + ' not quoted yet', '#E2A400') +
      kpi('Lost', cnt(k.lost), why0 ? 'most often: ' + esc(whyLabel(why0)) : 'none this season', 'var(--err)') +
      kpi('Cancelled', cnt(f.cancelled), 'after confirming', 'var(--ink-3)') +
      kpi('Average group', k.groups ? cnt(Math.round(k.pax / k.groups)) : '—', 'people a group, confirmed', 'var(--blue)') +
      kpi('Coming in 60 days', cnt(d.ops.length), plural(d.ops.filter(x => x.done === x.of).length, 'fully ready', 'fully ready') + ' on the operations list', 'var(--jor-dark)') +
      '</div>' + (money ? '<div class="kpis m4">' + kpi('Sold', cnt(k.sold, 'eur'), k.perPax ? full(k.perPax) + ' a head' : 'the accepted costings', 'var(--jor)') +
        kpi('Margin', cnt(k.margin, 'pct'), big(k.profit) + ' on what was sold', 'var(--jor-dark)') +
        kpi('Money in', cnt(k.received, 'eur'), 'of ' + big(k.invoiced) + ' invoiced', '#2E8C69') +
        kpi('Owed to JOR', cnt(d.cash.owed, 'eur'), d.cash.overdue ? '<span class="late">' + big(d.cash.overdue) + ' late</span> · every season' : 'nothing late · every season', d.cash.overdue ? 'var(--err)' : '#2E8C69') + '</div>' : '');
    if (!money) h += '<div class="nomoney">' + I('euro', 'sm') + '<span><b>Money figures start here once JORIS has them.</b> The RFP window and the OPS file never held amounts, so sold, margin, money in and what is owed appear as costings are accepted and invoices go through the Money part.</span></div>';

    /* Pace: this season against last at the same point — only when both seasons say when their groups were confirmed. */
    if (d.pace && d.pace.then && d.pace.dated >= 0.8) {
      const p = d.pace, base = money ? p.then.sold : p.then.groups, now = money ? p.now.sold : p.now.groups, diff = base ? 100 * (now - base) / base : null;
      h += '<div class="pace">' + I('chart', 'sm') + '<span><b>Pace.</b> Confirmed so far for ' + ses(d.season) + ': <b>' + plural(p.now.groups, 'group') + '</b>' + (money ? ', ' + big(p.now.sold) : '') + '.</span>' +
        '<span>A year ago, ' + ses(p.prev) + ' stood at <b>' + plural(p.then.groups, 'group') + '</b>' + (money ? ', ' + big(p.then.sold) : '') +
        (diff === null ? '' : ' — <span class="' + (diff >= 0 ? 'up' : 'down') + '">' + (diff >= 0 ? '+' : '−') + Math.abs(diff).toFixed(0) + '%</span>') + '.</span>' +
        '<span class="mini">' + ses(p.prev) + ' finished on ' + plural(p.final.groups, 'group') + (money ? ', ' + big(p.final.sold) : '') + '.</span></div>';
    }

    /* The season, month by month */
    const mv = m => (money ? [m.sold, m.pipeline] : [m.groups, m.quoted]);
    const maxM = Math.max(1, ...d.months.map(m => mv(m)[0] + mv(m)[1]));
    h += card('cal', 'The season, month by month', money ? 'What is sold for each month of arrivals, and what is quoted and waiting for a yes.' : 'Groups confirmed for each month of arrivals, and the quotes still waiting for a yes.',
      '<div class="cols">' + d.months.map(m => {
        const v = mv(m), tot = v[0] + v[1];
        return '<div class="col" title="' + esc(MON[m.m - 1] + ': ' + plural(m.groups, 'group') + ', ' + num(m.pax) + ' people' + (money ? ', ' + full(m.sold) + ' sold' : '') + (m.quoted ? '; ' + m.quoted + ' quoted' + (money && m.pipeline ? ', ' + full(m.pipeline) : '') : '')) + '">' +
          '<span class="amt">' + (money ? (m.sold ? big(m.sold) : '') : (m.pax ? num(m.pax) + ' pax' : '')) + '</span><div class="stack" data-h="' + (100 * tot / maxM).toFixed(1) + '">' +
          '<div class="b1" style="height:' + (tot ? 100 * v[0] / tot : 0).toFixed(1) + '%"></div><div class="b2" style="flex:1"></div></div></div>';
      }).join('') + '</div>' +
      '<div class="xl">' + d.months.map(m => '<span>' + MON[m.m - 1] + '<br><b>' + (m.groups || '') + '</b></span>').join('') + '</div>' +
      '<div class="legend"><span><i style="background:var(--jor)"></i>' + (money ? 'Sold' : 'Confirmed') + '</span><span><i style="background:#f3dc9e"></i>Quoted, waiting for a yes</span><span>Under each month: groups confirmed</span></div>');

    /* Operations: the groups coming in the next 60 days */
    h += card('bus', 'Operations — the next 60 days', d.ops.length ? 'Each group coming in, and how far its operations list has got: Coach, Guide, Accommodation, Lunches and visits, Rooming list, guide File.' : '',
      d.ops.length ? '<div class="opsl">' + d.ops.map(x => {
        const pct = Math.round(100 * x.done / x.of), cls = pct === 100 ? '' : x.days <= 14 ? 'red' : 'amber';
        return '<a class="opsr" href="../register/#ref=' + encodeURIComponent(x.ref) + '"><div class="dt"><b>' + esc(x.arrival.slice(8, 10)) + '</b><span>' + MON[+x.arrival.slice(5, 7) - 1] + '</span></div>' +
          '<div class="who"><div><b>' + esc(x.ref) + '</b> ' + esc(x.agent) + (x.tourName ? ' <span class="mini">— ' + esc(x.tourName) + '</span>' : '') + '</div>' +
          '<div class="mini">' + (x.days === 0 ? 'arrives today' : 'in ' + plural(x.days, 'day')) + (x.pax ? ' · ' + x.pax + ' pax' : '') + (x.am ? ' · ' + esc(x.am) : '') + '</div></div>' +
          '<div class="ticks">' + RU.OPS_CHECKS.map(c => '<i class="' + (x.missing.indexOf(c.k) < 0 ? 'on' : '') + '" title="' + esc(OPS_SHORT[c.k][1] + (x.missing.indexOf(c.k) < 0 ? ' — done' : ' — not yet')) + '">' + OPS_SHORT[c.k][0] + '</i>').join('') + '</div>' +
          '<div class="pw"><div class="pb"><i class="' + cls + '" data-w="' + pct + '"></i></div>' + x.done + '/' + x.of + '</div></a>';
      }).join('') + '</div>' : '<div class="mini">No groups arriving in the next 60 days.</div>');

    /* Sales: from enquiry to confirmed, and why groups are lost */
    const fmax = Math.max(1, f.rfps), why = d.lostWhy, wmax = Math.max(1, ...why.map(x => x.n));
    const unnamed = why.filter(x => x.code && !x.label).length;
    h += '<div class="grid2">' +
      card('flag', 'From enquiry to confirmed', 'Every RFP for ' + ses(d.season) + ', and how far it has got.',
        '<div class="funnel">' + [['RFPs in', f.rfps, ''], ['Quoted', f.quoted, 'q'], ['Confirmed', f.confirmed, 'c']].map(x =>
          '<div class="st"><div class="fb ' + x[2] + '" data-w="' + (14 + 64 * x[1] / fmax).toFixed(1) + '">' + cnt(x[1]) + '</div><span class="lbl2">' + x[0] + '</span></div>').join('') + '</div>' +
        '<div class="chips2"><span><b>' + f.lost + '</b> lost</span><span><b>' + f.cancelled + '</b> cancelled after confirming</span><span><b>' + f.open + '</b> still open</span>' +
        (f.opsOnly ? '<span title="Groups on the OPS file that never went through the RFP window: they count as groups, not as RFPs won.">+ <b>' + f.opsOnly + '</b> group' + (f.opsOnly === 1 ? '' : 's') + ' only on the OPS file</span>' : '') +
        (d.turnaround.median !== null ? '<span>On the board in <b>' + mins(d.turnaround.median) + '</b> (median, last 90 days)</span>' : '') + '</div>') +
      card('x', 'Why groups are lost', why.length ? 'The reason given when each file was marked lost' + (money ? ' — and what was on the table.' : '; the X-codes as the RFP window kept them.') : '',
        why.length ? why.map(x => '<div class="hb" title="' + esc(x.examples.join(' · ')) + '"><span class="lb">' + whyHtml(x) + '</span><div class="tr"><i class="red" data-w="' + (100 * x.n / wmax).toFixed(1) + '"></i></div>' +
          '<span class="n">' + x.n + '</span><span class="m">' + (x.value ? big(x.value) : pc(100 * x.n / Math.max(1, f.lost)).replace('.0', '')) + '</span></div>').join('') +
          (unnamed ? '<p class="mini" style="margin:10px 0 0">' + plural(unnamed, 'code has', 'codes have') + ' no meaning yet' + (me.perms['settings.manage'] ? ' — <a href="../admin/">say what each X-code means in Admin › Settings</a>.' : ' — an admin can name them in Settings.') + '</p>' : '')
          : '<div class="mini">None lost this season.</div>') +
      '</div>';

    /* Markets and agents */
    const mkts = d.markets.filter(x => x.key && (x.rfps || x.groups)), mv2 = x => (money ? x.sold : x.groups), mmax = Math.max(1, ...mkts.map(mv2));
    h += '<div class="grid2">' +
      card('flag', 'Markets', money ? 'Sold in each country, and the margin.' : 'Groups confirmed from each country, and how often an RFP from it is won.',
        mkts.slice(0, 10).map(x => '<div class="hb" title="' + esc(x.name + ': ' + plural(x.groups, 'group') + ', ' + num(x.pax) + ' people; ' + plural(x.rfps, 'RFP') + ', ' + x.won + ' won') + '"><span class="lb">' + esc(x.name) + '</span>' +
          '<div class="tr"><i data-w="' + (100 * mv2(x) / mmax).toFixed(1) + '"></i></div><span class="n">' + (money ? big(x.sold) : plural(x.groups, 'group')) + '</span><span class="m">' + pc(money ? x.margin : x.conversion) + '</span></div>').join('') +
          (mkts.length ? '<div class="legend"><span>' + (money ? 'Sold, then the margin' : 'Groups confirmed, then the share of RFPs won') + '</span></div>' : '<div class="mini">Nothing yet.</div>')) +
      card('users', 'Agents', 'Who sends the work, and who books it.',
        '<div class="tw2"><table class="ft"><thead><tr><th>Agent</th><th class="num">Groups</th><th class="num">People</th><th class="num">RFPs</th><th class="num">Won</th><th class="num">Conv.</th>' + (money ? '<th class="num">Sold</th><th class="num">Margin</th>' : '') + '</tr></thead><tbody>' +
          d.agents.map(x => '<tr><td>' + esc(x.name) + '</td><td class="num"><b>' + x.groups + '</b></td><td class="num">' + num(x.pax) + '</td><td class="num">' + x.rfps + '</td><td class="num">' + x.won + '</td><td class="num">' + pc(x.conversion) + '</td>' +
            (money ? '<td class="num">' + full(x.sold) + '</td><td class="num">' + pc(x.margin) + '</td>' : '') + '</tr>').join('') +
          '</tbody></table></div>') +
      '</div>';

    /* Account managers */
    const amax = Math.max(1, ...d.ams.map(x => (money ? x.sold : x.groups)));
    h += card('users', 'Account managers', 'Their files for ' + ses(d.season) + ': what came in, what was won' + (money ? ', and the margin on it.' : '.'),
      '<div class="tw2"><table class="ft"><thead><tr><th>Account manager</th><th class="num">Groups</th><th class="num">People</th><th class="num">RFPs</th><th class="num">Still open</th><th class="num">Won</th><th class="num">Lost</th><th class="num">Conversion</th>' +
        (money ? '<th class="num">Sold</th><th class="num">Margin</th>' : '') + '</tr></thead><tbody>' +
        d.ams.map(x => '<tr><td>' + esc(x.name) + '</td><td class="num"><b>' + x.groups + '</b>' + (money ? '' : '<span class="mbar"><i data-w="' + (100 * x.groups / amax).toFixed(0) + '"></i></span>') + '</td><td class="num">' + num(x.pax) + '</td>' +
          '<td class="num">' + x.rfps + '</td><td class="num">' + x.open + '</td><td class="num">' + x.won + '</td><td class="num">' + x.lost + '</td><td class="num">' + pc(x.conversion) + '</td>' +
          (money ? '<td class="num">' + full(x.sold) + '<span class="mbar"><i data-w="' + (100 * x.sold / amax).toFixed(0) + '"></i></span></td><td class="num">' + pc(x.margin) + '</td>' : '') + '</tr>').join('') +
        '</tbody></table></div>');

    /* Cash: owed to JOR by age, falling due, and the suppliers — once there is money in JORIS */
    if (money) {
      const ag = d.cash.aging, gmax = Math.max(1, ...ag.map(x => x.value)), dmax = Math.max(1, ...d.cash.dueIn.map(x => x.value)), sp = d.cash.suppliers;
      h += '<div class="grid2">' +
        card('euro', 'Owed to JOR', 'Invoices out and not yet paid, every season — by how late they are.',
          ag.map((x, i) => '<div class="hb"><span class="lb">' + esc(x.label) + '</span><div class="tr"><i class="' + (i ? 'red' : '') + '" data-w="' + (100 * x.value / gmax).toFixed(1) + '"></i></div>' +
            '<span class="n">' + big(x.value) + '</span><span class="m">' + (x.n ? x.n + ' inv.' : '') + '</span></div>').join('') +
          '<p class="why" style="margin:12px 0 6px">Falling due, the next twelve weeks</p><div class="cols" style="height:110px">' + d.cash.dueIn.map(x => '<div class="col" title="' + esc('Week of ' + UI.nice(x.week) + ': ' + full(x.value) + (x.n ? ', ' + plural(x.n, 'invoice') : '')) + '">' +
            '<div class="stack" data-h="' + (100 * x.value / dmax).toFixed(1) + '"><div class="b1" style="height:100%"></div></div></div>').join('') + '</div>' +
          '<div class="xl">' + d.cash.dueIn.map((x, i) => '<span>' + (i % 2 ? '' : esc(UI.nice(x.week).replace(/^\w+ /, ''))) + '</span>').join('') + '</div>' +
          (d.cash.toRaise ? '<p class="mini" style="margin:8px 0 0">' + plural(d.cash.toRaise, 'invoice') + ' still to go out in the next four weeks.</p>' : '')) +
        card('warn', 'Suppliers, and the money at risk', 'Bills in from suppliers, and what cancelling every confirmed group today would cost.',
          '<div class="trio"><div><b>' + big(sp.toCheck.value) + '</b><span>' + plural(sp.toCheck.n, 'bill') + ' to check or in query</span></div>' +
            '<div><b>' + big(sp.toPay.value) + '</b><span>' + sp.toPay.n + ' checked, to pay</span></div><div><b>' + big(sp.paid.value) + '</b><span>' + sp.paid.n + ' paid</span></div></div>' +
          '<div class="trio" style="grid-template-columns:repeat(2,minmax(0,1fr))"><div><b>' + big(d.risk.exposure) + '</b><span>if every confirmed group cancelled today</span></div>' +
            '<div style="' + (d.risk.atRiskGroups ? 'background:var(--err-bg);border-color:#f3c9c5' : '') + '"><b>' + big(d.risk.atRiskValue) + '</b><span>' + plural(d.risk.atRiskGroups, 'group') + ' with rooms held and no deposit in</span></div></div>' +
          (d.risk.atRisk.length ? '<table class="ft"><tbody>' + d.risk.atRisk.map(x => '<tr><td><b>' + esc(x.ref) + '</b> ' + esc(x.agent) + '</td><td>' + esc(UI.nice(x.arrival)) + '</td><td class="num">' + full(x.exposure) + '</td></tr>').join('') + '</tbody></table>' : '')) +
        '</div>';
    }

    /* Every season side by side */
    const sv = x => (money ? x.sold : x.groups), smax = Math.max(1, ...d.bySeason.map(sv));
    h += card('chart', 'Seasons compared', 'Each travel year: ' + (money ? 'sold, groups, people and margin' : 'groups confirmed, people and conversion') + '. The current season is still being sold.',
      d.bySeason.map(x => '<div class="hb ssn"><span class="lb"><b>' + ses(x.season) + '</b></span><div class="tr"><i class="' + (x.season === d.season ? '' : 'gold') + '" data-w="' + (100 * sv(x) / smax).toFixed(1) + '"></i></div>' +
        '<span class="n">' + (money ? big(x.sold) : plural(x.groups, 'group')) + '</span><span class="m">' + (money ? x.groups + ' groups · ' : x.rfps + ' RFPs · ') + num(x.pax) + ' pax · ' + (money ? pc(x.margin) : pc(x.conversion) + ' won') + '</span></div>').join(''));

    h += '<p class="foot2"><b>How the figures are worked out.</b> Groups are the files confirmed or closed for the season; people are their latest numbers. ' +
      'RFPs are the files that came through the register or the RFP window, and conversion is won out of won-and-lost among them — a group that was only ever on the OPS file counts as a group, not as an RFP won. ' +
      'A season is a travel year — the 27 of 27/1066. ' + (money ? 'Sold is the accepted costing of each group, at its number of people (or what was invoiced, where there is no accepted costing); margin is from the costings; money in is what accounts marked received. ' : '') +
      (d.history && d.history.files ? 'Files brought in from the old sheets: a group already home when it came in is closed, and a quote whose travel dates had passed without a yes counts as lost. Series departures with no reference of their own aren’t counted. ' : '') +
      'Only management ticked to see this dashboard can open it.</p>';
    $('#view').innerHTML = h;
    grow($('#view'));
    wireMap();
  }

  /* ── The summary: the same figures, fewer of them, each with room ─────────
     A band of JOR's colours, a side panel with the person and the parts, one
     big card for the season, money in and owed, the groups coming in, the map,
     the account managers and the top markets. Nothing here that the full
     dashboard doesn't have; "Full" shows the rest. */
  function drawSummary(markets) {
    const k = d.kpi, money = d.hasMoney, f = d.funnel;
    const won = k.won !== undefined ? k.won : f.confirmed, decided = won + (k.lost || 0);
    /* First and last: Name Surname → NS, Account manager 3 → A3 */
    const initials = s => { const w = String(s || '').split(/\s+/).filter(Boolean); return (w.length > 1 ? w[0][0] + w[w.length - 1][0] : (w[0] || '').slice(0, 2)).toUpperCase(); };
    const spark = (vals, colour) => {
      const v = vals.length > 1 ? vals : [0, 0], mx = Math.max(1e-9, ...v), mn = Math.min(...v), r = mx - mn || 1;
      return '<svg viewBox="0 0 64 24" aria-hidden="true"><path d="' + v.map((x, i) => (i ? 'L' : 'M') + (2 + 60 * i / (v.length - 1)).toFixed(1) + ',' + (20 - 16 * (x - mn) / r).toFixed(1)).join(' ') +
        '" fill="none" stroke="' + colour + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    };
    const QUILT = [['#E8F3EE', 'tbr', '#073A2B'], ['#073A2B', 'qbl', '#00A66E'], ['#CDE7DC', 'dots', '#073A2B'], ['stripes'], ['#00A66E', 'ttr', '#E8F3EE'], ['#CDE7DC', 'half', '#F4FAF7'],
      ['#073A2B', 'chev', '#FFC81E'], ['#FFC81E', 'qtl', '#0B6B4B'], ['#CDE7DC', 'tbl', '#073A2B'], ['#00A66E', 'half', '#E8F3EE'], ['#073A2B', 'ttl', '#00A66E']];
    const quilt = QUILT.map(t => {
      if (t[0] === 'stripes') return '<i class="stripes"></i>';
      const b = t[2], ab = 'position:absolute;inset:0;background:' + b;
      const inner = { tbr: '<b style="' + ab + ';clip-path:polygon(100% 0,100% 100%,0 100%)"></b>', ttr: '<b style="' + ab + ';clip-path:polygon(0 0,100% 0,100% 100%)"></b>',
        tbl: '<b style="' + ab + ';clip-path:polygon(0 0,0 100%,100% 100%)"></b>', ttl: '<b style="' + ab + ';clip-path:polygon(0 0,100% 0,0 100%)"></b>',
        qbl: '<b style="position:absolute;left:-60%;bottom:-60%;width:120%;height:120%;border-radius:50%;background:' + b + '"></b>',
        qtl: '<b style="position:absolute;left:-60%;top:-60%;width:120%;height:120%;border-radius:50%;background:' + b + '"></b>',
        half: '<b style="position:absolute;left:0;right:0;bottom:-55%;height:100%;border-radius:50% 50% 0 0;background:' + b + '"></b>',
        chev: '<b style="position:absolute;inset:0 0 50% 0;background:' + b + ';clip-path:polygon(30% 0,70% 0,50% 70%)"></b><b style="position:absolute;left:0;right:0;bottom:0;height:45%;background:#00A66E"></b>',
        dots: '<b class="dots">' + ('<span style="background:' + b + '"></span>').repeat(4) + '</b>' }[t[1]];
      return '<i style="background:' + t[0] + '">' + inner + '</i>';
    }).join('');
    const parts = UI.partsFor(me).filter(p => p.href && p.href.indexOf('#') < 0 && p.href !== 'finance/').slice(0, 6);
    const sideBig = money ? big(k.sold) : num(k.groups), sideLbl = money ? 'Sold this season' : 'Groups this season';
    const soon = d.ops.slice(0, 4), amsTop = d.ams.slice().sort((a, b) => b.won - a.won || b.groups - a.groups).slice(0, 4);
    const top = d.markets.filter(x => x.key && (money ? x.sold : x.groups)).sort((a, b) => (money ? b.sold - a.sold : b.groups - a.groups)).slice(0, 3);
    const TILE = [['var(--jor)', '#fff'], ['#FFC81E', '#073A2B'], ['#073A2B', '#fff']];
    const mini = (label, value, line, lift) => '<div class="sm-mini' + (lift ? ' lift' : '') + '">' + line + '<div><span>' + esc(label) + '</span><b>' + value + '</b></div></div>';
    let h = '<div class="fsum"><div class="sm-band">' + quilt + '</div>' +
      '<aside class="sm-side"><div class="sm-logo">' + (window.JOR_MARKS && JOR_MARKS.logo ? '<img src="' + JOR_MARKS.logo + '" alt="JOR">' : '<b>JORIS</b>') + '</div>' +
        '<div class="sm-av">' + esc(initials(me.name)) + '</div><div class="sm-hello">Welcome back,<b>' + esc(me.name) + '</b></div>' +
        '<div class="sm-budget"><b>' + sideBig + '</b><span>' + sideLbl + '</span></div>' +
        '<nav class="sm-nav"><a class="on">' + I('chart', 'sm') + 'Finance &amp; KPIs</a>' + parts.map(p => '<a href="' + JOR.ROOT + p.href + '">' + I(p.icon, 'sm') + esc(p.t) + '</a>').join('') + '</nav>' +
        '<button class="sm-full" data-v="full">' + I('grid', 'sm') + 'The full dashboard</button></aside>' +
      '<div class="sm-main"><div class="sm-l">' +
        '<div class="sm-hero"><div class="sm-row"><span class="sm-lbl">Season ' + ses(d.season) + '</span><span class="sp"></span><span class="sm-lbl">' + (d.history && d.history.files ? 'with the old sheets' : 'from the records') + '</span></div>' +
          '<div class="sm-big">' + cnt(k.groups) + '<small>group' + (k.groups === 1 ? '' : 's') + ' confirmed</small></div>' +
          '<div class="sm-meta"><span><b>' + cnt(k.pax) + '</b> people</span><span><b>' + cnt(k.rfps) + '</b> RFPs in</span><span><b>' + cnt(markets.length) + '</b> market' + (markets.length === 1 ? '' : 's') + '</span>' +
          '<span class="sm-dots"><i></i><i></i></span></div></div>' +
        '<div class="sm-bar"><div class="sm-row"><span>Won, of those decided</span><span class="sp"></span><b>' + pc(k.conversion) + '</b><em>&nbsp;· ' + won + ' of ' + decided + '</em></div><div class="sm-track"><i data-w="' + (k.conversion || 0).toFixed(1) + '"></i></div></div>' +
        '<div class="sm-pair">' + (money ?
          mini('Money in', big(k.received), spark(d.months.map(m => m.sold), '#00A66E')) + mini('Owed to JOR', big(d.cash.owed), spark(d.cash.dueIn.map(x => x.value), d.cash.overdue ? '#B3261E' : '#E2A400'), true) :
          mini('Quoted, waiting', num(k.pipeline.groups), spark(d.months.map(m => m.quoted), '#E2A400')) + mini('Lost', num(k.lost), spark(d.months.map(m => m.groups), '#00A66E'), true)) + '</div>' +
        (money ? '' : '<p class="sm-note">' + I('euro', 'sm') + 'Money in and what is owed show here once JORIS has amounts.</p>') +
        '<div class="sm-list"><div class="sm-hd"><h3>Coming in the next 60 days</h3><button class="lnk" data-v="full">View all</button></div>' +
          (soon.length ? soon.map(x => {
            const ready = x.done === x.of, late = !ready && x.days <= 14;
            return '<a class="sm-it" href="../register/#ref=' + encodeURIComponent(x.ref) + '"><span class="ic">' + esc(x.arrival.slice(8, 10)) + '<em>' + MON[+x.arrival.slice(5, 7) - 1] + '</em></span>' +
              '<span class="tx"><b>' + esc(x.ref) + ' ' + esc(x.agent) + '</b><small>' + (x.days === 0 ? 'arrives today' : 'in ' + plural(x.days, 'day')) + (x.pax ? ' · ' + x.pax + ' pax' : '') + '</small></span>' +
              '<span class="pill ' + (ready ? 'ok' : late ? 'err' : 'warn') + '">' + x.done + ' / ' + x.of + ' ready</span><span class="chev">›</span></a>';
          }).join('') : '<p class="mini">No groups arriving in the next 60 days.</p>') + '</div></div>' +
      '<div class="sm-r"><div class="sm-map"><div class="t">Where the work comes from<span>Groups confirmed by market, and an arc home to Ireland</span></div><div class="map" id="map">' + worldMap(markets) + '<div class="tip" id="tip"></div></div></div>' +
        '<div class="sm-people"><div class="sm-hd"><h3>Account managers</h3></div><div class="sm-faces">' +
          (amsTop.length ? amsTop.map((x, i) => '<i class="f' + i + '" title="' + esc(x.name + ': ' + x.won + ' won, ' + x.rfps + ' RFPs, ' + pc(x.conversion) + ' won' + (money ? ', ' + full(x.sold) + ' sold' : '')) + '">' + esc(initials(x.name)) + '<em>' + x.won + ' won</em></i>').join('') : '<p class="mini">No files yet.</p>') + '</div></div>' +
        '<div class="sm-hd" style="border:0;margin-top:30px"><h3>Markets</h3></div><div class="sm-tiles">' +
          (top.length ? top.map((x, i) => '<div class="sm-tile" style="background:' + TILE[i][0] + ';color:' + TILE[i][1] + '"><b>' + (money ? big(x.sold) : plural(x.groups, 'group')) + '</b><small>' + (money ? pc(x.margin) + ' margin' : pc(x.conversion) + ' won') + '</small>' +
            '<span>' + esc(x.name) + '</span></div>').join('') : '<p class="mini">Nothing yet.</p>') + '</div></div></div></div>';
    $('#view').innerHTML = h;
    $('#view').querySelectorAll('[data-v]').forEach(b => b.addEventListener('click', () => setView(b.dataset.v)));
    grow($('#view'));
    wireMap();
  }
  function setView(v) {
    view = v;
    try { localStorage.setItem('jor.finance.view', v); } catch (e) { /* not kept: fine */ }
    if (d) { draw(); window.scrollTo(0, 0); }
  }

  /* ── The world map: every market's RFPs as a shade, its groups as a bubble, an arc home to Ireland ── */
  function worldMap(markets) {
    const W = window.JOR_WORLD;
    if (!W) return '';
    const mk = markets.filter(m => m.key !== 'IE' && W.centroids[m.key]);
    const ie = W.centroids.IE;
    /* Zoomed to the markets there are, so Europe isn't a speck when the work comes from France and America. */
    let x0 = ie[0], x1 = ie[0], y0 = ie[1], y1 = ie[1];
    mk.forEach(m => { const c = W.centroids[m.key]; x0 = Math.min(x0, c[0]); x1 = Math.max(x1, c[0]); y0 = Math.min(y0, c[1]); y1 = Math.max(y1, c[1]); });
    x0 -= 70; x1 += 70; y0 -= 55; y1 += 45;
    let w = Math.max(x1 - x0, 380), h = Math.max(y1 - y0, w / 2.25);
    w = Math.min(W.w, Math.max(w, h * 2.25)); h = Math.min(W.h, h);
    const vx = Math.max(0, Math.min(W.w - w, (x0 + x1) / 2 - w / 2)), vy = Math.max(0, Math.min(W.h - h, (y0 + y1) / 2 - h / 2));
    const u = w / 620;                                   // one screen pixel, near enough, at the map's usual width
    const maxR = Math.max(1, ...mk.map(m => m.rfps)), maxG = Math.max(1, ...mk.map(m => m.groups));
    const by = {};
    mk.forEach(m => { by[m.key] = m; });
    const shade = m => 'fill:#2BC48A;fill-opacity:' + (0.28 + 0.62 * Math.sqrt(m.rfps / maxR)).toFixed(2);
    let s = '<svg viewBox="' + [vx, vy, w, h].map(v => v.toFixed(1)).join(' ') + '" role="img" aria-label="Where ' + ses(d.season) + '’s RFPs come from" style="--sw:' + (0.5 * u).toFixed(2) + '">';
    Object.keys(W.paths).forEach(c => {
      if (c === 'IE') return;
      const m = by[c];
      s += '<path d="' + W.paths[c] + '" class="' + (m ? 'mk' : 'land') + '"' + (m ? ' style="' + shade(m) + '" data-c="' + c + '"' : '') + '></path>';
    });
    if (W.paths.IE) s += '<path d="' + W.paths.IE + '" class="home" data-c="IE"></path>';
    /* Arcs home, the biggest markets drawn first. */
    const order = mk.slice().sort((a, b) => b.groups - a.groups || b.rfps - a.rfps);
    order.forEach((m, i) => {
      const a = W.centroids[m.key], dx = ie[0] - a[0], dy = ie[1] - a[1], dist = Math.hypot(dx, dy);
      if (dist < 6) return;
      const lift = Math.min(0.32 * dist, 140), cx = (a[0] + ie[0]) / 2 + (dy / dist) * lift * (dx > 0 ? 1 : -1) * 0.25, cy = (a[1] + ie[1]) / 2 - lift;
      const len = qlen(a, [cx, cy], ie);
      s += '<path class="arc" d="M' + a[0] + ',' + a[1] + ' Q' + cx.toFixed(1) + ',' + cy.toFixed(1) + ' ' + ie[0] + ',' + ie[1] + '" style="--len:' + len.toFixed(1) +
        ';stroke-width:' + ((0.8 + 2.2 * Math.sqrt(m.groups / maxG)) * u).toFixed(2) + ';animation-delay:' + (0.15 + i * 0.07).toFixed(2) + 's"></path>';
    });
    order.forEach((m, i) => {
      const a = W.centroids[m.key], r = (m.groups ? 3.2 + 11 * Math.sqrt(m.groups / maxG) : 2.6) * u;
      s += '<circle class="bub' + (m.groups ? '' : ' ring') + '" cx="' + a[0] + '" cy="' + a[1] + '" r="' + r.toFixed(2) + '" data-c="' + m.key + '" style="stroke-width:' + (1.1 * u).toFixed(2) + ';animation-delay:' + (0.6 + i * 0.06).toFixed(2) + 's"></circle>';
    });
    order.filter(m => m.groups).slice(0, 3).forEach((m, i) => {
      const a = W.centroids[m.key], r = (3.2 + 11 * Math.sqrt(m.groups / maxG)) * u;
      s += '<text class="lbl" x="' + (a[0] + r + 3 * u).toFixed(1) + '" y="' + (a[1] + 4 * u).toFixed(1) + '" style="font-size:' + (11.5 * u).toFixed(2) + 'px;stroke-width:' + (3 * u).toFixed(2) + ';animation-delay:' + (1.1 + i * 0.1).toFixed(2) + 's">' + esc(m.name) + ' ' + m.groups + '</text>';
    });
    s += '<circle class="pulse" cx="' + ie[0] + '" cy="' + ie[1] + '" r="' + (3.4 * u).toFixed(2) + '" style="stroke-width:' + (1.2 * u).toFixed(2) + '"></circle>' +
      '<circle class="ie" cx="' + ie[0] + '" cy="' + ie[1] + '" r="' + (3.4 * u).toFixed(2) + '" data-c="IE"></circle></svg>';
    return s;
  }
  /* The length of a curve, to draw it in. */
  function qlen(p0, p1, p2) {
    let l = 0, px = p0[0], py = p0[1];
    for (let i = 1; i <= 24; i++) {
      const t = i / 24, x = (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], y = (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1];
      l += Math.hypot(x - px, y - py); px = x; py = y;
    }
    return l + 1;
  }
  function wireMap() {
    const box = $('#map'), tip = $('#tip');
    if (!box || !tip) return;
    const by = {};
    d.markets.forEach(m => { if (m.key) by[m.key] = m; });
    const show = (e, c) => {
      const m = by[c], r = box.getBoundingClientRect();
      if (c === 'IE') tip.innerHTML = '<b>Ireland</b>Where every group is going' + (m ? ' · ' + plural(m.rfps, 'RFP') + ' from Irish clients' : '');
      else if (m) tip.innerHTML = '<b>' + esc(m.name) + '</b>' + plural(m.rfps, 'RFP') + ' · ' + plural(m.groups, 'group') + ' confirmed' + (m.pax ? ' · ' + num(m.pax) + ' people' : '') +
        (m.conversion !== null && m.conversion !== undefined ? '<br>' + pc(m.conversion) + ' won' : '') + (d.hasMoney && m.sold ? ' · ' + big(m.sold) + ' sold' : '');
      else return;
      tip.style.left = Math.max(80, Math.min(r.width - 80, e.clientX - r.left)) + 'px';
      tip.style.top = (e.clientY - r.top) + 'px';
      tip.classList.add('on');
    };
    box.addEventListener('pointermove', e => { const t = e.target.closest('[data-c]'); if (t) show(e, t.dataset.c); else tip.classList.remove('on'); });
    box.addEventListener('pointerdown', e => { const t = e.target.closest('[data-c]'); if (t) show(e, t.dataset.c); else tip.classList.remove('on'); });
    box.addEventListener('pointerleave', () => tip.classList.remove('on'));
  }

  /* Numbers count up and bars grow as the page opens; straight to the figures for anyone who asks for less motion. */
  function grow(root) {
    root.querySelectorAll('[data-n]').forEach(el => {
      const to = +el.dataset.n, f = el.dataset.f;
      const put = v => { el.textContent = f === 'pct' ? pc(v) : f === 'eur' ? big(v) : num(Math.round(v)); };
      if (still || !isFinite(to) || !to) { put(to); return; }
      const t0 = performance.now(), dur = 1100;
      put(0);
      const step = t => { const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); put(to * e); if (p < 1) requestAnimationFrame(step); else put(to); };
      requestAnimationFrame(step);
    });
    const set = () => {
      root.querySelectorAll('[data-w]').forEach(el => { el.style.width = el.dataset.w + '%'; });
      root.querySelectorAll('[data-h]').forEach(el => { el.style.height = el.dataset.h + '%'; });
    };
    if (still) set(); else requestAnimationFrame(() => requestAnimationFrame(set));
  }
  window.addEventListener('beforeprint', () => { const v = $('#view'); v.querySelectorAll('[data-n]').forEach(el => { const f = el.dataset.f, n = +el.dataset.n; el.textContent = f === 'pct' ? pc(n) : f === 'eur' ? big(n) : num(n); }); });

  function whyLabel(x) { return x.code ? x.code + (x.label ? ' · ' + x.label : '') : x.label; }
  function whyHtml(x) { return x.code ? '<b>' + esc(x.code) + '</b> ' + (x.label ? esc(x.label) : '<em>meaning not set</em>') : esc(x.label); }
  function kpi(label, value, sub, colour) { return '<div class="kpi" style="--k:' + colour + '"><div class="l">' + esc(label) + '</div><div class="v">' + value + '</div><div class="s">' + sub + '</div></div>'; }
  function card(icon, title, why, body) { return '<div class="fcard"><h3>' + I(icon, 'sm') + esc(title) + '</h3>' + (why ? '<p class="why">' + esc(why) + '</p>' : '') + body + '</div>'; }
  function mins(m) { return m < 60 ? Math.round(m) + ' min' : (m / 60).toFixed(m < 600 ? 1 : 0) + ' h'; }

  $('#seasons').addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (!b || b.dataset.s === season) return; season = b.dataset.s; load(); });
  $('#print').addEventListener('click', () => window.print());
  $('#views').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b && b.dataset.v !== view) setView(b.dataset.v); });
  window.addEventListener('hashchange', () => { const s = new URLSearchParams(location.hash.slice(1)).get('season'); if (s && s !== season) { season = s; load(); } });
  load();
})();
