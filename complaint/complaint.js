/* ═══════════════════════════════════════════════════════════════════════
   The complaint form — open to anyone, no login
   Reached from a QR code: the group's own (?ref=27/1274) fills in the
   reference, the general one asks for it. English or French, by the
   phone's language or the switch. It only sends: nothing JOR holds is
   ever shown here.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  /* JORIS never opens inside another site's page: a frame is how a click gets borrowed. */
  if (window.top !== window.self) { document.documentElement.style.display = 'none'; throw new Error('JORIS does not open inside another page.'); }
  const $ = s => document.querySelector(s);
  const SERVER = (window.JOR_CONFIG || {}).server || '';
  const qs = new URLSearchParams(location.search);
  const refRaw = String(qs.get('ref') || '').trim();
  const ref = /^\d{2}\s*[\/\- ]?\s*\d{3,5}$/.test(refRaw) ? refRaw.replace(/^(\d{2})\s*[\/\- ]?\s*(\d{3,5})$/, '$1/$2') : '';
  const T = {
    en: {
      title: 'Something not right? Tell us.', lead: 'We’re sorry something wasn’t as it should be. Tell us here and the JOR Ireland team will look into it and put it right.',
      now: 'Something to fix right now, on tour? Tell your guide straight away — this form goes to the office.', who: 'You are…',
      traveller: 'A traveller in the group', guide: 'The guide or tour leader', agent: 'The travel agent', other: 'Someone else',
      ref: 'Your group’s reference, if you have it', group: 'Your group or tour', when: 'When did it happen?', where: 'Where?', whereph: 'Hotel, restaurant, coach…',
      what: 'What happened?', whatph: 'Tell us in your own words', wish: 'What would you like us to do? (if you’d like to say)', name: 'Your name',
      contact: 'Email or phone, so we can reply', send: 'Send to JOR Ireland', sending: 'Sending…', group1: 'Group',
      privacy: 'What you write is read only by the JOR Ireland team, to put things right. Leave your email or phone if you’d like a reply.',
      need: 'Tell us what happened, please.', thanks: 'Thank you for telling us.', yournum: 'Your complaint number is',
      reply: 'Someone from JOR Ireland will be in touch within one working day.', noreply: 'Keep the number if you’d like to follow it up with us.',
      another: 'Send another'
    },
    fr: {
      title: 'Un souci ? Dites-le-nous.', lead: 'Nous sommes désolés que quelque chose n’ait pas été comme il se doit. Dites-le-nous ici : l’équipe de JOR Ireland s’en occupe et fait le nécessaire.',
      now: 'Un problème à régler tout de suite pendant le circuit ? Prévenez votre guide sans attendre — ce formulaire arrive au bureau.', who: 'Vous êtes…',
      traveller: 'Un voyageur du groupe', guide: 'Le guide ou l’accompagnateur', agent: 'L’agence de voyages', other: 'Autre',
      ref: 'La référence de votre groupe, si vous l’avez', group: 'Votre groupe ou circuit', when: 'Quand cela s’est-il passé ?', where: 'Où ?', whereph: 'Hôtel, restaurant, autocar…',
      what: 'Que s’est-il passé ?', whatph: 'Racontez-nous avec vos mots', wish: 'Que souhaitez-vous que nous fassions ? (facultatif)', name: 'Votre nom',
      contact: 'E-mail ou téléphone, pour vous répondre', send: 'Envoyer à JOR Ireland', sending: 'Envoi…', group1: 'Groupe',
      privacy: 'Ce que vous écrivez n’est lu que par l’équipe de JOR Ireland, pour régler le problème. Laissez votre e-mail ou téléphone si vous souhaitez une réponse.',
      need: 'Dites-nous ce qui s’est passé, s’il vous plaît.', thanks: 'Merci de nous l’avoir signalé.', yournum: 'Votre numéro de réclamation est',
      reply: 'Quelqu’un de JOR Ireland vous recontacte sous un jour ouvré.', noreply: 'Gardez ce numéro si vous souhaitez en reparler avec nous.',
      another: 'Envoyer un autre message'
    }
  };
  let lang = qs.get('lang') === 'fr' || qs.get('lang') === 'en' ? qs.get('lang') : /^fr/i.test(navigator.language || '') ? 'fr' : 'en';
  try { const s = sessionStorage.getItem('jor.complaint.lang'); if (s === 'fr' || s === 'en') lang = s; } catch (e) { /* private mode */ }
  const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const today = (d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'))(new Date());

  document.querySelectorAll('img[data-logo]').forEach(i => { if (window.JOR_MARKS) i.src = window.JOR_MARKS.logo; });
  $('[name=travelDate]').value = today;
  $('[name=travelDate]').max = today;
  if (ref) { $('#grp').classList.remove('hidden'); } else $('#refbox').classList.remove('hidden');

  function paint() {
    const t = T[lang];
    document.documentElement.lang = lang === 'fr' ? 'fr' : 'en-IE';
    document.querySelectorAll('[data-t]').forEach(e => { e.textContent = t[e.dataset.t]; });
    document.querySelectorAll('[data-ph]').forEach(e => { e.placeholder = t[e.dataset.ph]; });
    document.querySelectorAll('[data-lang]').forEach(b => b.classList.toggle('on', b.dataset.lang === lang));
    const picked = (document.querySelector('[name=role]:checked') || {}).value || 'traveller';
    $('#who').innerHTML = ['traveller', 'guide', 'agent', 'other'].map(k => '<label><input type="radio" name="role" value="' + k + '"' + (k === picked ? ' checked' : '') + '>' + esc(t[k]) + '</label>').join('');
    if (ref) $('#grp').textContent = t.group1 + ' ' + ref;
    document.title = 'JOR Ireland — ' + t.title;
  }
  document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => {
    lang = b.dataset.lang;
    try { sessionStorage.setItem('jor.complaint.lang', lang); } catch (e) { /* private mode */ }
    paint();
  }));
  paint();

  $('#form').addEventListener('submit', async e => {
    e.preventDefault();
    const t = T[lang], v = n => (document.querySelector('[name=' + n + ']') || {}).value || '';
    if (v('what').trim().length < 5) { $('#err').textContent = t.need; $('[name=what]').focus(); return; }
    $('#send').disabled = true; $('#send').textContent = t.sending; $('#err').textContent = '';
    try {
      if (!SERVER) throw new Error('This copy has no server link yet.');
      const res = await fetch(SERVER, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ a: 'complaint.send', ref: ref || v('ref'), qr: !!ref, groupName: v('groupName'), travelDate: v('travelDate'), where: v('where'), what: v('what'),
          wish: v('wish'), name: v('name'), contact: v('contact'), role: (document.querySelector('[name=role]:checked') || {}).value || 'other', lang: lang, website: v('website') }) });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || 'Something went wrong');
      $('#card').innerHTML = '<div class="done"><div class="tick">✓</div><h1>' + esc(t.thanks) + '</h1><p class="lead" style="margin:0">' + esc(t.yournum) + '</p>' +
        '<div class="num" id="num">' + esc(j.num) + '</div><p class="lead">' + esc(v('contact').trim() ? t.reply : t.noreply) + '</p>' +
        '<button class="btn" id="again">' + esc(t.another) + '</button></div>';
      $('#again').addEventListener('click', () => location.reload());
    } catch (err) {
      $('#err').textContent = /Failed to fetch|NetworkError|Load failed/.test(err.message) ? (lang === 'fr' ? 'Pas de connexion pour l’instant. Réessayez dans un moment.' : 'No connection just now. Try again in a moment.') : err.message;
      $('#send').disabled = false; $('#send').textContent = t.send;
    }
  });
})();
