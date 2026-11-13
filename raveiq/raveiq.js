/* RaveIQ web player (aiqmanage.com/raveiq). Derived from the iPhone app's Resources/raveiq.html: same lanes, catalog, queue, failover, stage show. Web engine only. */
'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const FILE = location.protocol === 'file:';
const STORE = true;
const NATIVE = false;   // web player: the HTML5 engine below does the playing
const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const QS = new URLSearchParams(location.search);
const RB = ['https://de1.api.radio-browser.info', 'https://fi1.api.radio-browser.info', 'https://de2.api.radio-browser.info'];

const LANES = [
  {k: 'mainstage', n: 'Mainstage', bpm: 128, d: 'Big room, festival anthems and electro house', col: ['#ff2bd6', '#19e3ff']},
  {k: 'house', n: 'House and dance', bpm: 126, d: 'Club house, Ibiza and dance radio', col: ['#ffb02b', '#ff2bd6']},
  {k: 'trance', n: 'Trance', bpm: 138, d: 'Uplifting, vocal and progressive trance', col: ['#4d7dff', '#b46bff']},
  {k: 'techno', n: 'Techno', bpm: 135, d: 'Driving warehouse techno', col: ['#19e3ff', '#3dffa8']},
  {k: 'psy', n: 'Psytrance', bpm: 145, d: 'Goa and psychedelic trance', col: ['#3dffa8', '#f6ff3d']},
  {k: 'hardstyle', n: 'Hardstyle', bpm: 150, d: 'Hard kicks and euphoric leads', col: ['#ff3d3d', '#ff9a2b']},
  {k: 'dnb', n: 'Drum and bass', bpm: 174, d: 'Fast breaks and heavy bass', col: ['#f6ff3d', '#ff2bd6']},
  {k: 'hardcore', n: 'Hardcore', bpm: 180, d: 'Gabber, frenchcore and happy hardcore', col: ['#ff2b6a', '#8b5cff']},
  {k: 'euro', n: 'Eurodance', bpm: 140, d: 'Hands up and dance classics', col: ['#ff7ad9', '#7ad9ff']},
];
const LANE = Object.fromEntries(LANES.map(l => [l.k, l]));
const CONT = {EU: 'Europe', NA: 'North America', SA: 'South America', AS: 'Asia', OC: 'Oceania', AF: 'Africa'};
const CMAP = {};
Object.entries({
  EU: 'AD AL AT BA BE BG BY CH CY CZ DE DK EE ES FI FR GB GR HR HU IE IS IT LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SK SM UA XK',
  NA: 'US CA MX CR GT PA CU DO PR JM HN SV NI BS TT BB HT BZ',
  SA: 'BR AR CL CO PE UY PY BO EC VE GY SR',
  AS: 'CN JP KR IN ID TH VN MY SG PH HK TW AE SA IL TR LB KG KZ UZ GE AM AZ IR IQ JO QA KW PK BD LK NP BH OM MN KH',
  OC: 'AU NZ NC MH FJ PG PF GU',
  AF: 'ZA NG DZ CM EG MA KE GH TN SN ET TZ UG CI AO MZ MU RE',
}).forEach(([k, v]) => v.split(' ').forEach(c => CMAP[c] = k));
let regionNames = null; try { regionNames = new Intl.DisplayNames(['en'], {type: 'region'}); } catch (e) {}
const cname = c => { try { return (regionNames && regionNames.of(c)) || c; } catch (e) { return c; } };
const cont = c => CMAP[c] || 'EU';

/* ---------- catalog + saved state ---------- */
const SEED = window.__SEED || {as_of: '', stations: []};   // stations.json, loaded by index.html before this script
// A secure page (https) can only load secure streams. Anything else is flagged (s.w) and left out of the automatic queue.
SEED.stations.forEach(s => { if (s.u && !/^https:/i.test(s.u)) s.w = s.w || 'mixed'; });
const canHls = !!document.createElement('audio').canPlayType('application/vnd.apple.mpegurl') || NATIVE;
const store = {
  get(k, d) { try { const v = localStorage.getItem('raveiq.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('raveiq.' + k, JSON.stringify(v)); } catch (e) {} },
};
const S = {
  lane: store.get('lane', 'mainstage'), cont: store.get('cont', ''), ctry: store.get('ctry', ''),
  favs: store.get('favs', []), bans: store.get('bans', []), extra: store.get('extra', []), urlfix: store.get('urlfix', {}), off: store.get('off', []),
  tour: store.get('tour', false), tourMin: store.get('tourMin', 10), sleepMin: 0, q: '', shown: 60,
};
if (QS.get('lane') && LANE[QS.get('lane')]) S.lane = QS.get('lane');
let ALL = [], BY = {};
function rebuild() {
  const off = new Set(S.off);
  ALL = SEED.stations.concat(S.extra).filter(s => s && s.u && (!s.h || canHls) && (!off.has(s.id) || S.favs.includes(s.id)));
  BY = {}; ALL.forEach(s => { if (S.urlfix[s.id]) s.u = S.urlfix[s.id]; BY[s.id] = s; });
}
rebuild();
const isFav = id => S.favs.includes(id), isBan = id => S.bans.includes(id);

/* ---------- filters: every chip count is live against the other active filters ---------- */
function match(s, o) {
  o = o || {};
  const lane = 'lane' in o ? o.lane : S.lane, co = 'cont' in o ? o.cont : S.cont, ct = 'ctry' in o ? o.ctry : S.ctry;
  if (isBan(s.id)) return false;
  if (lane && !s.l.includes(lane)) return false;
  if (ct ? s.c !== ct : (co && cont(s.c) !== co)) return false;
  if (S.q && !(s.n.toLowerCase().includes(S.q) || cname(s.c).toLowerCase().includes(S.q))) return false;
  return true;
}
const filtered = o => ALL.filter(s => match(s, o));
const rank = s => (s.p ? 1e6 : 0) + (s.v || 0);

function renderChips() {
  $('#laneChips').innerHTML = LANES.map(l => { const n = filtered({lane: l.k}).length;
    return `<button class="chip${S.lane === l.k ? ' on' : ''}${n ? '' : ' zero'}" data-lane="${l.k}">${l.n}<i>${n}</i></button>`; }).join('');
  $('#contChips').innerHTML = Object.entries(CONT).map(([k, n]) => { const c = filtered({cont: k, ctry: ''}).length;
    return `<button class="chip${S.cont === k ? ' on' : ''}${c ? '' : ' zero'}" data-cont="${k}">${n}<i>${c}</i></button>`; }).join('');
  const pool = filtered({ctry: ''}), cnt = {};
  pool.forEach(s => cnt[s.c] = (cnt[s.c] || 0) + 1);
  if (S.ctry && !cnt[S.ctry]) cnt[S.ctry] = 0;
  $('#ctryChips').innerHTML = Object.entries(cnt).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c, n]) =>
    `<button class="chip${S.ctry === c ? ' on' : ''}${n ? '' : ' zero'}" data-ctry="${c}">${esc(cname(c))}<i>${n}</i></button>`).join('');
}
function rowHtml(s, opt) {
  const cur = P.st && P.st.id === s.id, ln = s.l.map(k => LANE[k] ? LANE[k].n : k).join(', ');
  return `<div class="st${cur ? ' cur' : ''}${s.w ? ' blocked' : ''}" data-id="${esc(s.id)}"><button class="pl" data-play="${esc(s.id)}" aria-label="Play ${esc(s.n)}"><svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg></button>` +
    `<button class="meta" data-play="${esc(s.id)}"><div class="nm">${esc(s.n)}</div><div class="sub"><span class="cc">${esc(s.c)}</span>${s.p ? '<span class="star">TOP</span>' : ''}${s.w ? '<span class="warn" title="Plain http stream: a secure page cannot load it. Plays in the iPhone app.">Blocked here</span>' : ''}<span>${esc(cname(s.c))} · ${esc(ln)}${s.b ? ' · ' + s.b + 'k' : ''}</span></div></button>` +
    (opt === 'ban' ? `<button class="btn sm" data-unban="${esc(s.id)}">Allow</button>` : opt === 'find' ? `<button class="btn sm" data-add="${esc(s.id)}">${isFav(s.id) ? 'Saved' : 'Save'}</button>` :
      `<button class="hb${isFav(s.id) ? ' on' : ''}" data-fav="${esc(s.id)}" aria-label="Favorite"><svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z"/></svg></button>`) + '</div>';
}
function renderList() {
  const f = filtered().sort((a, b) => rank(b) - rank(a));
  const l = LANE[S.lane], where = S.ctry ? cname(S.ctry) : S.cont ? CONT[S.cont] : 'around the world';
  $('#heroT').textContent = (l ? l.n : 'Everything') + (S.ctry || S.cont ? ' from ' + where : '');
  $('#heroP').textContent = (l ? l.d + '. About ' + l.bpm + ' BPM. ' : '') + f.length + ' live station' + (f.length === 1 ? '' : 's') + ' from ' + new Set(f.map(s => s.c)).size + ' countr' + (new Set(f.map(s => s.c)).size === 1 ? 'y' : 'ies') + '.' + (f.filter(s => s.w).length ? ' ' + f.filter(s => s.w).length + ' marked Blocked here only play in the iPhone app.' : '');
  $('#list').innerHTML = f.length ? f.slice(0, S.shown).map(s => rowHtml(s)).join('') : '<div class="empty">No stations match. Tap a chip again to clear it.</div>';
  $('#bMore').style.display = f.length > S.shown ? '' : 'none';
  $('#bTour').classList.toggle('on', S.tour);
  $('#bTour span').textContent = S.tour ? 'World Tour on, every ' + S.tourMin + ' min' : 'World Tour';
}
function renderSaved() {
  const fv = S.favs.map(id => BY[id]).filter(Boolean), bn = S.bans.map(id => BY[id]).filter(Boolean);
  $('#favList').innerHTML = fv.length ? fv.map(s => rowHtml(s)).join('') : '<div class="empty">Tap the heart on any station to keep it here.</div>';
  $('#banList').innerHTML = bn.length ? bn.map(s => rowHtml(s, 'ban')).join('') : '<div class="empty">Nothing blocked.</div>';
  $('#tourSeg').innerHTML = `<button class="btn sm${S.tour ? '' : ' on'}" data-tour="0">Off</button>` + [5, 10, 15, 30].map(m => `<button class="btn sm${S.tour && S.tourMin === m ? ' on' : ''}" data-tour="${m}">${m} min</button>`).join('');
  $('#sleepSeg').innerHTML = [0, 30, 60, 90, 120].map(m => `<button class="btn sm${S.sleepMin === m ? ' on' : ''}" data-sleep="${m}">${m ? m + ' min' : 'Off'}</button>`).join('');
  $('#asof').textContent = SEED.as_of || ''; $$('.asof2').forEach(e => e.textContent = SEED.as_of || '');
}
function renderAll() { renderChips(); renderList(); renderSaved(); renderBar(); }
function saveFilters() { store.set('lane', S.lane); store.set('cont', S.cont); store.set('ctry', S.ctry); }
let toastT; function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600); }

/* ---------- queue ---------- */
const Q = {list: [], i: 0};
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// Order for non-stop play: featured and well-loved stations first (shuffled inside tiers); with World Tour on, rotate countries.
function buildQueue(pool, first) {
  pool = pool.filter(s => !s.w);   // blocked streams only play when tapped on purpose
  const top = shuffle(pool.filter(s => s.p)), mid = shuffle(pool.filter(s => !s.p && (s.v || 0) >= 20)), low = shuffle(pool.filter(s => !s.p && (s.v || 0) < 20));
  let order = top.concat(mid, low);
  if (S.tour) {
    const by = {}; order.forEach(s => (by[s.c] = by[s.c] || []).push(s));
    const keys = shuffle(Object.keys(by)); order = [];
    for (let r = 0; keys.some(k => by[k][r]); r++) keys.forEach(k => { if (by[k][r]) order.push(by[k][r]); });
  }
  if (first) order = [first].concat(order.filter(s => s.id !== first.id));
  Q.list = order.map(s => s.id); Q.i = 0;
}
function playPool(pool, first) {
  pool = pool.filter(s => !isBan(s.id));
  if (!pool.some(s => !s.w) && !first) { toast(pool.length ? 'Only blocked streams match. They play in the iPhone app.' : 'No stations match'); return; }
  if (first && first.w) toast('This stream is not secure, so a browser may refuse it. It plays in the iPhone app.');
  buildQueue(pool, first); Eng.start();
}

/* ---------- player state shared by both engines ---------- */
const P = {state: 'idle', st: null, title: '', since: 0, seen: new Set()};
function setState(state, st, title) {
  const changed = st && (!P.st || P.st.id !== st.id);
  if (st) P.st = st;
  if (changed) { P.title = ''; store.set('last', st.id); }
  if (title != null) P.title = title;
  if (state === 'playing') { if (!P.since) P.since = Date.now(); if (P.st) P.seen.add(P.st.c); }
  if (state === 'paused' || state === 'idle') { P.since = 0; P.seen.clear(); }
  P.state = state; renderBar(); if (changed) markRows();
}
function markRows() { $$('.st').forEach(r => r.classList.toggle('cur', !!P.st && r.dataset.id === P.st.id)); }
function mainLane(st) { return st ? (st.l.includes(S.lane) ? S.lane : st.l[0]) : S.lane; }
function renderBar() {
  const st = P.st, on = P.state === 'playing';
  document.body.classList.toggle('playing', on);
  const l = LANE[mainLane(st)] || LANES[0];
  document.documentElement.style.setProperty('--beat', (60 / l.bpm).toFixed(3) + 's');
  $('#npName').textContent = st ? st.n : 'Pick a lane and press start';
  const tag = {connecting: 'Tuning in', offline: 'No connection, retrying', paused: 'Paused', idle: ''}[P.state] || '';
  $('#npSub').textContent = st ? [tag, P.title, cname(st.c), l.n].filter(Boolean).join(' · ') : ALL.filter(s => !s.w).length + ' stations from ' + new Set(ALL.filter(s => !s.w).map(s => s.c)).size + ' countries standing by';
  $('#icoPlay').innerHTML = (on || P.state === 'connecting' || P.state === 'offline') ? '<path d="M6 4.5h4.2v15H6zM13.8 4.5H18v15h-4.2z"/>' : '<path d="M7 4.5v15l13-7.5z"/>';
  $('#bFav').classList.toggle('on', !!st && isFav(st.id));
  $('#bStage').classList.toggle('on', stageOn); $('#bStageTop').classList.toggle('on', stageOn);
  $('#sgLane').textContent = st ? l.n + ' · ' + l.bpm + ' BPM' : '';
  $('#sgName').textContent = st ? st.n : 'RaveIQ';
  $('#sgTitle').textContent = st ? (P.title || tag) : 'Press OK to start';
  const mins = P.since ? Math.floor((Date.now() - P.since) / 60000) : 0;
  $('#sgMeta').textContent = st ? cname(st.c) + (P.since ? ' · non-stop ' + (mins >= 60 ? Math.floor(mins / 60) + ' h ' + (mins % 60) + ' min' : mins + ' min') + (P.seen.size > 1 ? ' · ' + P.seen.size + ' countries' : '') : '') : '';
  document.title = st && on ? st.n + ' · RaveIQ' : 'RaveIQ';
  if ('mediaSession' in navigator && !NATIVE) {
    try {
      navigator.mediaSession.metadata = st ? new MediaMetadata({title: P.title || st.n, artist: P.title ? st.n : cname(st.c) + ' · ' + l.n, album: 'RaveIQ'}) : null;
      navigator.mediaSession.playbackState = on ? 'playing' : 'paused';
    } catch (e) {}
  }
}

/* ---------- web engine: two alternating audio slots, watchdog, instant failover ---------- */
const dead = {};
const isDead = id => (dead[id] || 0) > Date.now();
function nextIndex(d) {
  const n = Q.list.length; if (!n) return -1;
  for (let pass = 0; pass < 2; pass++) for (let k = 1; k <= n; k++) {
    const i = ((Q.i + d * k) % n + n) % n, id = Q.list[i];
    if (BY[id] && !isBan(id) && (pass || !isDead(id))) return i;   // second pass ignores the dead marks (everything failed: likely our own connection)
  }
  return -1;
}
// A dead stream may only have moved: ask the directory for its current address and remember it.
function heal(st) {
  if (st.custom || !/^[0-9a-f-]{36}$/.test(st.id)) return;
  fetch(RB[0] + '/json/stations/byuuid/' + st.id).then(r => r.json()).then(a => {
    const u = a && a[0] && a[0].url_resolved;
    if (u && /^https:/.test(u) && u !== st.u) { st.u = u; S.urlfix[st.id] = u; store.set('urlfix', S.urlfix); delete dead[st.id]; }
  }).catch(() => {});
}
const VOL = QS.get('mute') != null ? .001 : 1;   // ?mute = silent test runs (a muted element makes WebKit stop buffering, so stay just above zero)
const LOG = [];   // last playback failures, for diagnosis: RaveIQ.log
const WebEng = (() => {
  const HAS_AN = !IOS && !!(window.AudioContext || window.webkitAudioContext);
  let ctx = null, analyser = null, slots = [], cur = null, pend = null, tok = 0, connT = 0, fails = 0, want = false, lastT = -1, lastAdv = 0, silent = '', retryT = 0;
  function mk(cors) {
    const el = new Audio(); el.preload = 'none'; if (cors) el.crossOrigin = 'anonymous';
    el.addEventListener('playing', () => onPlaying(el));
    el.addEventListener('loadedmetadata', () => { if (!pend || pend.el !== el || el._quiet) return; const my = pend.my; clearTimeout(connT); connT = setTimeout(() => { if (pend && pend.my === my) { el._quiet = false; onFail(el, 'timeout'); } }, 25000); });
    el.addEventListener('error', () => onFail(el, 'error'));
    el.addEventListener('ended', () => onFail(el, 'ended'));
    el.addEventListener('pause', () => { if (cur && cur.el === el && want && !el._quiet && !el.ended) { want = false; setState('paused'); } });
    return el;
  }
  function init() {
    if (slots.length) return;
    slots = [{p: mk(false)}, {p: mk(false)}];
    if (HAS_AN) { slots.forEach(s => s.c = mk(true)); }
    const n = 1600, b = new Uint8Array(44 + n), dv = new DataView(b.buffer), w = (o, s) => { for (let i = 0; i < s.length; i++) b[o + i] = s.charCodeAt(i); };
    w(0, 'RIFF'); dv.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, 8000, true); dv.setUint32(28, 8000, true); dv.setUint16(32, 1, true); dv.setUint16(34, 8, true); w(36, 'data'); dv.setUint32(40, n, true); b.fill(128, 44);
    silent = URL.createObjectURL(new Blob([b], {type: 'audio/wav'}));
    setInterval(watch, 2000);
    window.addEventListener('online', () => { if (want && P.state !== 'playing' && !pend) tuneIndex(Q.i); });
  }
  // Called inside a tap: lets every element start later without a gesture (failover, World Tour hops).
  function unlock(skip) {
    init();
    if (HAS_AN && !ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)(); analyser = ctx.createAnalyser(); analyser.fftSize = 256; analyser.smoothingTimeConstant = .78;
        slots.forEach(s => ctx.createMediaElementSource(s.c).connect(analyser)); analyser.connect(ctx.destination);
      } catch (e) { ctx = null; analyser = null; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    slots.forEach(s => [s.p, s.c].forEach(el => {
      if (!el || el._ok || el === skip || (cur && cur.el === el) || (pend && pend.el === el)) return;
      el._ok = true; el._quiet = true; el.src = silent; const pr = el.play(); if (pr) pr.then(() => { el.pause(); }).catch(() => { el._ok = false; });
    }));
  }
  function stopEl(el) { if (!el) return; el._quiet = true; try { el.pause(); el.removeAttribute('src'); el.load(); } catch (e) {} }
  function tuneIndex(i) {
    const st = BY[Q.list[i]]; if (!st) return; Q.i = i;
    init(); tok++; const my = tok; clearTimeout(retryT);
    if (pend) { stopEl(pend.el); pend = null; }
    const si = cur ? 1 - cur.si : 0, useC = !!(ctx && analyser && st.x && !st.h && !st._nocors), el = useC ? slots[si].c : slots[si].p;
    pend = {el, si, st, my, cors: useC}; want = true;
    setState(cur ? P.state === 'playing' ? 'playing' : 'connecting' : 'connecting', cur ? null : st);
    if (cur) { $('#npSub').textContent = 'Tuning in ' + st.n; }
    if (el._fade) { clearInterval(el._fade); el._fade = 0; }   // a fade still running from the last change must not stop the station we are about to tune
    el._quiet = false; el._ok = true; el.volume = VOL; el.src = st.u;
    const pr = el.play();
    if (pr) pr.catch(e => { if (!pend || pend.my !== my) return;
      if (e && e.name === 'NotAllowedError') { stopEl(el); pend = null; want = false; clearTimeout(connT); setState('paused', st); if (stageOn) $('#gate').classList.add('on'); }
      else if (!e || e.name !== 'AbortError') onFail(el, 'play'); });
    clearTimeout(connT); connT = setTimeout(() => { if (pend && pend.my === my) { el._quiet = false; onFail(el, 'timeout'); } }, 10000);
  }
  function onPlaying(el) {
    if (el._quiet) return;
    if (pend && pend.el === el) {
      const old = cur; cur = pend; pend = null; clearTimeout(connT); fails = 0; lastT = -1; lastAdv = Date.now();
      if (old && old.el !== el) fadeOut(old.el);
      setState('playing', cur.st); ping(cur.st); pollTitle(true);
    } else if (cur && cur.el === el) { lastAdv = Date.now(); if (want) setState('playing'); }
  }
  function fadeOut(el) {
    if (IOS) { stopEl(el); return; }
    clearInterval(el._fade); let v = 1;
    const t = el._fade = setInterval(() => {
      if (el._fade !== t) { clearInterval(t); return; }
      v -= .14; if (v <= 0) { clearInterval(t); el._fade = 0; stopEl(el); el.volume = VOL; } else { try { el.volume = v * VOL; } catch (e) {} }
    }, 60);
  }
  function onFail(el, why) {
    if (el._quiet) return;
    const isP = pend && pend.el === el, isC = cur && cur.el === el;
    if (!isP && !isC) return;
    const slot = isP ? pend : cur, st = slot.st;
    LOG.push([Date.now(), why, st.n, isP ? 'pending' : 'current', (el.error && el.error.code) || 0]); if (LOG.length > 60) LOG.shift();
    if (slot.cors && why !== 'timeout' && !st._nocors) {           // analyser path refused: play it the plain way instead
      st._nocors = true; stopEl(el); if (isP) pend = null; else cur = null; tuneIndex(Q.i); return;
    }
    dead[st.id] = Date.now() + 10 * 60e3; heal(st); fails++;
    stopEl(el); clearTimeout(connT);
    if (isP) pend = null; else cur = null;
    if (!want) return;
    if (fails >= 6 || !navigator.onLine) {                       // probably our own connection: hold on and keep retrying
      fails = 0; if (!cur) setState('offline', st);
      clearTimeout(retryT); retryT = setTimeout(() => { if (want && !pend) step(1, true); }, 6000); return;
    }
    step(1, true);
  }
  function watch() {
    if (!cur || !want || cur.el._quiet) return;
    const t = cur.el.currentTime;
    if (t !== lastT) { lastT = t; lastAdv = Date.now(); return; }
    if (Date.now() - lastAdv > 11000 && !pend) onFail(cur.el, 'stall');
  }
  function step(d, auto) {
    const i = nextIndex(d); if (i < 0) { if (!auto) toast('Nothing else to play here'); return; }
    if (!auto) fails = 0; tuneIndex(i);
  }
  function pause() { want = false; clearTimeout(connT); clearTimeout(retryT); if (pend) { stopEl(pend.el); pend = null; } if (cur) { stopEl(cur.el); cur = null; } setState('paused'); }
  return {
    start() { unlock(); tuneIndex(Q.i); unlock(pend && pend.el); }, pause,
    resume() { if (!Q.list.length) return false; unlock(); tuneIndex(Q.i); return true; },
    step(d) { unlock(); step(d, false); }, auto(d) { step(d, true); },
    opts() {}, level() { if (!analyser || !cur || !cur.cors || P.state !== 'playing') return null; const a = new Uint8Array(analyser.frequencyBinCount); analyser.getByteFrequencyData(a); return a; },
    active: () => want,
  };
})();

const Eng = WebEng;

function ping(st) { if (!st.custom && /^[0-9a-f-]{36}$/.test(st.id)) fetch(RB[0] + '/json/url/' + st.id).catch(() => {}); }   // directory etiquette: count the listen
function pollTitle() {}

/* ---------- World Tour + sleep timer ---------- */
let tourT = 0, sleepT = 0, sleepAt = 0;
const sleepLeft = () => sleepAt ? Math.max(1, Math.round((sleepAt - Date.now()) / 1000)) : 0;
function armTour() {
  clearInterval(tourT);
  if (S.tour && !NATIVE) tourT = setInterval(() => { if (Eng.active() && P.state === 'playing') Eng.auto(1); }, S.tourMin * 60e3);
  Eng.opts();
}
function setTour(min) {
  S.tour = min > 0; if (min > 0) S.tourMin = min; store.set('tour', S.tour); store.set('tourMin', S.tourMin);
  if (S.tour && Q.list.length && P.st) { const pool = Q.list.map(id => BY[id]).filter(Boolean); buildQueue(pool, P.st); if (NATIVE && Eng.active()) Eng.start(); }
  armTour(); renderList(); renderSaved();
  toast(S.tour ? 'World Tour on. A new country every ' + S.tourMin + ' minutes.' : 'World Tour off');
}
function setSleep(min) {
  S.sleepMin = min; clearTimeout(sleepT); sleepAt = min ? Date.now() + min * 60e3 : 0;
  if (min && !NATIVE) sleepT = setTimeout(() => { Eng.pause(); S.sleepMin = 0; sleepAt = 0; renderSaved(); }, min * 60e3);
  Eng.opts(); renderSaved(); toast(min ? 'Music stops in ' + min + ' minutes' : 'Sleep timer off');
}

/* ---------- actions ---------- */
function startLane() { playPool(filtered()); }
function playId(id) {
  const st = BY[id]; if (!st) return;
  if (P.st && P.st.id === id && Eng.active()) { Eng.pause(); return; }
  let pool = filtered(); if (!pool.some(s => s.id === id)) pool = ALL.filter(s => s.l.some(k => st.l.includes(k)));
  playPool(pool, st);
}
function togglePlay() {
  if (Eng.active()) { Eng.pause(); return; }
  if (!(Q.list.length && Eng.resume())) { const last = BY[store.get('last', '')]; if (last && match(last)) playPool(filtered(), last); else startLane(); }
}
function toggleFav(id) {
  if (!BY[id]) return; const i = S.favs.indexOf(id);
  if (i >= 0) S.favs.splice(i, 1); else S.favs.unshift(id);
  store.set('favs', S.favs); renderList(); renderSaved(); renderBar(); markRows();
}
function ban(id) {
  const st = BY[id]; if (!st) return;
  if (!isBan(id)) S.bans.unshift(id); store.set('bans', S.bans);
  toast(st.n + ' will not play again'); if (P.st && P.st.id === id && Eng.active()) Eng.step(1);
  renderAll();
}
function cycleLane(d) {
  const ks = LANES.map(l => l.k).filter(k => filtered({lane: k}).length); if (!ks.length) return;
  const i = ks.indexOf(S.lane); S.lane = ks[((i < 0 ? 0 : i + d) % ks.length + ks.length) % ks.length]; S.shown = 60; saveFilters(); renderAll(); startLane();
  toast((LANE[S.lane] || {}).n || '');
}
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
  if (d.t) { $$('#tabs button').forEach(x => x.classList.toggle('on', x === b)); $$('main section').forEach(s => s.classList.toggle('on', s.id === 't-' + d.t)); window.scrollTo(0, 0); if (d.t === 'sets' && !setsLoaded) searchSets(SETQ[0]); }
  else if (d.lane) { S.lane = S.lane === d.lane ? '' : d.lane; S.shown = 60; saveFilters(); renderChips(); renderList(); }
  else if (d.cont) { S.cont = S.cont === d.cont ? '' : d.cont; S.ctry = ''; S.shown = 60; saveFilters(); renderChips(); renderList(); }
  else if (d.ctry) { S.ctry = S.ctry === d.ctry ? '' : d.ctry; S.shown = 60; saveFilters(); renderChips(); renderList(); }
  else if (d.play) playId(d.play);
  else if (d.fav) toggleFav(d.fav);
  else if (d.unban) { S.bans = S.bans.filter(x => x !== d.unban); store.set('bans', S.bans); renderAll(); }
  else if (d.add) { addFound(d.add); }
  else if (d.tour != null) setTour(+d.tour);
  else if (d.sleep != null) setSleep(+d.sleep);
  else if (d.setq) { $('#sq').value = d.setq; searchSets(d.setq); }
  else if (d.tv) playOnTv(d.tv);
  else if (d.dj) { $('#dq').value = d.dj; askDj(); }
});
$('#bStart').onclick = startLane; $('#bPlay').onclick = togglePlay; $('#bNext').onclick = () => Eng.step(1); $('#bPrev').onclick = () => Eng.step(-1);
$('#bFav').onclick = () => P.st && toggleFav(P.st.id); $('#bBan').onclick = () => P.st && ban(P.st.id);
$('#bTour').onclick = () => setTour(S.tour ? 0 : S.tourMin); $('#bMore').onclick = () => { S.shown += 120; renderList(); };
$('#q').oninput = e => { S.q = e.target.value.trim().toLowerCase(); S.shown = 60; renderChips(); renderList(); };
if ('mediaSession' in navigator && !NATIVE) {
  const h = (a, f) => { try { navigator.mediaSession.setActionHandler(a, f); } catch (e) {} };
  h('play', () => { if (!Eng.active()) togglePlay(); }); h('pause', () => Eng.pause()); h('stop', () => Eng.pause());
  h('nexttrack', () => Eng.step(1)); h('previoustrack', () => Eng.step(-1));
}

/* ---------- stage mode: full-screen light show for the TV ---------- */
let stageOn = false, raf = 0, wake = null, hintT = 0;
const cv = $('#viz'), g = cv.getContext('2d');
function openStage() {
  stageOn = true; $('#stage').classList.add('on'); document.body.classList.add('staging'); renderBar(); sizeViz();
  const el = $('#stage'); try { (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el); } catch (e) {}
  try { navigator.wakeLock && navigator.wakeLock.request('screen').then(w => wake = w).catch(() => {}); } catch (e) {}
  $('#sgHint').style.opacity = 1; clearTimeout(hintT); hintT = setTimeout(() => $('#sgHint').style.opacity = 0, 9000);
  cancelAnimationFrame(raf); raf = requestAnimationFrame(draw);
}
function closeStage() {
  stageOn = false; $('#stage').classList.remove('on', 'touch'); document.body.classList.remove('staging'); $('#gate').classList.remove('on'); cancelAnimationFrame(raf); renderBar();
  try { if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) {}
  try { wake && wake.release(); wake = null; } catch (e) {}
}
function sizeViz() { const r = Math.min(window.devicePixelRatio || 1, 1.5); cv.width = Math.round(innerWidth * r); cv.height = Math.round(innerHeight * r); }
addEventListener('resize', () => stageOn && sizeViz());
const stars = Array.from({length: 150}, () => ({a: Math.random() * 6.283, r: Math.random(), s: .2 + Math.random() * .8}));
const bandSeed = Array.from({length: 64}, (_, i) => .35 + .65 * Math.abs(Math.sin(i * 12.9898) * 43758.5453 % 1));
let t0 = performance.now(), sm = new Float32Array(64), clockS = '';
function draw(now) {
  if (!stageOn) return; raf = requestAnimationFrame(draw);
  const W = cv.width, H = cv.height, cx = W / 2, cy = H * .46, live = P.state === 'playing';
  const l = LANE[mainLane(P.st)] || LANES[0], beat = 60000 / l.bpm, ph = ((now - t0) % beat) / beat, bar = Math.floor((now - t0) / beat) % 4;
  const data = Eng.level(); let kick, lv = new Float32Array(64);
  if (data) { for (let i = 0; i < 64; i++) lv[i] = data[Math.floor(i * 1.5)] / 255; kick = Math.min(1, (lv[1] + lv[2] + lv[3]) / 2.2); }
  else {
    kick = live ? Math.exp(-ph * 5.5) : .06;
    for (let i = 0; i < 64; i++) { const f = i / 64; lv[i] = live ? Math.max(0, bandSeed[i] * (.28 + .72 * kick * (1 - f * .55)) * (.6 + .4 * Math.sin(now / (190 + i * 7) + i)) + (bar === 3 ? .1 * Math.sin(now / 90 + i) : 0)) : .04 + .03 * Math.sin(now / 900 + i); }
  }
  for (let i = 0; i < 64; i++) sm[i] += (lv[i] - sm[i]) * (lv[i] > sm[i] ? .55 : .12);
  g.globalCompositeOperation = 'source-over'; g.fillStyle = 'rgba(3,2,8,' + (live ? .32 : .5) + ')'; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'lighter';
  const R = Math.min(W, H) * (.16 + .035 * kick), [c1, c2] = l.col;
  // light beams sweeping from the top truss
  for (let i = 0; i < 8; i++) {
    const x0 = W * (i + .5) / 8, a = Math.sin(now / (1400 + i * 130) + i * 1.7) * .55, len = H * 1.1, wd = W * .012 * (1 + kick * 1.6);
    const gr = g.createLinearGradient(x0, 0, x0 + Math.sin(a) * len, Math.cos(a) * len); gr.addColorStop(0, i % 2 ? c1 : c2); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = (live ? .1 : .03) + .2 * kick * (live ? 1 : 0); g.fillStyle = gr; g.beginPath(); g.moveTo(x0 - wd * .2, 0); g.lineTo(x0 + wd * .2, 0);
    g.lineTo(x0 + Math.sin(a) * len + wd * 5, Math.cos(a) * len); g.lineTo(x0 + Math.sin(a) * len - wd * 5, Math.cos(a) * len); g.fill();
  }
  // tunnel of sparks flying outward
  g.globalAlpha = 1;
  for (const s of stars) {
    s.r += (.0016 + .012 * kick) * s.s * (live ? 1 : .15); if (s.r > 1.25) { s.r = .05; s.a = Math.random() * 6.283; }
    const d = s.r * Math.max(W, H) * .62, x = cx + Math.cos(s.a) * d, y = cy + Math.sin(s.a) * d, z = 1 + s.r * 3.2;
    g.fillStyle = s.s > .6 ? c2 : c1; g.globalAlpha = Math.min(1, s.r * 1.3); g.fillRect(x, y, z, z);
  }
  // radial spectrum
  g.lineCap = 'round'; g.lineWidth = Math.max(2, W / 330);
  for (let i = 0; i < 128; i++) {
    const v = sm[i < 64 ? i : 127 - i], a = i / 128 * 6.283 - 1.5708 + now / 14000, L = R * (.12 + v * 1.55);
    g.strokeStyle = i % 2 ? c1 : c2; g.globalAlpha = .45 + .55 * v;
    g.beginPath(); g.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.lineTo(cx + Math.cos(a) * (R + L), cy + Math.sin(a) * (R + L)); g.stroke();
  }
  const rg = g.createRadialGradient(cx, cy, R * .1, cx, cy, R * (1 + kick * .5)); rg.addColorStop(0, c1); rg.addColorStop(.6, 'rgba(0,0,0,0)');
  g.globalAlpha = .22 + .5 * kick; g.fillStyle = rg; g.beginPath(); g.arc(cx, cy, R * (1 + kick * .5), 0, 6.283); g.fill();
  g.globalAlpha = .9; g.strokeStyle = c2; g.lineWidth = Math.max(2, W / 420) * (1 + kick * 2); g.beginPath(); g.arc(cx, cy, R * .96, 0, 6.283); g.stroke();
  // floor bars
  const bw = W / 64;
  for (let i = 0; i < 64; i++) { const v = sm[(i * 7) % 64], h = v * H * .2; g.globalAlpha = .16 + .3 * v; g.fillStyle = i % 2 ? c1 : c2; g.fillRect(i * bw + bw * .15, H - h, bw * .7, h); }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  const d = new Date(), cs = d.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'});
  if (cs !== clockS) { clockS = cs; $('#sgClock').textContent = cs; renderBar(); }
}
$('#bStage').onclick = $('#bStageTop').onclick = () => stageOn ? closeStage() : openStage();
$('#sgX').onclick = closeStage;
$('#stage').addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' || true) { $('#stage').classList.add('touch'); clearTimeout(openStage.t); openStage.t = setTimeout(() => $('#stage').classList.remove('touch'), 3500); } });
/* touch: a sideways swipe changes station, up or down changes lane (the same moves as the remote's arrows) */
{ const sg = $('#stage'); let sx = 0, sy = 0, one = false;
  sg.addEventListener('touchstart', e => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; one = e.touches.length === 1; }, {passive: true});
  sg.addEventListener('touchend', e => {
    if (!one || !stageOn) return; one = false;
    const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy, ax = Math.abs(dx), ay = Math.abs(dy);
    if (ax > 60 && ax > 1.5 * ay) Eng.step(dx < 0 ? 1 : -1); else if (ay > 60 && ay > 1.5 * ax) cycleLane(dy < 0 ? 1 : -1);
  }, {passive: true});
  if (matchMedia('(pointer:coarse)').matches) $('#sgHint').textContent = 'Swipe sideways to change station, up or down to change lane. Tap to show close.'; }
$('#bGate').onclick = () => { $('#gate').classList.remove('on'); togglePlay(); };
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && stageOn && QS.get('stage') == null) closeStage(); });
document.addEventListener('keydown', e => {
  if (/INPUT|SELECT|TEXTAREA/.test((e.target || {}).tagName || '')) { if (e.key === 'Enter') { const m = {q: null, sq: '#bSq', dq: '#bDj', fq: '#bFind'}[e.target.id]; if (m) $(m).click(); e.target.blur(); } return; }
  const k = e.key;
  if (stageOn) {
    if ($('#gate').classList.contains('on') && (k === 'Enter' || k === ' ')) { e.preventDefault(); $('#bGate').click(); return; }
    if (k === 'ArrowRight') Eng.step(1); else if (k === 'ArrowLeft') Eng.step(-1); else if (k === 'ArrowUp') cycleLane(-1); else if (k === 'ArrowDown') cycleLane(1);
    else if (k === 'Enter' || k === ' ' || k === 'MediaPlayPause') togglePlay(); else if (k === 'Escape' || k === 'Backspace' || k === 'GoBack' || k === 'BrowserBack') closeStage();
    else if (k === 'h') P.st && toggleFav(P.st.id); else return;
    e.preventDefault(); return;
  }
  if (k === ' ' || k === 'MediaPlayPause') { e.preventDefault(); togglePlay(); } else if (k === 'f') openStage();
  else if (k === 'MediaTrackNext' || (k === 'ArrowRight' && e.shiftKey)) Eng.step(1); else if (k === 'MediaTrackPrevious' || (k === 'ArrowLeft' && e.shiftKey)) Eng.step(-1);
});

const SETQ = [''], setsLoaded = true, searchSets = () => {}, playOnTv = () => {};
/* ---------- DJ: reads the request and picks lane, place and stations ---------- */
const DJQ = ['Festival mainstage, maximum energy', 'Harder and faster', 'Uplifting trance for a long drive', 'Take me around the world', 'Dutch hardstyle', 'Ibiza sunset into the night', 'Fast drum and bass', 'Gym session, no slow moments'];
$('#djChips').innerHTML = DJQ.map(q => `<button class="chip" data-dj="${esc(q)}">${esc(q)}</button>`).join('');
function djLocal(text) {
  const t = text.toLowerCase(), out = {lanes: [], country: '', continent: '', tour: /world|travel|tour|globe|everywhere|countries/.test(t), say: ''};
  const rules = [['hardcore', /hardcore|gabber|frenchcore|fastest|insane|brutal/], ['hardstyle', /hardstyle|harder|hard\b|defqon|q-?dance|raw/], ['dnb', /drum|dnb|d&b|jungle|bass\b|breaks/], ['psy', /psy|goa/], ['trance', /trance|uplift|armin|asot|euphor|drive|driving/],
    ['techno', /techno|warehouse|berlin|dark/], ['euro', /euro|90s|hands ?up|classic|throwback/], ['house', /house|ibiza|club|sunset|groov/], ['mainstage', /mainstage|festival|tomorrowland|big ?room|edm|guetta|garrix|anthem|gym|workout|energy|party/]];
  rules.forEach(([k, rx]) => { if (rx.test(t)) out.lanes.push(k); });
  if (!out.lanes.length) out.lanes = ['mainstage'];
  for (const [k, n] of Object.entries(CONT)) if (t.includes(n.toLowerCase())) out.continent = k;
  const adj = {dutch: 'NL', german: 'DE', french: 'FR', british: 'GB', uk: 'GB', spanish: 'ES', italian: 'IT', russian: 'RU', american: 'US', brazilian: 'BR', greek: 'GR', belgian: 'BE', polish: 'PL', ibiza: 'ES'};
  for (const c of new Set(ALL.map(s => s.c))) if (t.includes(cname(c).toLowerCase())) out.country = c;
  for (const [w, c] of Object.entries(adj)) if (new RegExp('\\b' + w + '\\b').test(t)) out.country = c;
  return out;
}
function applyDj(p, viaClaude) {
  const lanes = (Array.isArray(p.lanes) ? p.lanes : [p.lanes]).map(k => String(k || '').toLowerCase()).filter(k => LANE[k]); if (!lanes.length) lanes.push('mainstage');
  const codes = [...new Set(ALL.map(s => s.c))], low = v => String(v || '').trim().toLowerCase();
  const ctry = codes.find(c => c.toLowerCase() === low(p.country) || cname(c).toLowerCase() === low(p.country)) || '';
  const co = ctry ? '' : (Object.keys(CONT).find(k => k.toLowerCase() === low(p.continent) || CONT[k].toLowerCase() === low(p.continent)) || '');
  let pool = ALL.filter(s => !isBan(s.id) && s.l.some(k => lanes.includes(k)) && (ctry ? s.c === ctry : co ? cont(s.c) === co : true));
  let note = '';
  if (!pool.length) { pool = ALL.filter(s => !isBan(s.id) && s.l.some(k => lanes.includes(k))); note = ' Nothing live from there in that style right now, so this is the best of it from everywhere.'; }
  S.lane = lanes[0]; S.ctry = pool.every(s => s.c === ctry) ? ctry : ''; S.cont = S.ctry ? '' : (note ? '' : co); S.shown = 60; saveFilters();
  if (typeof p.tour === 'boolean' && p.tour !== S.tour) { S.tour = p.tour; store.set('tour', S.tour); armTour(); }
  const picks = (Array.isArray(p.stations) ? p.stations : []).map(i => DJCAT[i] || DJCAT.find(s => s.n.toLowerCase() === low(i))).filter(s => s && !isBan(s.id) && s.l.some(k => lanes.includes(k)));
  buildQueue(pool, null);
  if (picks.length) { const ids = picks.map(s => s.id); Q.list = ids.concat(Q.list.filter(id => !ids.includes(id))); }
  Eng.start(); renderAll();
  const say = $('#djSay'); say.style.display = 'block';
  say.textContent = (String(p.say || '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').replace(/\s*\u2014\s*/g, ', ').replace(/\s+/g, ' ').trim() || ('Locked in: ' + lanes.map(k => LANE[k].n).join(' and ') + (ctry ? ' from ' + cname(ctry) : co ? ' from ' + CONT[co] : '') + (S.tour ? ', touring the world' : '') + '.')) + note + (viaClaude ? '' : '');
}
let DJCAT = [];
async function askDj() {
  const text = $('#dq').value.trim(); if (!text) return;
  // Start the music on the tap itself with the built-in pick (a tap is what lets audio start).
  const local = djLocal(text); applyDj(local, false);
  if (STORE) return;
}
$('#bDj').onclick = askDj;

/* ---------- find more stations in the worldwide directory ---------- */
let found = {};
function guessLanes(tags, name) {
  const t = (tags + ' ' + name).toLowerCase(), out = [];
  [['hardstyle', /hardstyle|rawstyle|hard dance/], ['hardcore', /hardcore|gabber|frenchcore/], ['psy', /psy|goa/], ['dnb', /drum|dnb|jungle/], ['trance', /trance/], ['techno', /techno/], ['euro', /eurodance|hands ?up/], ['house', /house|club|dance/], ['mainstage', /edm|big ?room|festival|electro/]].forEach(([k, rx]) => { if (rx.test(t) && out.length < 3) out.push(k); });
  return out.length ? out : ['mainstage'];
}
async function findStations() {
  const q = $('#fq').value.trim(); if (!q) return; const box = $('#findList'); box.innerHTML = '<div class="empty">Searching the directory</div>';
  const get = async (base, kind) => (await fetch(base + '/json/stations/search?' + kind + '=' + encodeURIComponent(q) + '&hidebroken=true&is_https=true&limit=40&order=votes&reverse=true', {signal: AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined})).json();
  let rows = null;
  for (const base of RB) { try { const [a, b] = await Promise.all([get(base, 'name'), get(base, 'tag')]); rows = a.concat(b); break; } catch (e) {} }
  if (!rows) { box.innerHTML = '<div class="empty">The directory did not answer. Try again in a moment.</div>'; return; }
  found = {}; const out = [];
  rows.forEach(r => {
    const u = r.url_resolved || r.url; if (!/^https:/.test(u || '') || !r.lastcheckok || found[r.stationuuid]) return;   // only secure streams can play on this page
    const s = BY[r.stationuuid] || {id: r.stationuuid, n: (r.name || '').replace(/\s+/g, ' ').trim().slice(0, 60), u, c: (r.countrycode || 'XX').toUpperCase(), l: guessLanes(r.tags || '', r.name || ''), b: r.bitrate || 0, k: (r.codec || '').toUpperCase(), v: r.votes || 0, custom: 1};
    if (/m3u8/.test(u)) s.h = 1; if (s.h && !canHls) return;
    found[s.id] = s; out.push(s);
  });
  out.forEach(s => { if (!BY[s.id]) BY[s.id] = s; });
  box.innerHTML = out.length ? out.slice(0, 40).map(s => rowHtml(s, 'find')).join('') : '<div class="empty">No secure streams found for that.</div>';
}
function addFound(id) {
  const s = found[id] || BY[id]; if (!s) return;
  if (s.custom && !S.extra.some(x => x.id === id)) { S.extra.push(s); store.set('extra', S.extra); rebuild(); }
  if (!isFav(id)) toggleFav(id); else renderSaved();
  toast(s.n + ' saved'); $$('[data-add="' + id + '"]').forEach(b => b.textContent = 'Saved');
}
$('#bFind').onclick = findStations;

/* ---------- keep the catalog fresh: once a day ask the directory which of our stations are off the air ---------- */
async function refreshCatalog() {
  if (Date.now() - store.get('offAt', 0) < 20 * 3600e3) return;
  const ids = SEED.stations.map(s => s.id).filter(id => /^[0-9a-f-]{36}$/.test(id)); if (!ids.length) return;
  for (const base of RB) {
    try {
      const r = await fetch(base + '/json/stations/byuuid', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: 'uuids=' + ids.join(','), signal: AbortSignal.timeout ? AbortSignal.timeout(25000) : undefined});
      const a = await r.json(); if (!Array.isArray(a) || a.length < ids.length / 2) continue;
      const off = a.filter(x => x.lastcheckok === 0 && BY[x.stationuuid]).map(x => x.stationuuid);
      if (off.length > ids.length / 3) return;                    // the directory is having a bad day: keep what we have
      S.off = off; store.set('off', off); store.set('offAt', Date.now());
      const cur = P.st; rebuild(); if (cur && !BY[cur.id]) BY[cur.id] = cur; renderAll(); return;
    } catch (e) {}
  }
}

/* ---------- boot ---------- */
renderAll(); armTour(); setTimeout(refreshCatalog, 4000);
window.RaveIQ = {S, P, Q, Eng, dead, BY, all: () => ALL, blocked: () => ALL.filter(s => s.w), log: LOG, seedAsOf: SEED.as_of};
{ const bar = $('#bar'), setH = () => document.documentElement.style.setProperty('--barh', Math.round(bar.getBoundingClientRect().height) + 'px'); setH(); addEventListener('resize', setH); setTimeout(setH, 400); setTimeout(setH, 1500);   // the safe-area padding arrives after first layout
  try { new ResizeObserver(setH).observe(bar, {box: 'border-box'}); } catch (e) {} }
if (QS.get('stage') != null) { openStage(); $('#gate').classList.add('on'); setTimeout(() => $('#bGate').focus(), 50); }
