// The iPad side: keeps every event on the iPad, sends them to the home server
// whenever it can reach it (on Wi-Fi, or over cell and WireGuard), and draws the screens.

// ---------- Saved on the iPad ----------

const KEY = 'roadtrip.v1';
let db = { events: [], seq: 0, tab: 'flocks', mode: 'compete', mapTrip: null }; // events: [{id,type,ts,data,seq?}]
let state = null;
let known = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) db = Object.assign(db, JSON.parse(raw));
  } catch (_) { /* private window or blocked storage: run from memory */ }
  known = new Set(db.events.map(e => e.id));
}

let saveWarned = false;
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch (_) {
    if (!saveWarned) { saveWarned = true; toast('This browser won\'t let the page save. Keep the page open until it says "Saved at home".'); }
  }
}

function newId() {
  // crypto.randomUUID only works on https pages, and the plain home address is http.
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return Date.now().toString(36) + '-' + Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
}

// Sightings carry where they happened, when the iPad knows.
const SIGHTINGS = new Set(['flock.add', 'flock.cemetery', 'flock.church', 'zombie.add', 'volvo.add', 'plate.spot']);

function record(type, data) {
  const before = known;
  if (SIGHTINGS.has(type)) {
    const l = here();
    if (l) data = { ...data, loc: l };
  }
  const e = { id: newId(), type, ts: Date.now(), data };
  db.events.push(e);
  known = new Set(known);
  known.add(e.id);
  save();
  refresh(before);
  syncSoon();
  return e;
}

function refresh(seenBefore) {
  state = buildState(db.events, seenBefore || null);
  for (const n of state.newAwards) {
    const a = AWARDS.find(x => x.id === n.award);
    const p = state.players[n.player];
    if (a && p) toast(`${a.icon} ${esc(p.name)} earned <b>${a.name}</b>!`, true);
  }
  render();
}

// ---------- Where are we? ----------

let fix = null, geoState = 'off', geoWatch = null;

function startGeo() {
  if (!window.isSecureContext || !navigator.geolocation) { geoState = 'needs-https'; return; }
  if (geoWatch !== null) return;
  geoState = 'starting';
  geoWatch = navigator.geolocation.watchPosition(p => {
    fix = { lat: +p.coords.latitude.toFixed(6), lon: +p.coords.longitude.toFixed(6), acc: Math.round(p.coords.accuracy), at: Date.now() };
    geoState = 'on';
  }, err => {
    geoState = err.code === 1 ? 'denied' : 'searching';
  }, { enableHighAccuracy: true, maximumAge: 30000, timeout: 60000 });
}

function here() {
  if (!fix || Date.now() - fix.at > 3 * 60 * 1000) return null;
  return { lat: fix.lat, lon: fix.lon, acc: fix.acc };
}

// ---------- Talking to the home server ----------

let syncing = false, syncTimer = null, lastOK = 0, lastErr = '', status = null;

function pending() { return db.events.filter(e => !e.seq); }

async function sync() {
  if (syncing) return;
  syncing = true;
  try {
    const out = pending();
    if (out.length) {
      const r = await fetch('api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ events: out.map(({ seq, ...e }) => e) }) });
      if (!r.ok) throw new Error(await r.text());
    }
    const r = await fetch('api/events?since=' + db.seq, { cache: 'no-store' });
    if (!r.ok) throw new Error('server said ' + r.status);
    const body = await r.json();
    if (body.seq < db.seq) {
      // The home server lost its history (a new install, say). This iPad still
      // has it, so send it all again on the next try.
      for (const e of db.events) delete e.seq;
      setTimeout(syncSoon, 0);
    }
    const byId = new Map(db.events.map(e => [e.id, e]));
    let added = false;
    for (const e of body.events || []) {
      const mine = byId.get(e.id);
      if (mine) mine.seq = e.seq;
      else { db.events.push(e); byId.set(e.id, e); added = true; }
    }
    db.seq = body.seq;
    known = new Set(db.events.map(e => e.id));
    save();
    lastOK = Date.now();
    lastErr = '';
    // No award pop-ups for history arriving from home; those were celebrated when they happened.
    if (added) refresh(null); else renderSync();
  } catch (err) {
    lastErr = navigator.onLine === false ? 'offline' : String(err.message || err);
    renderSync();
  } finally {
    syncing = false;
  }
}

function syncSoon() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(sync, 800);
}

async function loadStatus() {
  try {
    const r = await fetch('api/status', { cache: 'no-store' });
    if (r.ok) { status = await r.json(); if (db.tab === 'setup') render(); }
  } catch (_) { /* not home */ }
}

// ---------- Helpers ----------

const $ = sel => document.querySelector(sel);
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
function playerName(pid) { const p = state.players[pid]; return p ? esc(p.name) : '?'; }
function dot(pid) { const p = state.players[pid]; return `<span class="dot" style="background:${p ? p.color : '#999'}"></span>`; }
function fmtDate(ts) { return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
function fmtTime(ts) { return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); }
function num(n) { return Number(n || 0).toLocaleString(); }
function plural(n, one, many) { return `${num(n)} ${n === 1 ? one : many}`; }

let toastTimer = null;
function toast(html, big) {
  const t = $('#toast');
  t.innerHTML = html;
  t.className = 'toast show' + (big ? ' big' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, big ? 4000 : 2000);
}

function sheet(html) {
  $('#sheet-body').innerHTML = html;
  $('#sheet').classList.add('open');
}
function closeSheet() { $('#sheet').classList.remove('open'); }

// ---------- Screens ----------

function isDark() {
  if (db.theme) return db.theme === 'dark';
  return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
}
function applyTheme() {
  if (db.theme) document.documentElement.dataset.theme = db.theme;
  else delete document.documentElement.dataset.theme;
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.content = isDark() ? '#101413' : '#2f6f4f';
}

const MODE_TABS = {
  compete: [['flocks', '🐄 Flocks'], ['zombies', '🧟 Zombies'], ['volvos', '🚚 Volvos']],
  together: [['plates', '🚗 License plates']],
};
const COMMON_TABS = [['map', '🗺️ Map'], ['stats', '📊 Stats'], ['awards', '🏅 Awards'], ['setup', '⚙️ Trips & players']];

function render() {
  const tabs = [...MODE_TABS[db.mode], ...COMMON_TABS];
  if (!tabs.some(([id]) => id === db.tab)) db.tab = tabs[0][0];
  $('#theme').textContent = isDark() ? '☀️ Day' : '🌙 Night';
  $('#mode').innerHTML = `<button class="${db.mode === 'compete' ? 'on' : ''}" data-mode="compete">🏁 Competitive</button><button class="${db.mode === 'together' ? 'on' : ''}" data-mode="together">🤝 Together</button>`;
  $('#tabs').innerHTML = tabs.map(([id, label]) => `<button class="tab${db.tab === id ? ' on' : ''}" data-tab="${id}">${label}</button>`).join('');
  const t = state.activeTrip;
  $('#trip-name').textContent = t ? t.name : 'No trip going';
  const view = { flocks: viewFlocks, zombies: viewZombies, volvos: viewVolvos, plates: viewPlates, map: viewMap, stats: viewStats, awards: viewAwards, setup: viewSetup }[db.tab];
  dropMap();
  $('#main').innerHTML = view();
  if (db.tab === 'map') drawMap();
  renderSync();
}

function renderSync() {
  const n = pending().length;
  const el = $('#sync');
  if (!el) return;
  let cls = 'ok', text = 'Saved at home';
  if (n) {
    cls = 'wait';
    text = `${n} waiting to save at home`;
  } else if (!lastOK) {
    cls = 'wait';
    text = 'Not connected to home yet';
  }
  el.className = 'sync ' + cls;
  el.textContent = text;
  const gps = $('#gps');
  if (gps) {
    const g = { on: ['ok', 'GPS'], starting: ['wait', 'Finding GPS'], searching: ['wait', 'Finding GPS'], denied: ['bad', 'GPS blocked'], 'needs-https': ['off', ''], off: ['off', ''] }[geoState];
    gps.className = 'sync ' + g[0];
    gps.textContent = g[1];
  }
}

function noTrip() {
  return `<div class="card center"><h2>No trip going right now</h2>
    <p>Start a trip to play. Everyone on the trip plays every game.</p>
    <button class="big primary" data-act="new-trip">Start a trip</button></div>`;
}

// One panel per player, side by side.
function panels(t, body) {
  return `<div class="flocks" style="--cols:${Math.min(t.players.length, 4)}">` + t.players.map(pid => {
    const p = state.players[pid];
    return `<section class="flock" style="--pc:${p.color}">${body(pid, t.by[pid], p)}</section>`;
  }).join('') + `</div>`;
}

function leaderOf(t, score) {
  const best = Math.max(...t.players.map(pid => score(t.by[pid])));
  return pid => best > 0 && score(t.by[pid]) === best;
}

function viewFlocks() {
  const t = state.activeTrip;
  if (!t) return noTrip();
  const lead = leaderOf(t, tp => tp.score);
  return panels(t, (pid, tp, p) => `
    <header><span class="pname">${esc(p.name)}</span>${lead(pid) ? '<span class="crown">👑</span>' : ''}</header>
    <div class="score">${num(tp.score)}</div>
    <div class="sub">${tp.dead ? `⛪ ${num(tp.dead)} waiting for a church` : `${num(tp.counted)} counted`} · ${plural(tp.deaths, 'death', 'deaths')}</div>
    <div class="animals">${ANIMALS.map(a => `<button class="animal" data-act="count" data-player="${pid}" data-animal="${a.id}">
      <span class="icon">${a.icon}</span><span>${a.name}</span><span class="n">${num(tp.byAnimal[a.id] || 0)}</span></button>`).join('')}</div>
    <div class="row">
      <button class="danger" data-act="cemetery" data-player="${pid}">🪦 Cemetery</button>
      <button class="holy" data-act="church" data-player="${pid}">⛪ Church</button>
    </div>
    <div class="row"><button class="ghost" data-act="undo" data-game="flocks" data-player="${pid}">↩ Undo</button></div>`);
}

function viewZombies() {
  const t = state.activeTrip;
  if (!t) return noTrip();
  const lead = leaderOf(t, tp => tp.zombies);
  return panels(t, (pid, tp, p) => `
    <header><span class="pname">${esc(p.name)}</span>${lead(pid) ? '<span class="crown">🧟</span>' : ''}</header>
    <div class="score">${num(tp.zombies)}</div>
    <div class="sub">zombie flock · one tap each</div>
    <div class="animals">${ZOMBIES.map(z => `<button class="animal zombie" data-act="zombie" data-player="${pid}" data-animal="${z.id}">
      <span class="icon">${z.icon}</span><span>${z.name}</span><span class="n">${num(tp.zombieBy[z.id] || 0)}</span></button>`).join('')}</div>
    <div class="row"><button class="ghost" data-act="undo" data-game="zombies" data-player="${pid}">↩ Undo</button></div>`);
}

function swatch(c) { return `<span class="swatch" style="background:${c.hex}"></span>`; }

function viewVolvos() {
  const t = state.activeTrip;
  if (!t) return noTrip();
  const lead = leaderOf(t, tp => tp.volvos);
  return panels(t, (pid, tp, p) => `
    <header><span class="pname">${esc(p.name)}</span>${lead(pid) ? '<span class="crown">👑</span>' : ''}</header>
    <div class="score">${num(tp.volvos)}</div>
    <div class="sub">Volvo trucks · ${num(tp.volvoBranded)} with VOLVO on the fairing</div>
    <div class="colors-grid">${VOLVO_COLORS.map(c => `<button class="vcolor" data-act="volvo" data-player="${pid}" data-color="${c.id}">
      ${swatch(c)}<span>${c.name}</span><span class="n">${num(tp.volvoBy[c.id] || 0)}</span></button>`).join('')}</div>
    <div class="row"><button class="ghost" data-act="undo" data-game="volvos" data-player="${pid}">↩ Undo</button></div>`);
}

function viewPlates() {
  const t = state.activeTrip;
  if (!t) return noTrip();
  const seen = Object.keys(t.plates);
  const states = US_STATES.filter(s => t.plates[s]).length;
  const canada = seen.filter(k => k.startsWith('CA-')).length;
  return `<div class="card plate-head">
      <div><b class="bignum">${states}</b> of 50 states${t.plates.DC ? ' + DC' : ''}${canada ? ` · ${canada} Canadian` : ''}</div>
      <div class="muted">The whole car plays together. Tap a plate when anyone sees it.</div>
      <div class="bar"><div style="width:${states * 2}%"></div></div>
    </div>` + PLATE_REGIONS.map(r => `<h3 class="region">${r.name}</h3><div class="plates">` + r.plates.map(([code, name]) => {
    const key = r.country === 'CA' ? 'CA-' + code : code;
    const s = t.plates[key];
    return `<button class="plate${s ? ' seen' : ''}" data-act="plate" data-plate="${key}">
      <span class="code">${code}</span><span class="pl-name">${name}</span>${s ? `<span class="by">${fmtTime(s.ts)}</span>` : ''}</button>`;
  }).join('') + `</div>`).join('');
}

// ---------- Map ----------

let map = null, mapView = null;

function allTrips() { return [...state.tripOrder].reverse().map(id => state.trips[id]); }

function viewMap() {
  const trips = allTrips();
  if (!trips.length) return `<div class="card center"><p>No trips yet.</p></div>`;
  if (!db.mapTrip || !state.trips[db.mapTrip]) db.mapTrip = (state.activeTrip || trips[0]).id;
  const t = state.trips[db.mapTrip];
  const note = t.pins.length ? `${plural(t.pins.length, 'sighting', 'sightings')} with a location` :
    (geoState === 'needs-https' ? 'Nothing on the map yet. Locations are only saved when the page is opened on its secure address; see Trips &amp; players.' : 'Nothing on the map yet for this trip.');
  return `<div class="card map-head"><select id="map-trip">${trips.map(x => `<option value="${x.id}" ${x.id === t.id ? 'selected' : ''}>${esc(x.name)} · ${fmtDate(x.start)}</option>`).join('')}</select>
    <span class="muted">${note}</span>
    <div class="chips">${[['flock', '🐄 Flocks'], ['cemetery', '🪦 Cemeteries'], ['church', '⛪ Churches'], ['zombie', '🧟 Zombies'], ['volvo', '🚚 Volvos'], ['plate', '🚗 Plates']].map(([k, l]) => `<span class="chip">${l} ${t.pins.filter(p => p.kind === k).length}</span>`).join('')}</div></div>
    <div id="map" class="map"></div>`;
}

function dropMap() {
  if (map) { mapView = { c: map.getCenter(), z: map.getZoom(), trip: db.mapTrip }; map.remove(); map = null; }
}

function drawMap() {
  const el = $('#map');
  if (!el || typeof L === 'undefined') return;
  const t = state.trips[db.mapTrip];
  map = L.map(el);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);
  const pts = [];
  for (const p of t.pins) {
    const pl = p.player && state.players[p.player];
    const icon = L.divIcon({ className: 'pin', html: `<span style="border-color:${pl ? pl.color : '#2f6f4f'}">${p.icon}</span>`, iconSize: [34, 34], iconAnchor: [17, 17] });
    L.marker([p.lat, p.lon], { icon }).addTo(map)
      .bindPopup(`<b>${esc(p.label)}</b><br>${pl ? esc(pl.name) + ' · ' : ''}${fmtTime(p.ts)}, ${fmtDate(p.ts)}`);
    pts.push([p.lat, p.lon]);
  }
  if (pts.length > 1) L.polyline(pts, { color: '#2f6f4f', weight: 3, opacity: 0.5, dashArray: '6 6' }).addTo(map);
  if (mapView && mapView.trip === db.mapTrip) map.setView(mapView.c, mapView.z);
  else if (pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 14 });
  else if (fix) map.setView([fix.lat, fix.lon], 11);
  else map.setView([39.5, -98.35], 4);
}

// ---------- Stats and awards ----------

function visiblePlayers() { return state.playerOrder.filter(pid => !state.players[pid].hidden); }

function table(title, pids, rows) {
  return `<div class="card scroll"><h2>${title}</h2><table class="stats"><thead><tr><th></th>${pids.map(pid => `<th>${dot(pid)}${playerName(pid)}</th>`).join('')}</tr></thead><tbody>` +
    rows.map(([label, f]) => {
      const vals = pids.map(pid => f(state.life[pid]));
      const best = Math.max(...vals);
      return `<tr><td>${label}</td>${vals.map(v => `<td class="${v > 0 && v === best && pids.length > 1 ? 'best' : ''}">${num(v)}</td>`).join('')}</tr>`;
    }).join('') + `</tbody></table></div>`;
}

function viewStats() {
  const pids = visiblePlayers();
  if (!pids.length) return `<div class="card center"><p>Add players under Trips &amp; players to start keeping stats.</p></div>`;
  const sub = s => `&nbsp;&nbsp;${s}`;
  const flocks = table('🐄 Flocks, all-time', pids, [
    ['Trips', l => l.trips],
    ['Flocks wins', l => l.wins.flocks],
    ['Animals counted', l => l.animals],
    ...ANIMALS.map(a => [sub(`${a.icon} ${a.name}`), l => l.byAnimal[a.id] || 0]),
    ['Flocks killed with cemeteries', l => l.kills],
    ['Times their flock died', l => l.deaths],
    ['Animals lost', l => l.lost],
    ['Churches', l => l.churches],
    ['Animals brought back', l => l.raised],
    ['Biggest flock at a trip\'s end', l => l.bestFlock],
  ]);
  const zombies = table('🧟 Zombies, all-time', pids, [
    ['Zombie wins', l => l.wins.zombies],
    ['Zombies spotted', l => l.zombies],
    ...ZOMBIES.map(z => [sub(`${z.icon} ${z.name}`), l => l.zombieBy[z.id] || 0]),
  ]);
  const volvos = table('🚚 Volvo trucks, all-time', pids, [
    ['Volvo wins', l => l.wins.volvos],
    ['Volvo trucks spotted', l => l.volvos],
    [sub('with VOLVO on the fairing'), l => l.volvoBranded],
    ...VOLVO_COLORS.map(c => [sub(`${swatch(c)}${c.name}`), l => l.volvoBy[c.id] || 0]),
  ]);

  const everPlates = new Set();
  for (const pid of state.playerOrder) for (const k of state.life[pid].uniquePlates) everPlates.add(k);
  const plates = `<div class="card"><h2>🚗 License plates, all-time</h2><p><b>${US_STATES.filter(s => everPlates.has(s)).length}</b> of 50 states seen${everPlates.has('DC') ? ' + DC' : ''} · <b>${[...everPlates].filter(k => k.startsWith('CA-')).length}</b> Canadian</p>
    <p class="muted">Never seen yet: ${US_STATES.filter(s => !everPlates.has(s)).map(s => PLATES[s].name).join(', ') || 'nothing. You\'ve seen them all!'}</p></div>`;

  const win = (t, id) => t.end ? (t.winners[id].map(playerName).join(' & ') || '–') : '…';
  const history = `<div class="card scroll"><h2>Trips</h2><table class="stats trips"><thead><tr><th>Trip</th><th>When</th><th>🐄 Flocks</th><th>🧟 Zombies</th><th>🚚 Volvos</th><th>🚗 Plates</th></tr></thead><tbody>` +
    allTrips().map(t => `<tr><td>${esc(t.name)}${t.end ? '' : ' <span class="live">playing</span>'}</td><td>${fmtDate(t.start)}</td>
      <td>${win(t, 'flocks')}</td><td>${win(t, 'zombies')}</td><td>${win(t, 'volvos')}</td>
      <td>${US_STATES.filter(s => t.plates[s]).length} states</td></tr>`).join('') +
    `</tbody></table></div>`;
  return flocks + zombies + volvos + plates + history;
}

function viewAwards() {
  const pids = visiblePlayers();
  if (!pids.length) return `<div class="card center"><p>Add players under Trips &amp; players first.</p></div>`;
  return pids.map(pid => {
    const l = state.life[pid];
    const earned = AWARDS.filter(a => l.awards[a.id]).length;
    return `<div class="card"><h2>${dot(pid)}${playerName(pid)} <span class="muted">${earned} of ${AWARDS.length}</span></h2><div class="awards">` +
      AWARDS.map(a => {
        const got = l.awards[a.id];
        const trip = got && got.trip && state.trips[got.trip];
        return `<div class="award${got ? ' got' : ''}"><div class="aicon">${a.icon}</div><div><b>${a.name}</b><div class="muted">${a.desc}</div>
          ${got ? `<div class="when">${fmtDate(got.ts)}${trip ? ' · ' + esc(trip.name) : ''}</div>` : ''}</div></div>`;
      }).join('') + `</div></div>`;
  }).join('');
}

// ---------- Setup ----------

function viewSetup() {
  const t = state.activeTrip;
  const trip = t
    ? `<div class="card"><h2>Playing: ${esc(t.name)}</h2><p>Started ${fmtDate(t.start)} at ${fmtTime(t.start)} with ${t.players.map(playerName).join(', ')}.</p>
        <button class="big" data-act="end-trip">🏁 End this trip</button>
        <p class="muted">Ending the trip crowns the winners of Flocks, Zombies and Volvos and locks in the scores.</p></div>`
    : `<div class="card"><h2>No trip going</h2><button class="big primary" data-act="new-trip">Start a trip</button></div>`;
  const players = `<div class="card"><h2>Players</h2><div class="plist">` + state.playerOrder.map(pid => {
    const p = state.players[pid];
    return `<div class="prow${p.hidden ? ' hidden' : ''}">${dot(pid)}<span class="grow">${esc(p.name)}</span>
      <button class="ghost" data-act="edit-player" data-player="${pid}">Change</button></div>`;
  }).join('') + `</div><button data-act="add-player">+ Add a player</button></div>`;
  const saving = `<div class="card"><h2>Saving</h2><p>${syncDetail()}</p>
    <p class="muted">Everything is kept on this iPad as you play, so a dead zone never loses anything. Whenever the iPad can reach home (home Wi-Fi, or WireGuard over cell) it sends what it has and picks up what any other device recorded.</p>
    <div class="row"><button data-act="sync">Save at home now</button><a class="button ghost" href="api/backup">Download a backup</a></div></div>`;
  return trip + players + locationCard() + saving;
}

function locationCard() {
  const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (window.isSecureContext && !local) {
    const g = { on: `GPS is on${fix ? ` (accurate to about ${fix.acc} m)` : ''}. Every sighting is saved with where it happened.`, starting: 'Looking for GPS…', searching: 'Looking for GPS…', denied: 'This iPad said no to sharing its location. In Settings, Privacy &amp; Security, Location Services, Safari Websites, choose "While Using the App".', off: 'GPS starts when a trip starts.' }[geoState] || '';
    return `<div class="card"><h2>📍 Locations</h2><p>${g}</p></div>`;
  }
  const s = status && status.secure_addresses;
  if (!s || !s.length) return `<div class="card"><h2>📍 Locations</h2><p class="muted">Locations need the page's secure address, which the home server doesn't have turned on.</p></div>`;
  return `<div class="card"><h2>📍 Turn on locations for the map</h2>
    <p>The iPad only shares its GPS with a page on a secure (https) address. The home server has one, and the iPad needs to trust it once:</p>
    <ol class="steps">
      <li>On the iPad, in Safari, tap <a href="roadtrip-games.crt"><b>Download the home certificate</b></a> and tap <b>Allow</b>.</li>
      <li>Open <b>Settings</b>, tap <b>Profile Downloaded</b> near the top, then <b>Install</b> (it asks for the iPad's passcode).</li>
      <li>In <b>Settings, General, About, Certificate Trust Settings</b>, switch on <b>Roadtrip Games at home</b>.</li>
      <li>Check the top of this page says <b>Saved at home</b>, then open the secure address below and add it to the home screen (Share, Add to Home Screen). Use that one from now on.</li>
    </ol>
    <div class="addr">${s.map(a => `<a href="${esc(a)}">${esc(a)}</a>`).join('')}</div>
    <p class="muted">Pick the one with the same numbers as the address bar now. The plain and secure addresses keep separate copies on the iPad, which is why this one should say Saved at home before you switch. Certificate fingerprint (SHA-256): <code>${esc(status.fingerprint)}</code></p></div>`;
}

function syncDetail() {
  const n = pending().length;
  const parts = [];
  parts.push(n ? `${plural(n, 'thing', 'things')} on this iPad waiting to be saved at home.` : 'Everything on this iPad is saved at home.');
  if (lastOK) parts.push(`Last reached home at ${fmtTime(lastOK)}.`);
  if (lastErr && lastErr !== 'offline') parts.push(`Last try: ${esc(lastErr)}`);
  return parts.join(' ');
}

// ---------- Sheets (pop-ups) ----------

function countSheet(pid, animal) {
  const a = ANIMALS.find(x => x.id === animal);
  sheet(`<h2>${dot(pid)}${playerName(pid)}: how many ${a.name.toLowerCase()}?</h2>
    <div class="pad">${[1, 2, 3, 4, 5, 6, 8, 10, 15, 20, 25, 30, 40, 50, 75, 100].map(n => `<button data-act="add" data-n="${n}" data-player="${pid}" data-animal="${animal}">${n}</button>`).join('')}</div>
    <div class="row"><input id="custom-n" type="number" inputmode="numeric" min="1" placeholder="Other amount">
    <button class="primary" data-act="add-custom" data-player="${pid}" data-animal="${animal}">Add</button></div>`);
}

function cemeterySheet(pid) {
  const t = state.activeTrip;
  const others = t.players.filter(x => x !== pid);
  if (!others.length) { toast('Nobody else to bury'); return; }
  sheet(`<h2>🪦 ${playerName(pid)} spotted a cemetery!</h2><p>Whose flock dies?</p>
    <div class="who pick">${others.map(v => `<label class="pickp" style="--pc:${state.players[v].color}"><input type="checkbox" value="${v}" checked>${playerName(v)} <span class="muted">${num(t.by[v].score)}</span></label>`).join('')}</div>
    <button class="danger big" data-act="cemetery-yes" data-player="${pid}">Kill those flocks</button>`);
}

function churchSheet(pid) {
  const tp = state.activeTrip.by[pid];
  if (!tp.dead) {
    sheet(`<h2>⛪ ${playerName(pid)} spotted a church</h2><p>${playerName(pid)}'s flock hasn't died since the last church, so there's nothing to bring back.</p>
      <div class="row"><button class="holy" data-act="church-yes" data-player="${pid}">Count it anyway</button><button class="ghost" data-act="close">OK</button></div>`);
    return;
  }
  sheet(`<h2>⛪ ${playerName(pid)} spotted a church!</h2><p>${playerName(pid)} gets back the ${num(tp.dead)} animals lost to cemeteries.</p>
    <button class="holy big" data-act="church-yes" data-player="${pid}">Hallelujah, bring them back</button>`);
}

function volvoSheet(pid, color) {
  const c = VOLVO_COLORS.find(x => x.id === color);
  sheet(`<h2>${dot(pid)}${playerName(pid)}: ${swatch(c)}${c.name} Volvo truck</h2>
    <div class="who volvo-pick">
      <button data-act="volvo-yes" data-player="${pid}" data-color="${color}" data-branded="0">${esc(volvoName(color, false))}</button>
      <button data-act="volvo-yes" data-player="${pid}" data-color="${color}" data-branded="1">${esc(volvoName(color, true))}<small>VOLVO on the fairing</small></button>
    </div>`);
}

function plateSheet(key) {
  const t = state.activeTrip;
  const pl = PLATES[key];
  const s = t.plates[key];
  if (!s) {
    record('plate.spot', { trip: t.id, plate: key });
    toast(`🚗 ${pl.name}!`);
    return;
  }
  sheet(`<h2>${pl.name}</h2><p>Found at ${fmtTime(s.ts)}.</p>
    <div class="row"><button class="danger" data-act="unspot" data-event="${s.event}">Take it back</button><button class="ghost" data-act="close">Keep it</button></div>`);
}

function newTripSheet() {
  const pids = visiblePlayers();
  const d = new Date();
  sheet(`<h2>Start a trip</h2>
    <label>Trip name<input id="trip-name-in" value="Trip on ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}"></label>
    <p>Who's playing? (up to ${MAX_PLAYERS})</p>
    <div class="who pick">${pids.map((pid, i) => `<label class="pickp" style="--pc:${state.players[pid].color}"><input type="checkbox" value="${pid}" ${i < MAX_PLAYERS ? 'checked' : ''}>${playerName(pid)}</label>`).join('') || '<p class="muted">No players yet. Add some below.</p>'}</div>
    <div class="row"><input id="new-player-name" placeholder="Add a player's name"><button data-act="add-player-inline">Add</button></div>
    <button class="big primary" data-act="start-trip">Let's go!</button>`);
}

function playerSheet(pid) {
  const p = pid ? state.players[pid] : null;
  sheet(`<h2>${p ? 'Change ' + esc(p.name) : 'Add a player'}</h2>
    <label>Name<input id="pname" value="${p ? esc(p.name) : ''}" placeholder="Name"></label>
    <p>Colour</p><div class="colors">${PLAYER_COLORS.map((c, i) => `<label><input type="radio" name="pcolor" value="${c}" ${(p ? p.color === c : i === state.playerOrder.length % PLAYER_COLORS.length) ? 'checked' : ''}><span style="background:${c}"></span></label>`).join('')}</div>
    ${p ? `<label class="check"><input id="phidden" type="checkbox" ${p.hidden ? 'checked' : ''}> Hide from new trips, stats and awards (their history is kept)</label>` : ''}
    <button class="big primary" data-act="save-player" data-player="${pid || ''}">Save</button>`);
}

// ---------- Taps ----------

function onClick(ev) {
  const b = ev.target.closest('[data-act],[data-tab],[data-mode]');
  if (!b) return;
  if (b.dataset.mode) { db.mode = b.dataset.mode; db.tab = MODE_TABS[db.mode][0][0]; save(); render(); window.scrollTo(0, 0); return; }
  if (b.dataset.tab) { db.tab = b.dataset.tab; save(); render(); window.scrollTo(0, 0); if (db.tab === 'setup') loadStatus(); return; }
  const d = b.dataset, t = state.activeTrip;
  switch (d.act) {
    case 'count': countSheet(d.player, d.animal); break;
    case 'add':
      record('flock.add', { trip: t.id, player: d.player, animal: d.animal, n: Number(d.n) });
      closeSheet();
      break;
    case 'add-custom': {
      const n = Math.floor(Number($('#custom-n').value));
      if (n > 0) { record('flock.add', { trip: t.id, player: d.player, animal: d.animal, n }); closeSheet(); }
      break;
    }
    case 'cemetery': cemeterySheet(d.player); break;
    case 'cemetery-yes': {
      const victims = [...document.querySelectorAll('.pick input:checked')].map(i => i.value);
      if (!victims.length) { toast('Pick at least one flock'); break; }
      record('flock.cemetery', { trip: t.id, player: d.player, victims });
      closeSheet();
      toast(`🪦 ${victims.map(playerName).join(' & ')} lost ${victims.length === 1 ? 'their flock' : 'their flocks'}`, true);
      break;
    }
    case 'church': churchSheet(d.player); break;
    case 'church-yes': {
      const n = t.by[d.player].dead;
      record('flock.church', { trip: t.id, player: d.player });
      closeSheet();
      if (n) toast(`⛪ ${playerName(d.player)} got ${num(n)} back!`, true);
      break;
    }
    case 'zombie': {
      record('zombie.add', { trip: t.id, player: d.player, animal: d.animal, n: 1 });
      const z = ZOMBIES.find(x => x.id === d.animal);
      toast(`🧟 ${z.icon} for ${playerName(d.player)}`);
      break;
    }
    case 'volvo': volvoSheet(d.player, d.color); break;
    case 'volvo-yes':
      record('volvo.add', { trip: t.id, player: d.player, color: d.color, branded: d.branded === '1' });
      closeSheet();
      toast(`🚚 ${esc(volvoName(d.color, d.branded === '1'))}!`);
      break;
    case 'undo': {
      const e = lastUndoable(db.events, state, t.id, d.player, d.game);
      if (!e) { toast('Nothing to undo'); break; }
      record('undo', { target: e.id });
      toast('Undone');
      break;
    }
    case 'plate': plateSheet(d.plate); break;
    case 'unspot': record('undo', { target: d.event }); closeSheet(); break;
    case 'new-trip': newTripSheet(); break;
    case 'add-player-inline': {
      const name = $('#new-player-name').value.trim();
      if (!name) break;
      const keep = [...document.querySelectorAll('.pick input:checked')].map(i => i.value);
      const pid = newId();
      const tripName = $('#trip-name-in').value;
      record('player.add', { id: pid, name, color: PLAYER_COLORS[state.playerOrder.length % PLAYER_COLORS.length] });
      newTripSheet();
      $('#trip-name-in').value = tripName;
      document.querySelectorAll('.pick input').forEach(i => { i.checked = keep.includes(i.value) || (i.value === pid && keep.length < MAX_PLAYERS); });
      break;
    }
    case 'start-trip': {
      const players = [...document.querySelectorAll('.pick input:checked')].map(i => i.value);
      if (!players.length) { toast('Pick at least one player'); break; }
      if (players.length > MAX_PLAYERS) { toast(`Up to ${MAX_PLAYERS} players`); break; }
      if (t) record('trip.end', { id: t.id });
      record('trip.start', { id: newId(), name: $('#trip-name-in').value.trim() || 'Road trip', players });
      closeSheet();
      db.mode = 'compete';
      db.tab = 'flocks';
      render();
      startGeo();
      break;
    }
    case 'end-trip':
      sheet(`<h2>End ${esc(t.name)}?</h2><p>This crowns the winners and locks the scores. You can't add to it afterwards.</p>
        <div class="row"><button class="primary big" data-act="end-yes">End the trip</button><button class="ghost" data-act="close">Not yet</button></div>`);
      break;
    case 'end-yes': {
      record('trip.end', { id: t.id });
      closeSheet();
      const done = state.trips[t.id];
      const lines = CONTESTS.map(c => done.winners[c.id].length ? `${c.icon} ${done.winners[c.id].map(playerName).join(' & ')}` : '').filter(Boolean);
      toast(lines.length ? `🏆 ${lines.join(' · ')}` : 'Trip ended', true);
      break;
    }
    case 'add-player': playerSheet(null); break;
    case 'edit-player': playerSheet(d.player); break;
    case 'save-player': {
      const name = $('#pname').value.trim();
      if (!name) { toast('Type a name'); break; }
      const color = (document.querySelector('input[name=pcolor]:checked') || {}).value;
      if (d.player) record('player.edit', { id: d.player, name, color, hidden: $('#phidden').checked });
      else record('player.add', { id: newId(), name, color });
      closeSheet();
      break;
    }
    case 'sync': sync().then(() => toast(pending().length ? 'Couldn\'t reach home' : 'Saved at home')); break;
    case 'theme':
      db.theme = isDark() ? 'light' : 'dark';
      save();
      applyTheme();
      render();
      break;
    case 'close': closeSheet(); break;
  }
}

// ---------- Start ----------

load();
applyTheme();
document.addEventListener('click', onClick);
document.addEventListener('change', ev => {
  if (ev.target.id === 'map-trip') { db.mapTrip = ev.target.value; mapView = null; save(); render(); }
});
$('#sheet').addEventListener('click', ev => { if (ev.target.id === 'sheet') closeSheet(); });
refresh(known);
if (state.activeTrip || !window.isSecureContext) startGeo();
sync();
loadStatus();
setInterval(sync, 10000);
setInterval(renderSync, 5000);
window.addEventListener('online', sync);
document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
// Keep a copy of the page on the iPad for opening it with no signal. Browsers
// only allow this on the secure (https) address.
if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('sw.js').catch(() => {});
