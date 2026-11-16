/* ═══════════════════════════════════════════════════════════════════════
   JORIS — the rules
   Roles, who may do what, the statuses a file moves through, the checklist
   and how a reference is written. The server enforces these on every
   request; the pages read the same file only to hide what a person can't
   use. One copy, so the two can never disagree.
   ═══════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const ROLES = {
    management: 'Management',
    account: 'Account manager',
    reservations: 'Reservations',
    accounts: 'Accounts',
    operations: 'Operations',
    marketing: 'Marketing'
  };

  /* Who may do what. 1 = on any file; 'own' = only on files where they are
     the account manager, or of someone they are covering for; 'admin' =
     people marked as an admin ({ management: 'admin' }: only management who
     are admins).
     Money is need-to-know, so nobody but management sees the whole picture:
     account managers see their own files' money and costings, reservations
     the supplier side only, accounts the invoices and bills they handle,
     operations none of it. */
  const PERMS = {
    'register.view':      { management: 1, account: 1, reservations: 1, accounts: 1, operations: 1, marketing: 1 },
    'register.create':    { management: 1, account: 1, reservations: 1 },
    'register.edit':      { management: 1, reservations: 1, account: 'own' },
    'register.assign':    { management: 1 },
    'register.status':    { management: 1, account: 'own' },
    /* Marketing tick only "Contact on HubSpot" (Iain, 14 Oct: Giovanna, as the request comes in);
       operations only the operations list — coach, guide, lunches and visits (the OPS file's columns). */
    'register.checklist': { management: 1, reservations: 1, account: 'own', marketing: 1, operations: 1 },
    'register.note':      { management: 1, account: 1, reservations: 1, accounts: 1, operations: 1, marketing: 1 },
    'register.dashboard': { management: 1 },
    'audit.view':         { management: 1 },
    'people.manage':      'admin',
    'numbers.manage':     'admin',
    /* Reservations: the accommodation request, the pink sheet, cancellations. */
    'res.view':           { management: 1, account: 1, reservations: 1, operations: 1 },
    'res.request':        { management: 1, reservations: 1, account: 'own' },
    'res.book':           { management: 1, reservations: 1, account: 'selfbook' },
    'res.progress':       { management: 1, reservations: 1 },
    'res.exposure':       { management: 1, reservations: 1 },
    /* Money: invoices raised by account managers, payments checked by accounts. */
    'money.view':         { management: 1, account: 'own', accounts: 1 },
    'money.raise':        { management: 1, account: 'own' },
    'money.receive':      { management: 1, accounts: 1 },
    'money.bills':        { management: 1, accounts: 1, account: 'own' },
    'money.check':        { management: 1, account: 'own' },
    /* Costing, rates and suppliers. */
    'costing.view':       { management: 1, account: 'own' },
    'costing.edit':       { management: 1, account: 'own' },
    'rates.view':         { management: 1, account: 1, reservations: 1, operations: 1, accounts: 1 },
    'rates.edit':         { management: 1, reservations: 1 },
    /* A flagged price — a costing's margin, a line off the rate card, a bill over what was booked — goes out only once management OK it. */
    'price.ok':           { management: 1 },
    /* What was removed, kept so it can be put back. */
    'bin.view':           { management: 1 },
    /* Agents and their contacts (JOR's own database instead of HubSpot). */
    'agents.view':        { management: 1, account: 1, reservations: 1, accounts: 1, operations: 1, marketing: 1 },
    'agents.edit':        { management: 1, account: 1, reservations: 1, marketing: 1 },
    'contacts.export':    { management: 1, marketing: 1 },
    /* Complaints: whoever works with groups sees them (an account manager, those on their own
       files); management, operations and the file's account manager deal with them. */
    /* The final payment's amount on the steps: the reservations team send that invoice (Maude, 21 Oct). */
    'money.final':        { management: 1, account: 'own', accounts: 1, reservations: 1 },
    /* The green sheet — the Services Reservation Sheet: lunches and visits, booked by reservations. */
    'services.edit':      { management: 1, reservations: 1, operations: 1, account: 'own' },
    'complaints.view':    { management: 1, operations: 1, reservations: 1, account: 'own' },
    'complaints.log':     { management: 1, operations: 1, reservations: 1, account: 1 },
    'complaints.manage':  { management: 1, operations: 1, account: 'own' },
    /* The guide file, office side. */
    'guide.office':       { management: 1, operations: 1, account: 'own' },
    /* Everyone's own list of things to do; management can see anyone's and set cover. */
    'todo.others':        { management: 1 },
    'tasks.give':         { management: 1, account: 1, reservations: 1, accounts: 1, operations: 1, marketing: 1 },
    'settings.manage':    'admin',
    'import.run':         'admin',
    /* JOR's own history — the RFP window and the OPS file — brought in once. */
    'history.import':     'admin',
    /* Everything out as one workbook — every figure in the business: an owner only. */
    'export.all':         'owner',
    /* The finance and KPI dashboard: only management an owner has ticked to see it. */
    'finance.view':       { management: 'finance' }
  };

  /* May this person do this, on this file? */
  function can(person, perm, file) {
    if (!person || person.status !== 'active') return false;
    const rule = PERMS[perm];
    if (!rule) return false;
    if (rule === 'admin') return person.admin === 'yes';
    if (rule === 'owner') return person.owner === 'yes';
    const v = rule[person.role];
    if (v === 1) return true;
    if (v === 'admin') return person.admin === 'yes';
    if (v === 'finance') return person.finance === 'yes';
    /* Theirs: they are its account manager, or are covering for the one who is. */
    const mine = f => f.am === person.id || (!!f.am && (person.covers || []).indexOf(f.am) >= 0);
    if (v === 'own') return !file || mine(file);
    /* Odysseys and the like: the account manager books the hotels themselves,
       on their own files, for an agent marked as booking that way. */
    if (v === 'selfbook') return !file || (mine(file) && !!file.selfBook);
    return false;
  }

  /* The way a file goes. Each status lists where it may go next. */
  const STATUS = {
    enquiry:   { t: 'Enquiry',   next: ['quoted', 'lost'] },
    quoted:    { t: 'Quoted',    next: ['confirmed', 'lost', 'enquiry'] },
    confirmed: { t: 'Confirmed', next: ['closed', 'cancelled'] },
    lost:      { t: 'Lost',      next: ['enquiry'] },
    cancelled: { t: 'Cancelled', next: ['confirmed'] },
    closed:    { t: 'Closed',    next: ['confirmed'] }
  };
  const OPEN = { enquiry: 1, quoted: 1 };          // still being worked on, before a yes
  const LIVE = { enquiry: 1, quoted: 1, confirmed: 1 };

  /* Ticked on each file, with who and when. The operations list is the OPS
     file's columns (coach, guide, accommodation, lunches and visits, rooming
     list, guide file), each due so many days before the group arrives;
     coach and guide carry the company's or the guide's name. */
  /* Before a file is confirmed: the register's own checklist. */
  const OFFICE = [
    { k: 'tourplan', t: 'Entered on Tourplan' },
    { k: 'hubspot', t: 'Contact on HubSpot', marketing: true },
    { k: 'folder', t: 'File folder made' },
    { k: 'call', t: 'Client called', newOnly: true }
  ];
  /* Once it is confirmed: JOR's own "Steps by steps when a file is confirmed"
     (Maude's sheet, 15 Oct; her answers and new version, 21 Oct) — one
     sequence, 1 to 28, each step the account manager's (am) or the operations
     manager's (om: Sinéad's reservations team), as on its two sheets. A
     notes item (step 2) is written, not ticked; a date item (step 9) is
     filled in from the arrival (`dflt` names the Settings days) and can be
     changed. A sub-item
     (of) hangs under its step; a date item keeps a date (step 9's deadlines);
     a note item asks who (the coach company, the guide). The keys the app
     already used — accom, coach, guide, lv, rooming, contract, itinerary,
     vouchers, guidefile — are those steps now; `ops` marks the six the OPS
     file kept a column for, `days` how long before arrival each should be done. */
  const STEPS = [
    { n: 1, side: 'om', k: 'accom', t: 'Confirm the hotels', ops: true, days: 30 },
    { n: 2, side: 'om', k: 'conditions', t: 'Booking conditions — each hotel, the deadline to release FOC, free places; for golf, each course’s payment and cancellation terms', notes: true },
    { n: 3, side: 'om', k: 'coach', t: 'Coach added', ops: true, days: 30, note: 'Coach company' },
    { n: 3, side: 'om', k: 'guide', t: 'Guide added', ops: true, days: 30, note: 'Guide' },
    { n: 4, side: 'om', k: 'opslive', t: 'On the operation file — live' },
    { n: 5, side: 'am', k: 'contractMade', t: 'Contract prepared' },
    { n: 6, side: 'am', k: 'contract', t: 'Contract sent to the client' },
    { n: 7, side: 'am', k: 'deposit', t: 'Deposit invoice sent + operation file updated' },
    { n: 7, side: 'am', k: 'depositPaid', t: 'Paid', of: 'deposit' },
    { n: 8, side: 'am', k: 'lvTiming', t: 'Lunches and visits timing' },
    { n: 9, side: 'am', k: 'dlDeposit', t: 'Deposit from the client by', date: true, help: 'Each file has its own deposit terms. The Money part’s deposit date follows this.' },
    { n: 9, side: 'am', k: 'dlFinal', t: 'Final payment from the client by', date: true, dflt: 'dlFinalDays' },
    { n: 9, side: 'am', k: 'dlRooming', t: 'Final rooming list from the client by', date: true, dflt: 'dlRoomingDays' },
    { n: 9, side: 'am', k: 'dlItin', t: 'Start the itinerary by', date: true, dflt: 'dlItinDays' },
    { n: 9, side: 'am', k: 'dlGuide', t: 'Start the guide file by', date: true, dflt: 'dlGuideDays' },
    { n: 10, side: 'om', k: 'lv', t: 'Lunches and visits booked + operation file updated', ops: true, days: 30 },
    { n: 11, side: 'om', k: 'pcm', t: 'PCM (pre-costed module) — Tourplan SOP 7.0, PCM’s package selling price', help: 'In Tourplan: Bookings and Quotes › PCM Quotes › Insert new PCM — name it reference + agent + PCM, base date the travel date, the agent, the price code; the pax ranges (15 to 40 are set); Itinerary: every service; PCM Details › Markup/Commission: the package selling price in Retail for each pax range; Supplements: the single supplement. Then Groups › the group › Itinerary › PCM Management: find the PCM, pick the pax range, save, check Linked. To check the total: Operations and Accounts › Accounts Summary › To be invoiced.' },
    { n: 11, side: 'om', k: 'pcmA', t: 'a) Coach and guide checked — the guide’s name and the coach company in, or “Any Supplier”', of: 'pcm' },
    { n: 11, side: 'om', k: 'pcmB', t: 'b) Every booking checked — lunches, visits, entertainment, vox sets: right time and date; a change that moves the next visit dealt with; booked ones highlighted on the green sheet', of: 'pcm' },
    { n: 11, side: 'om', k: 'pcmC', t: 'c) Hotel rates match the account manager’s costing', of: 'pcm' },
    { n: 11, side: 'om', k: 'pcmD', t: 'd) The contract price in Markup / Commission', of: 'pcm' },
    { n: 11, side: 'om', k: 'pcmE', t: 'e) PCM put into the booking', of: 'pcm' },
    { n: 12, side: 'om', k: 'rlPrelim', t: 'Preliminary rooming list sent — saved in the account manager’s drive, printed for the file' },
    { n: 13, side: 'om', k: 'figures1', t: 'Figures updated in the operation file + RL ticked yes' },
    { n: 14, side: 'om', k: 'rooming', t: 'Final rooming list sent — saved in the account manager’s drive, printed for the file', ops: true, days: 14 },
    { n: 15, side: 'om', k: 'figures2', t: 'Figures updated in the operation file' },
    { n: 16, side: 'om', k: 'itinDraft', t: 'Itinerary drafted from the programme the account manager sent the client' },
    { n: 16, side: 'om', k: 'itinB', t: 'b) Every address right — hotels, lunches, visits — with the postcode', of: 'itinDraft' },
    { n: 16, side: 'om', k: 'itinC', t: 'c) Phone numbers and contacts match the booking emails', of: 'itinDraft' },
    { n: 16, side: 'om', k: 'itinD', t: 'd) Voucher text in — and anything else needed', of: 'itinDraft' },
    { n: 16, side: 'om', k: 'itinD1', t: '1) Diet restrictions', of: 'itinD' },
    { n: 16, side: 'om', k: 'itinD2', t: '2) Menu for the lunches', of: 'itinD' },
    { n: 16, side: 'om', k: 'itinD3', t: '3) Porterage', of: 'itinD' },
    { n: 16, side: 'om', k: 'itinD4', t: '4) Drinks', of: 'itinD' },
    { n: 16, side: 'om', k: 'itinE', t: 'e) The group’s nationality in the booking', of: 'itinDraft' },
    { n: 16, side: 'om', k: 'itinF', t: 'f) The guide’s name and phone in the booking', of: 'itinDraft' },
    { n: 17, side: 'am', k: 'itinerary', t: 'Itinerary approved' },
    { n: 18, side: 'om', k: 'itinGuide', t: 'Itinerary sent to the guide — the timing works for them, and where to send the file', note: 'The guide’s name and phone' },
    { n: 19, side: 'om', k: 'itinCoach', t: 'Itinerary sent to the coach company — the driver’s name and phone', note: 'The driver’s name and phone' },
    { n: 20, side: 'am', k: 'finalCalc', t: 'Final payment worked out and passed to the operations manager', amount: true },
    { n: 21, side: 'om', k: 'finalCheck', t: 'Final payment checked against Tourplan; the invoice prepared' },
    { n: 22, side: 'om', k: 'finalSent', t: 'Final invoice sent through Tourplan + operation file updated' },
    { n: 22, side: 'om', k: 'finalPaid', t: 'Paid', of: 'finalSent' },
    { n: 23, side: 'am', k: 'itinClient', t: 'Itinerary sent to the client — asked for the airport logo and the programme sold' },
    { n: 23, side: 'am', k: 'logo', t: 'Airport logo in', of: 'itinClient' },
    { n: 23, side: 'am', k: 'programme', t: 'Programme sold to the client in', of: 'itinClient' },
    { n: 24, side: 'om', k: 'gfPrep', t: 'Guide file prepared' },
    { n: 24, side: 'om', k: 'gfVouchers', t: 'a) Vouchers printed — not the coach, guide, drinks, miscellaneous or the Shannon ferry — and saved in the account manager’s drive', of: 'gfPrep' },
    { n: 24, side: 'om', k: 'gfRooming', t: 'b) Rooming list printed and saved in the account manager’s drive', of: 'gfPrep' },
    { n: 25, side: 'am', k: 'vouchersOk', t: 'Vouchers approved' },
    { n: 26, side: 'om', k: 'vouchers', t: 'Confirmation vouchers sent, and the replies dealt with' },
    { n: 27, side: 'am', k: 'guideNote', t: 'Guide note written; the final documents together for the guide file' },
    { n: 28, side: 'am', k: 'guidefile', t: 'Guide file posted + operation file updated', ops: true, days: 7 }
  ].map(s => Object.assign({ after: 'confirmed' }, s));
  const SIDES = { am: 'Account manager', om: 'Operations manager — the reservations team' };
  /* Step 9's deadlines, days before the group arrives (Maude, 21 Oct: the final payment 35 days out
     80% of the time, the final rooming list asked for 40, the itinerary started 35, the guide file 15). */
  const DEADLINE_DAYS = { dlFinalDays: 35, dlRoomingDays: 40, dlItinDays: 35, dlGuideDays: 15 };
  const CHECKS = OFFICE.concat(STEPS);
  /* Which checklist items a file shows: the call only for new clients, the
     steps only once it is confirmed. */
  function checksFor(f) { return CHECKS.filter(c => (!c.newOnly || f.newClient === 'yes') && (!c.after || f.status === 'confirmed' || f.status === 'closed')); }
  const OPS_CHECKS = CHECKS.filter(c => c.ops);

  /* Where a request came from, as the RFP window has always kept it. */
  const SOURCES = ['Agency', 'Client (direct)', 'Website (HubSpot)', 'Trade show', 'Bernard', 'Iain', 'Email to sales', 'Phone', 'Other'];
  /* The departments: L, G, M, R and P on the RFP window. */
  /* The Dept letters on the RFP window (Iain, 29 Oct): L Leisure, G Golf, R Rugby, P Pilgrimage, ARTI the Active Retired groups. */
  const TYPES = ['Leisure', 'Golf', 'Rugby', 'MICE', 'Pilgrimage', 'ARTI', 'FAM trip', 'Other'];

  /* The two-letter international codes (Iain, 12 Oct), the markets JOR sees most first. */
  const COUNTRIES = [['FR', 'France'], ['US', 'United States'], ['DE', 'Germany'], ['IT', 'Italy'], ['ES', 'Spain'],
    ['CH', 'Switzerland'], ['BE', 'Belgium'], ['NL', 'Netherlands'], ['GB', 'United Kingdom'], ['CA', 'Canada'],
    ['AU', 'Australia'], ['AT', 'Austria'], ['LU', 'Luxembourg'], ['PT', 'Portugal'], ['DK', 'Denmark'], ['SE', 'Sweden'],
    ['NO', 'Norway'], ['FI', 'Finland'], ['PL', 'Poland'], ['CZ', 'Czechia'], ['IE', 'Ireland'], ['BR', 'Brazil'],
    ['MX', 'Mexico'], ['AR', 'Argentina'], ['JP', 'Japan'], ['CN', 'China'], ['IN', 'India'], ['IL', 'Israel'],
    ['ZA', 'South Africa'], ['NZ', 'New Zealand'], ['GR', 'Greece'], ['HU', 'Hungary'], ['RO', 'Romania'], ['BG', 'Bulgaria'], ['RS', 'Serbia'],
    ['SI', 'Slovenia'], ['HR', 'Croatia'], ['SK', 'Slovakia'], ['TR', 'Türkiye'], ['TN', 'Tunisia'], ['MC', 'Monaco'], ['KR', 'South Korea'],
    ['PH', 'Philippines'], ['SG', 'Singapore'], ['AE', 'United Arab Emirates'], ['OM', 'Oman'], ['CL', 'Chile'], ['CO', 'Colombia'], ['IS', 'Iceland']];
  /* Every country, by its code, with its English and French names: the country boxes
     offer only these, so a code can't be mistyped. Generated from the ISO 3166 list. */
  const WORLD = (
    'AD|Andorra|Andorre;AE|United Arab Emirates|Émirats arabes unis;AF|Afghanistan|Afghanistan;AG|Antigua and Barbuda|Antigua-et-Barbuda;' +
    'AI|Anguilla|Anguilla;AL|Albania|Albanie;AM|Armenia|Arménie;AO|Angola|Angola;AQ|Antarctica|Antarctique;AR|Argentina|Argentine;' +
    'AS|American Samoa|Samoa américaines;AT|Austria|Autriche;AU|Australia|Australie;AW|Aruba|Aruba;AX|Åland Islands|Îles Åland;AZ|Azerbaijan|Azerbaïdjan;' +
    'BA|Bosnia and Herzegovina|Bosnie-Herzégovine;BB|Barbados|Barbade;BD|Bangladesh|Bangladesh;BE|Belgium|Belgique;BF|Burkina Faso|Burkina Faso;' +
    'BG|Bulgaria|Bulgarie;BH|Bahrain|Bahreïn;BI|Burundi|Burundi;BJ|Benin|Bénin;BL|St Barthélemy|Saint-Barthélemy;BM|Bermuda|Bermudes;BN|Brunei|Brunei;' +
    'BO|Bolivia|Bolivie;BQ|Caribbean Netherlands|Pays-Bas caribéens;BR|Brazil|Brésil;BS|Bahamas|Bahamas;BT|Bhutan|Bhoutan;BV|Bouvet Island|Île Bouvet;' +
    'BW|Botswana|Botswana;BY|Belarus|Biélorussie;BZ|Belize|Belize;CA|Canada|Canada;CC|Cocos (Keeling) Islands|Îles Cocos;CD|Congo - Kinshasa|Congo-Kinshasa;' +
    'CF|Central African Republic|République centrafricaine;CG|Congo - Brazzaville|Congo-Brazzaville;CH|Switzerland|Suisse;CI|Côte d’Ivoire|Côte d’Ivoire;' +
    'CK|Cook Islands|Îles Cook;CL|Chile|Chili;CM|Cameroon|Cameroun;CN|China|Chine;CO|Colombia|Colombie;CR|Costa Rica|Costa Rica;CU|Cuba|Cuba;' +
    'CV|Cape Verde|Cap-Vert;CW|Curaçao|Curaçao;CX|Christmas Island|Île Christmas;CY|Cyprus|Chypre;CZ|Czechia|Tchéquie;DE|Germany|Allemagne;' +
    'DJ|Djibouti|Djibouti;DK|Denmark|Danemark;DM|Dominica|Dominique;DO|Dominican Republic|République dominicaine;DZ|Algeria|Algérie;EC|Ecuador|Équateur;' +
    'EE|Estonia|Estonie;EG|Egypt|Égypte;EH|Western Sahara|Sahara occidental;ER|Eritrea|Érythrée;ES|Spain|Espagne;ET|Ethiopia|Éthiopie;FI|Finland|Finlande;' +
    'FJ|Fiji|Fidji;FK|Falkland Islands|Îles Malouines;FM|Micronesia|Micronésie;FO|Faroe Islands|Îles Féroé;FR|France|France;GA|Gabon|Gabon;' +
    'GB|United Kingdom|Royaume-Uni;GD|Grenada|Grenade;GE|Georgia|Géorgie;GF|French Guiana|Guyane française;GG|Guernsey|Guernesey;GH|Ghana|Ghana;' +
    'GI|Gibraltar|Gibraltar;GL|Greenland|Groenland;GM|Gambia|Gambie;GN|Guinea|Guinée;GP|Guadeloupe|Guadeloupe;GQ|Equatorial Guinea|Guinée équatoriale;' +
    'GR|Greece|Grèce;GS|South Georgia and South Sandwich Islands|Géorgie du Sud-et-les Îles Sandwich du Sud;GT|Guatemala|Guatemala;GU|Guam|Guam;' +
    'GW|Guinea-Bissau|Guinée-Bissau;GY|Guyana|Guyana;HK|Hong Kong SAR China|R.A.S. chinoise de Hong Kong;' +
    'HM|Heard and McDonald Islands|Îles Heard-et-MacDonald;HN|Honduras|Honduras;HR|Croatia|Croatie;HT|Haiti|Haïti;HU|Hungary|Hongrie;ID|Indonesia|Indonésie;' +
    'IE|Ireland|Irlande;IL|Israel|Israël;IM|Isle of Man|Île de Man;IN|India|Inde;IO|British Indian Ocean Territory|Territoire britannique de l’océan Indien;' +
    'IQ|Iraq|Irak;IR|Iran|Iran;IS|Iceland|Islande;IT|Italy|Italie;JE|Jersey|Jersey;JM|Jamaica|Jamaïque;JO|Jordan|Jordanie;JP|Japan|Japon;KE|Kenya|Kenya;' +
    'KG|Kyrgyzstan|Kirghizstan;KH|Cambodia|Cambodge;KI|Kiribati|Kiribati;KM|Comoros|Comores;KN|St Kitts and Nevis|Saint-Christophe-et-Niévès;' +
    'KP|North Korea|Corée du Nord;KR|South Korea|Corée du Sud;KW|Kuwait|Koweït;KY|Cayman Islands|Îles Caïmans;KZ|Kazakhstan|Kazakhstan;LA|Laos|Laos;' +
    'LB|Lebanon|Liban;LC|St Lucia|Sainte-Lucie;LI|Liechtenstein|Liechtenstein;LK|Sri Lanka|Sri Lanka;LR|Liberia|Liberia;LS|Lesotho|Lesotho;' +
    'LT|Lithuania|Lituanie;LU|Luxembourg|Luxembourg;LV|Latvia|Lettonie;LY|Libya|Libye;MA|Morocco|Maroc;MC|Monaco|Monaco;MD|Moldova|Moldavie;' +
    'ME|Montenegro|Monténégro;MF|St Martin|Saint-Martin;MG|Madagascar|Madagascar;MH|Marshall Islands|Îles Marshall;MK|North Macedonia|Macédoine du Nord;' +
    'ML|Mali|Mali;MM|Myanmar (Burma)|Myanmar (Birmanie);MN|Mongolia|Mongolie;MO|Macao SAR China|R.A.S. chinoise de Macao;' +
    'MP|Northern Mariana Islands|Îles Mariannes du Nord;MQ|Martinique|Martinique;MR|Mauritania|Mauritanie;MS|Montserrat|Montserrat;MT|Malta|Malte;' +
    'MU|Mauritius|Maurice;MV|Maldives|Maldives;MW|Malawi|Malawi;MX|Mexico|Mexique;MY|Malaysia|Malaisie;MZ|Mozambique|Mozambique;NA|Namibia|Namibie;' +
    'NC|New Caledonia|Nouvelle-Calédonie;NE|Niger|Niger;NF|Norfolk Island|Île Norfolk;NG|Nigeria|Nigeria;NI|Nicaragua|Nicaragua;NL|Netherlands|Pays-Bas;' +
    'NO|Norway|Norvège;NP|Nepal|Népal;NR|Nauru|Nauru;NU|Niue|Niue;NZ|New Zealand|Nouvelle-Zélande;OM|Oman|Oman;PA|Panama|Panama;PE|Peru|Pérou;' +
    'PF|French Polynesia|Polynésie française;PG|Papua New Guinea|Papouasie-Nouvelle-Guinée;PH|Philippines|Philippines;PK|Pakistan|Pakistan;' +
    'PL|Poland|Pologne;PM|St Pierre and Miquelon|Saint-Pierre-et-Miquelon;PN|Pitcairn Islands|Îles Pitcairn;PR|Puerto Rico|Porto Rico;' +
    'PS|Palestinian Territories|Territoires palestiniens;PT|Portugal|Portugal;PW|Palau|Palaos;PY|Paraguay|Paraguay;QA|Qatar|Qatar;RE|Réunion|La Réunion;' +
    'RO|Romania|Roumanie;RS|Serbia|Serbie;RU|Russia|Russie;RW|Rwanda|Rwanda;SA|Saudi Arabia|Arabie saoudite;SB|Solomon Islands|Îles Salomon;' +
    'SC|Seychelles|Seychelles;SD|Sudan|Soudan;SE|Sweden|Suède;SG|Singapore|Singapour;SH|St Helena|Sainte-Hélène;SI|Slovenia|Slovénie;' +
    'SJ|Svalbard and Jan Mayen|Svalbard et Jan Mayen;SK|Slovakia|Slovaquie;SL|Sierra Leone|Sierra Leone;SM|San Marino|Saint-Marin;SN|Senegal|Sénégal;' +
    'SO|Somalia|Somalie;SR|Suriname|Suriname;SS|South Sudan|Soudan du Sud;ST|São Tomé and Príncipe|Sao Tomé-et-Principe;SV|El Salvador|Salvador;' +
    'SX|Sint Maarten|Saint-Martin (partie néerlandaise);SY|Syria|Syrie;SZ|Eswatini|Eswatini;TC|Turks and Caicos Islands|Îles Turques-et-Caïques;' +
    'TD|Chad|Tchad;TF|French Southern Territories|Terres australes françaises;TG|Togo|Togo;TH|Thailand|Thaïlande;TJ|Tajikistan|Tadjikistan;' +
    'TK|Tokelau|Tokelau;TL|Timor-Leste|Timor oriental;TM|Turkmenistan|Turkménistan;TN|Tunisia|Tunisie;TO|Tonga|Tonga;TR|Türkiye|Turquie;' +
    'TT|Trinidad and Tobago|Trinité-et-Tobago;TV|Tuvalu|Tuvalu;TW|Taiwan|Taïwan;TZ|Tanzania|Tanzanie;UA|Ukraine|Ukraine;UG|Uganda|Ouganda;' +
    'UK|United Kingdom|Royaume-Uni;UM|US Outlying Islands|Îles mineures éloignées des États-Unis;US|United States|États-Unis;UY|Uruguay|Uruguay;' +
    'UZ|Uzbekistan|Ouzbékistan;VA|Vatican City|État de la Cité du Vatican;VC|St Vincent and the Grenadines|Saint-Vincent-et-les Grenadines;' +
    'VE|Venezuela|Venezuela;VG|British Virgin Islands|Îles Vierges britanniques;VI|US Virgin Islands|Îles Vierges des États-Unis;VN|Vietnam|Viêt Nam;' +
    'VU|Vanuatu|Vanuatu;WF|Wallis and Futuna|Wallis-et-Futuna;WS|Samoa|Samoa;YE|Yemen|Yémen;YT|Mayotte|Mayotte;ZA|South Africa|Afrique du Sud;' +
    'ZM|Zambia|Zambie;ZW|Zimbabwe|Zimbabwe').split(';').map(x => x.split('|'));
  const COUNTRY_NAME = {};
  WORLD.forEach(c => { COUNTRY_NAME[c[0]] = c[1]; });
  /* Other ways people write them — the old sheets' one-letter codes too. */
  const COUNTRY_ALSO = { f: 'FR', d: 'DE', i: 'IT', e: 'ES', b: 'BE', a: 'AT', usa: 'US', us: 'US', america: 'US', unitedstatesofamerica: 'US', uk: 'GB', england: 'GB',
    scotland: 'GB', wales: 'GB', greatbritain: 'GB', britain: 'GB', northernireland: 'GB', holland: 'NL', thenetherlands: 'NL', deutschland: 'DE', allemagne: 'DE',
    frankreich: 'FR', suisse: 'CH', schweiz: 'CH', svizzera: 'CH', belgique: 'BE', belgie: 'BE', espana: 'ES', espagne: 'ES', italia: 'IT', italie: 'IT',
    osterreich: 'AT', autriche: 'AT', eire: 'IE', roi: 'IE', quebec: 'CA', turkey: 'TR', czechrepublic: 'CZ', korea: 'KR', uae: 'AE' };
  const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
  function isCountry(c) { return !!COUNTRY_NAME[String(c || '').toUpperCase()]; }
  function countryName(c) { return COUNTRY_NAME[String(c || '').toUpperCase()] || ''; }
  /* A country however it was written — FR, France, Frankreich, Holland — as its code, or '' */
  function findCountry(v) {
    const raw = String(v || '').trim(), up = raw.toUpperCase(), k = fold(raw);
    if (!k) return '';
    if (/^[A-Z]{2}$/.test(up) && COUNTRY_NAME[up]) return up;
    if (COUNTRY_ALSO[k]) return COUNTRY_ALSO[k];
    const hit = WORLD.filter(c => fold(c[1]) === k || fold(c[2]) === k)[0];
    return hit ? hit[0] : '';
  }
  /* What the green sheet calls the people from JOR's markets. */
  const NATIONALITY = { FR: 'French', US: 'American', DE: 'German', IT: 'Italian', ES: 'Spanish', CH: 'Swiss', BE: 'Belgian', NL: 'Dutch', GB: 'British',
    CA: 'Canadian', AU: 'Australian', AT: 'Austrian', LU: 'Luxembourgish', PT: 'Portuguese', DK: 'Danish', SE: 'Swedish', NO: 'Norwegian', FI: 'Finnish',
    PL: 'Polish', CZ: 'Czech', IE: 'Irish', BR: 'Brazilian', MX: 'Mexican', AR: 'Argentinian', JP: 'Japanese', CN: 'Chinese', IN: 'Indian', IL: 'Israeli',
    ZA: 'South African', NZ: 'New Zealander', GR: 'Greek', HU: 'Hungarian', RO: 'Romanian', BG: 'Bulgarian', RS: 'Serbian', SI: 'Slovenian', HR: 'Croatian',
    SK: 'Slovak', TR: 'Turkish', TN: 'Tunisian', MC: 'Monégasque', KR: 'South Korean', PH: 'Filipino', SG: 'Singaporean', AE: 'Emirati', OM: 'Omani',
    CL: 'Chilean', CO: 'Colombian', IS: 'Icelandic' };
  /* The island's 32 counties, for where a supplier is. */
  const COUNTIES = ['Antrim', 'Armagh', 'Carlow', 'Cavan', 'Clare', 'Cork', 'Derry', 'Donegal', 'Down', 'Dublin', 'Fermanagh', 'Galway', 'Kerry', 'Kildare',
    'Kilkenny', 'Laois', 'Leitrim', 'Limerick', 'Longford', 'Louth', 'Mayo', 'Meath', 'Monaghan', 'Offaly', 'Roscommon', 'Sligo', 'Tipperary', 'Tyrone',
    'Waterford', 'Westmeath', 'Wexford', 'Wicklow'];
  const STARS = [['3', '3★'], ['4', '4★'], ['5', '5★'], ['3-4', '3★ or 4★'], ['4-5', '4★ or 5★']];
  const AGE_BANDS = ['Under 18', '18 – 30', '30 – 50', '50 – 70', '60+', '70+', 'Families', 'Mixed ages'];

  /* A reference: the travel year and a running number. Shown 26/1066; a
     folder or file name uses a space, 26 1066, the way JOR names files. */
  function ref(year, num) { return String(year).padStart(2, '0') + '/' + num; }
  function refName(r) { return String(r || '').replace('/', ' '); }
  function parseRef(s) {
    const m = String(s || '').match(/^\s*(\d{2})\s*[\/\-. ]?\s*(\d{3,5})\s*$/);
    return m ? { year: m[1], num: +m[2], ref: m[1] + '/' + (+m[2]) } : null;
  }

  const FOLLOW_UP_DAYS = 5;        // working days after a proposal (Iain: "5 days is the max")
  const DUPLICATE_DAYS = 60;

  /* The kinds of supplier, and how a rate is charged. */
  const SUPPLIERS = { hotel: 'Hotel', visit: 'Visit or attraction', restaurant: 'Restaurant or lunch', coach: 'Coach company', guide: 'Guide', other: 'Other' };
  const RATE_UNITS = { ppn: 'per person sharing, per night', pp: 'per person', group: 'per group', day: 'per day', room: 'per room, per night' };
  const BASES = ['BB', 'DBB', 'RO', 'FB'];
  /* An accommodation request's way through reservations. */
  const REQUEST = { draft: 'Being written', sent: 'With reservations', open: 'Being worked on', complete: 'Secured', cancelled: 'Cancelled' };
  /* Money on a file. */
  const PAYMENTS = { deposit: 'Deposit', final: 'Final payment', other: 'Other payment' };
  const PAY_STATUS = { due: 'To invoice', raised: 'Invoiced', part: 'Part paid', received: 'Paid', void: 'Not needed' };
  const BILL_STATUS = { tocheck: 'To check', ok: 'Checked', query: 'Query', paid: 'Paid' };

  /* Money as people write it: €1,234.50, the digits grouped. */
  function euro(n, dp) {
    const v = +n || 0;
    return '€' + v.toLocaleString('en-IE', { minimumFractionDigits: dp === undefined ? (v % 1 ? 2 : 0) : dp, maximumFractionDigits: dp === undefined ? 2 : dp });
  }

  root.JOR_RULES = {
    ROLES, PERMS, can, STATUS, OPEN, LIVE, CHECKS, OFFICE, STEPS, SIDES, DEADLINE_DAYS, checksFor, OPS_CHECKS, SOURCES, TYPES, COUNTRIES, WORLD, COUNTRY_ALSO, NATIONALITY, COUNTIES, STARS, AGE_BANDS, isCountry, countryName, findCountry,
    ref, refName, parseRef, FOLLOW_UP_DAYS, DUPLICATE_DAYS,
    SUPPLIERS, RATE_UNITS, BASES, REQUEST, PAYMENTS, PAY_STATUS, BILL_STATUS, euro
  };
})(typeof window !== 'undefined' ? window : globalThis);
