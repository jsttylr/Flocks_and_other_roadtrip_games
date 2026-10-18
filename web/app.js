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
  const lines = [];
  for (const n of state.newAwards) {
    const p = state.players[n.player];
    if (!p) continue;
    if (n.level) { lines.push(`⭐ ${esc(p.name)} reached <b>level ${n.level.level}</b>, ${n.level.title}!`); continue; }
    const a = AWARDS.find(x => x.id === n.award);
    if (a) lines.push(`${a.icon} ${esc(p.name)} earned <b>${a.name}</b>${n.count > 1 ? ` (×${n.count})` : ''}!`);
  }
  if (lines.length) toast(lines.join('<br>'), true);
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
    noteHex();
  }, err => {
    geoState = err.code === 1 ? 'denied' : 'searching';
  }, { enableHighAccuracy: true, maximumAge: 30000, timeout: 60000 });
}

// Driving into a tile this trip hasn't touched yet is saved, so the map and
// the explorer scores count the road travelled, not just the sightings.
const sentHexes = new Set();
function noteHex() {
  const t = state && state.activeTrip;
  if (!t || !fix || fix.acc > 300) return;
  const key = hexAt(fix.lat, fix.lon);
  if (t.hexHits.includes(key) || sentHexes.has(t.id + key)) return;
  sentHexes.add(t.id + key);
  record('trip.hex', { trip: t.id, loc: { lat: fix.lat, lon: fix.lon } });
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
const COMMON_TABS = [['map', '🗺️ Map'], ['realm', '🏰 Realm'], ['stats', '📊 Stats'], ['awards', '🏅 Awards'], ['setup', '⚙️ Trips & players']];

function render() {
  const tabs = [...MODE_TABS[db.mode], ...COMMON_TABS];
  if (!tabs.some(([id]) => id === db.tab)) db.tab = tabs[0][0];
  $('#theme').textContent = isDark() ? '☀️ Day' : '🌙 Night';
  $('#mode').innerHTML = `<button class="${db.mode === 'compete' ? 'on' : ''}" data-mode="compete">🏁 Competitive</button><button class="${db.mode === 'together' ? 'on' : ''}" data-mode="together">🤝 Together</button>`;
  $('#tabs').innerHTML = tabs.map(([id, label]) => `<button class="tab${db.tab === id ? ' on' : ''}" data-tab="${id}">${label}</button>`).join('');
  const t = state.activeTrip;
  $('#trip-name').textContent = t ? t.name : 'No trip going';
  const view = { flocks: viewFlocks, zombies: viewZombies, volvos: viewVolvos, plates: viewPlates, map: viewMap, stats: viewStats, awards: viewAwards, setup: viewSetup, realm: viewRealm }[db.tab];
  dropMap();
  $('#main').innerHTML = view();
  if (db.tab === 'map') drawMap();
  if (db.tab === 'realm') drawRealm();
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
  const lead = leaderOf(t, tp => tp.volvoPoints);
  return panels(t, (pid, tp, p) => `
    <header><span class="pname">${esc(p.name)}</span>${lead(pid) ? '<span class="crown">👑</span>' : ''}</header>
    <div class="score">${num(tp.volvoPoints)}</div>
    <div class="sub">points · ${plural(tp.volvos, 'truck', 'trucks')}, ${num(tp.volvoBranded)} with VOLVO (double)</div>
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
  const special = seen.filter(k => PLATES[k] && PLATES[k].country === 'X').length;
  return `<div class="card plate-head">
      <div><b class="bignum">${states}</b> of 50 states${t.plates.DC ? ' + DC' : ''}${canada ? ` · ${canada} Canadian` : ''}${special ? ` · ${special} special` : ''}</div>
      <div class="muted">The whole car plays together. Tap a plate when anyone sees it.</div>
      <div class="bar"><div style="width:${states * 2}%"></div></div>
    </div>` + PLATE_REGIONS.map(r => `<h3 class="region">${r.name}</h3><div class="plates">` + r.plates.map(([code, name]) => {
    const key = plateKey(r, code);
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
  if (map) { mapView = { c: map.getCenter(), z: map.getZoom(), trip: map.tripId }; map.remove(); map = null; }
}

function drawMap() {
  const el = $('#map');
  if (!el || typeof L === 'undefined') return;
  const t = state.trips[db.mapTrip];
  map = L.map(el);
  map.tripId = db.mapTrip;
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
  // The page may still be settling its layout; measure again once it has.
  const m = map;
  requestAnimationFrame(() => {
    if (m !== map) return;
    m.invalidateSize();
    if (!(mapView && mapView.trip === db.mapTrip) && pts.length) m.fitBounds(pts, { padding: [40, 40], maxZoom: 14 });
  });
}

// ---------- The Realm ----------
// The after-the-trip game: claim the map, trade, and build. The rules live in games.js.

const DIRS = ['east', 'north-east', 'north-west', 'west', 'south-west', 'south-east'];
const purseOf = pid => state.realm.purse[pid] || {};
const costText = cost => Object.entries(cost).map(([k, n]) => `${n}${RESOURCES.find(r => r.id === k).icon}`).join(' ');
function realmPlayer() {
  const now = realmCurrent(state.realm);
  if (now) return now;
  const pids = visiblePlayers();
  if (!pids.includes(db.realmPlayer)) db.realmPlayer = pids[0];
  return db.realmPlayer;
}

function viewRealm() {
  const pids = visiblePlayers();
  if (!pids.length) return `<div class="card center"><p>Add players under Trips &amp; players first.</p></div>`;
  const r = state.realm, me = realmPlayer(), hexes = Object.keys(r.hexes).length;
  const board = pids.map(pid => {
    const p = purseOf(pid);
    return `<tr class="${pid === me ? 'me' : ''}"><td>${dot(pid)}${playerName(pid)}</td><td class="pts">${r.points[pid] || 0}</td>
      ${RESOURCES.map(x => `<td>${p[x.id] || 0}</td>`).join('')}
      <td>${r.land[pid] || 0}${r.biggest === pid ? ' 👑' : ''}</td><td>${r.roadLength[pid] || 0}${r.longest === pid ? ' 👑' : ''}</td><td class="rank">${realmRank(r.points[pid] || 0).title}</td></tr>`;
  }).join('');
  return `<div class="card realm-head">
      <h2>🏰 The Realm</h2>
      <p class="muted">Every sighting with a location claims a hex of the real map. Hexes go to whoever has spotted the most there. When a trip ends, everyone gets paid in resources to build with.</p>
      ${r.turn ? `<div class="turn" style="--pc:${state.players[me].color}"><div><b>${playerName(me)}'s turn</b> <span class="muted">round ${r.turn.round} · next up ${playerName(r.turn.order[(r.turn.i + 1) % r.turn.order.length])}</span>
          <div class="muted">Build, trade or both, then pass the iPad on. Order: ${r.turn.order.map(playerName).join(' → ')}</div></div>
          <button class="primary" data-act="realm-pass" data-player="${me}">✅ End turn</button></div>`
        : `<div class="who">${pids.map(pid => `<button class="${pid === me ? 'on' : ''}" style="--pc:${state.players[pid].color}" data-act="realm-who" data-player="${pid}">${playerName(pid)}</button>`).join('')}</div>`}
      <div class="scroll"><table class="stats realm"><thead><tr><th></th><th>Points</th>${RESOURCES.map(x => `<th title="${x.name}">${x.icon}</th>`).join('')}<th>Land</th><th>Road</th><th>Rank</th></tr></thead><tbody>${board}</tbody></table></div>
      <div class="row"><button data-act="realm-trade">🤝 Trade</button><button data-act="realm-bank">🏦 Bank ${BANK_RATE} for 1</button><button class="ghost" data-act="undo" data-game="realm" data-player="">↩ Undo</button><button class="ghost" data-act="realm-rules">❓ How to play</button></div>
    </div>
    ${exploreCard(pids)}
    ${hexes ? `<p class="muted center">Tap a hex to build as <b>${playerName(me)}</b>.</p><div id="realm-map" class="map realm-map"></div>` :
      `<div class="card center"><p>The board is empty. Sightings made on the secure address (with GPS) claim hexes on the map.</p></div>`}`;
}

function exploreCard(pids) {
  const score = pid => exploreScore(state.life[pid].explore);
  const sorted = [...pids].sort((a, b) => score(b) - score(a));
  const scores = [...new Set(sorted.map(score))];
  const rows = sorted.map(pid => {
    const x = state.life[pid].explore, n = score(pid), rk = exploreRank(n), place = scores.indexOf(n);
    const pct = rk.next ? Math.round(100 * (n - rk.from) / (rk.next.tiles - rk.from)) : 100;
    return `<div class="explorer"><span class="place">${['🥇', '🥈', '🥉'][place] || place + 1}</span><div>${dot(pid)}<b>${playerName(pid)}</b> · <span class="rank">${rk.title}</span> · <b>${num(n)}</b> <span class="muted">points</span></div>
      <span class="muted">${plural(x.tiles, 'new tile', 'new tiles')} · ${x.pioneered} pioneered · farthest ${num(x.farthest)} km from home</span>
      <div class="bar"><div style="width:${pct}%"></div></div>
      <span class="muted small">${rk.next ? `${rk.next.tiles - n} more for ${rk.next.title}` : 'Top rank!'}</span></div>`;
  }).join('');
  return `<div class="card"><h2>🧭 Explorers</h2>
    <p class="muted">Every tile the family has never been to is worth a point to everyone in the car, whether you spot something there or just drive through (with GPS on). Spot something first in a new tile to pioneer it for 2 bonus points.</p>${rows}</div>`;
}

function drawRealm() {
  const el = $('#realm-map');
  if (!el || typeof L === 'undefined') return;
  const r = state.realm;
  map = L.map(el);
  map.tripId = 'realm';
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);
  const all = [];
  for (const [key, h] of Object.entries(r.hexes)) {
    const g = hexCorners(key), owner = h.owner && state.players[h.owner];
    all.push(...g.corners);
    L.polygon(g.corners, { color: owner ? owner.color : '#777', weight: 2, fillColor: owner ? owner.color : '#999', fillOpacity: owner ? 0.35 : 0.12 })
      .addTo(map).on('click', () => realmHexSheet(key));
    const b = h.building && state.players[h.building.player];
    const label = b ? `<span class="rb" style="background:${b.color}">${BUILDINGS[h.building.kind].icon}</span>` : `<span class="rt">${h.terrain ? TERRAIN[h.terrain].split(' ')[0] : ''}</span>`;
    L.marker(g.center, { icon: L.divIcon({ className: 'hexlabel', html: label, iconSize: [36, 36], iconAnchor: [18, 18] }) }).addTo(map).on('click', () => realmHexSheet(key));
  }
  for (const [k, road] of Object.entries(r.roads)) {
    const [a, b] = k.split('|'), p = state.players[road.player];
    L.polyline([hexCorners(a).center, hexCorners(b).center], { color: p ? p.color : '#333', weight: 7, opacity: 0.9, lineCap: 'round' }).addTo(map);
  }
  if (mapView && mapView.trip === 'realm') map.setView(mapView.c, mapView.z);
  else map.fitBounds(all, { padding: [30, 30], maxZoom: 10 });
  const m = map;
  requestAnimationFrame(() => { if (m === map) m.invalidateSize(); });
}

function realmHexSheet(key) {
  const r = state.realm, h = r.hexes[key], me = realmPlayer(), purse = purseOf(me);
  const owner = h.owner ? playerName(h.owner) : 'nobody yet';
  const counts = Object.entries(h.counts).sort((a, b) => b[1] - a[1]).map(([p, n]) => `${playerName(p)} ${n}`).join(', ') || 'none by a player';
  const opts = [];
  const btn = (label, cost, data) => {
    const ok = canPay(purse, cost);
    opts.push(`<button class="${ok ? 'primary' : ''}" ${ok ? '' : 'disabled'} data-act="realm-build" ${data}>${label} <span class="cost">${costText(cost)}</span></button>`);
  };
  if (!h.building && canSettle(r, me, key)) btn('🏠 Build a settlement', BUILDINGS.settlement.cost, `data-kind="settlement" data-hex="${key}"`);
  if (h.building && h.building.player === me && h.building.kind === 'settlement') btn('🏰 Grow into a city', BUILDINGS.city.cost, `data-kind="city" data-hex="${key}"`);
  hexNeighbors(key).forEach((n, i) => { if (canRoad(r, me, key, n)) btn(`🛣️ Road ${DIRS[i]}`, BUILDINGS.road.cost, `data-kind="road" data-hex="${key}" data-to="${n}"`); });
  const b = h.building;
  sheet(`<h2>${h.terrain ? TERRAIN[h.terrain] : 'Open country'}</h2>
    <p>Held by <b>${owner}</b>. Sightings here: ${counts}.</p>
    ${b ? `<p>${BUILDINGS[b.kind].icon} ${playerName(b.player)}'s ${BUILDINGS[b.kind].name.toLowerCase()}, built ${fmtDate(b.ts)}. It harvests ${b.kind === 'city' ? 2 : 1} ${h.terrain ? RESOURCES.find(x => x.id === h.terrain).icon : ''} after every trip that drives through here.</p>` : ''}
    <h3>${dot(me)}${playerName(me)} can</h3>
    ${opts.length ? `<div class="stack">${opts.join('')}</div>` : `<p class="muted">Nothing to build here yet. Settle hexes you hold, or ones your roads reach. Roads run from your settlements and roads.</p>`}
    <p class="muted">You have ${RESOURCES.map(x => `${purse[x.id] || 0}${x.icon}`).join(' ')}</p>`);
}

function bundleRows(prefix) {
  return RESOURCES.map(x => `<label class="res">${x.icon} ${x.name}<input type="number" min="0" max="99" value="0" inputmode="numeric" id="${prefix}-${x.id}"></label>`).join('');
}
function readBundle(prefix) {
  const out = {};
  for (const x of RESOURCES) { const n = parseInt(($('#' + prefix + '-' + x.id) || {}).value, 10); if (n > 0) out[x.id] = n; }
  return out;
}

function realmTradeSheet() {
  const me = realmPlayer(), others = visiblePlayers().filter(p => p !== me);
  if (!others.length) { toast('Nobody to trade with'); return; }
  sheet(`<h2>🤝 ${playerName(me)} trades</h2>
    <label>With <select id="trade-with">${others.map(p => `<option value="${p}">${playerName(p)}</option>`).join('')}</select></label>
    <div class="trade"><div><h3>${playerName(me)} gives</h3>${bundleRows('give')}</div><div><h3>and gets</h3>${bundleRows('get')}</div></div>
    <p class="muted">Agree on it in the car first. Both players need what they're giving.</p>
    <div class="row"><button class="primary" data-act="realm-trade-yes">Shake on it</button><button class="ghost" data-act="close">Cancel</button></div>`);
}

function realmBankSheet() {
  const me = realmPlayer();
  const pick = id => `<div class="who">${RESOURCES.map((x, i) => `<label class="chip"><input type="radio" name="${id}" value="${x.id}" ${i === 0 ? 'checked' : ''}> ${x.icon} ${x.name}</label>`).join('')}</div>`;
  sheet(`<h2>🏦 The bank</h2><p>${playerName(me)} gives ${BANK_RATE} of one resource for 1 of another.</p>
    <h3>Give ${BANK_RATE}</h3>${pick('bank-give')}<h3>Get 1</h3>${pick('bank-get')}
    <div class="row"><button class="primary" data-act="realm-bank-yes">Trade with the bank</button><button class="ghost" data-act="close">Cancel</button></div>`);
}

function realmRulesSheet() {
  sheet(`<h2>❓ How the Realm works</h2>
    <ul class="rules">
      <li><b>Claim the map.</b> Every sighting with a location lands on a hex about 20 km across. Whoever has spotted the most in a hex holds it. The board grows with every trip.</li>
      <li><b>Get paid after the trip.</b> When a trip ends, everyone gets one of each resource for coming along, plus ${RESOURCES.map(x => `${x.icon} 1 for every ${EARN_EVERY[x.id] === 1 ? '' : EARN_EVERY[x.id] + ' '}${x.from}`).join(', ')}.</li>
      <li><b>Cemeteries are the robber.</b> Whoever calls a cemetery takes one resource from each flock they killed when the trip's pay comes in.</li>
      <li><b>Build.</b> ${Object.values(BUILDINGS).map(b => `${b.icon} ${b.name}: ${costText(b.cost)}`).join(' · ')}. Settle a hex you hold or one your road reaches. Roads run between neighbouring hexes from your settlements and roads.</li>
      <li><b>Harvest.</b> After every trip that passes through a settled hex, its owner gets 1 of that hex's resource (2 for a city).</li>
      <li><b>Take turns.</b> After every trip a new round starts, and whoever did worst on the trip goes first. On your turn, build and trade as much as you can afford, then tap <b>End turn</b> and pass the iPad. Rounds keep going until the next trip.</li>
      <li><b>Trade.</b> On your turn, swap with anyone who agrees, or with the bank at ${BANK_RATE} for 1.</li>
      <li><b>Ranks.</b> ${REALM_RANKS.map(([n, t]) => `${t} ${n}`).join(' · ')} Realm points. Realm awards count toward your level like every other award.</li>
      <li><b>Points.</b> Settlement 1, city 2. Longest Road (at least ${LONGEST_ROAD_MIN} in a row) and Biggest Territory (at least ${BIGGEST_LAND_MIN} hexes) are worth 2 each.</li>
    </ul>
    <div class="row"><button class="ghost" data-act="close">Got it</button></div>`);
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
    ['Volvo points', l => l.volvoPoints],
    ['Volvo trucks spotted', l => l.volvos],
    [sub('with VOLVO on the fairing'), l => l.volvoBranded],
    ...VOLVO_COLORS.map(c => [sub(`${swatch(c)}${c.name}`), l => l.volvoBy[c.id] || 0]),
  ]);

  const everPlates = new Set();
  for (const pid of state.playerOrder) for (const k of state.life[pid].uniquePlates) everPlates.add(k);
  const plates = `<div class="card"><h2>🚗 License plates, all-time</h2><p><b>${US_STATES.filter(s => everPlates.has(s)).length}</b> of 50 states seen${everPlates.has('DC') ? ' + DC' : ''} · <b>${[...everPlates].filter(k => k.startsWith('CA-')).length}</b> Canadian · <b>${[...everPlates].filter(k => PLATES[k] && PLATES[k].country === 'X').length}</b> of ${Object.values(PLATES).filter(x => x.country === 'X').length} special</p>
    <p class="muted">Never seen yet: ${US_STATES.filter(s => !everPlates.has(s)).map(s => PLATES[s].name).join(', ') || 'nothing. You\'ve seen them all!'}</p></div>`;

  const win = (t, id) => t.end ? (t.winners[id].map(playerName).join(' & ') || '–') : '…';
  const history = `<div class="card scroll"><h2>Trips</h2><table class="stats trips"><thead><tr><th>Trip</th><th>When</th><th>🐄 Flocks</th><th>🧟 Zombies</th><th>🚚 Volvos</th><th>🚗 Plates</th><th></th></tr></thead><tbody>` +
    allTrips().map(t => `<tr><td>${esc(t.name)}${t.end ? '' : ' <span class="live">playing</span>'}</td><td>${fmtDate(t.start)}</td>
      <td>${win(t, 'flocks')}</td><td>${win(t, 'zombies')}</td><td>${win(t, 'volvos')}</td>
      <td>${US_STATES.filter(s => t.plates[s]).length} states</td>
      <td>${t.end ? `<button class="ghost small" data-act="trip-certs" data-trip="${t.id}">🎓 Certificates</button>` : ''}</td></tr>`).join('') +
    `</tbody></table></div>`;
  return flocks + zombies + volvos + plates + history;
}

function viewAwards() {
  const pids = visiblePlayers();
  if (!pids.length) return `<div class="card center"><p>Add players under Trips &amp; players first.</p></div>`;
  return pids.map(pid => {
    const l = state.life[pid];
    const lv = levelFor(l.badges);
    const earned = AWARDS.filter(a => l.awards[a.id]).length;
    const shown = AWARDS.filter(a => !a.hidden || l.awards[a.id]);
    const secret = AWARDS.length - shown.length;
    const when = w => { const trip = w.trip && state.trips[w.trip]; return `${fmtDate(w.ts)}${trip ? ' · ' + esc(trip.name) : ''}`; };
    return `<div class="card"><h2>${dot(pid)}${playerName(pid)} <span class="muted">${earned} of ${AWARDS.length} awards</span></h2>
      <div class="level"><span class="lvl">${lv.level}</span><div><b>Level ${lv.level} · ${lv.title}</b>
        <div class="muted">${plural(l.badges, 'award', 'awards')} earned, repeats included. ${plural(lv.to - l.badges, 'more', 'more')} for level ${lv.level + 1}.</div>
        <div class="bar"><div style="width:${Math.round(100 * (l.badges - lv.from) / (lv.to - lv.from))}%"></div></div></div>
        <button class="ghost" data-act="cert-level" data-player="${pid}">🎓 Level certificate</button></div>
      <p class="muted tip">Tap an earned award to print its certificate.</p>
      <div class="awards">` +
      shown.map(a => {
        const got = l.awards[a.id];
        const times = got && got.count > 1 ? `<span class="times">×${got.count}</span>` : '';
        return `<div class="award${got ? ' got' : ''}"${got ? ` data-act="cert-award" data-player="${pid}" data-award="${a.id}" title="Print a certificate"` : ''}><div class="aicon">${a.icon}</div><div><b>${a.name}</b>${times}<div class="muted">${a.desc}${a.repeat ? ' <span class="again">↻ every trip</span>' : ''}</div>
          ${got ? `<div class="when">${got.count > 1 ? 'First ' + when(got) + '; last ' + when(got.last) : when(got)}</div>` : ''}</div></div>`;
      }).join('') +
      (secret ? `<div class="award secret"><div class="aicon">❔</div><div><b>${plural(secret, 'hidden award', 'hidden awards')}</b><div class="muted">Keep playing to find out. Zombies know a few.</div></div></div>` : '') +
      `</div></div>`;
  }).join('');
}

// ---------- Certificates ----------
// A printable page for an award, a level or a trip. It's ordinary HTML laid
// out as a landscape letter page; Print (or Share, Print, then pinch out) on
// the iPad saves it as a PDF.

function signer() { return { name: db.signer || 'Skippy the Magnificent', title: db.signerTitle || 'Chief Road Trip Officer' }; }
const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
const longDate = ts => new Date(ts).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });

const CERT_THEMES = {
  flocks: ['#22c55e', '#facc15', '#15803d', '#f59e0b'],
  zombies: ['#a855f7', '#84cc16', '#6d28d9', '#65a30d'],
  volvos: ['#3b82f6', '#f97316', '#1d4ed8', '#ea580c'],
  plates: ['#ef4444', '#3b82f6', '#b91c1c', '#1d4ed8'],
  trips: ['#06b6d4', '#8b5cf6', '#0e7490', '#7c3aed'],
  level: ['#f43f5e', '#f59e0b', '#be123c', '#7c3aed'],
  realm: ['#f59e0b', '#10b981', '#b45309', '#047857'],
  explore: ['#0ea5e9', '#22d3ee', '#0369a1', '#0891b2'],
};

// Confetti scattered round the page, the same every time for the same name.
function confetti(seedText, colors) {
  let seed = 7;
  for (const ch of seedText) seed = (seed * 31 + ch.charCodeAt(0)) % 2147483647;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let out = '';
  for (let i = 0; i < 70; i++) {
    const x = rnd() * 1100, y = rnd() * 850, r = rnd() * 360, c = colors[i % colors.length], k = rnd();
    const t = `transform="translate(${x.toFixed(0)} ${y.toFixed(0)}) rotate(${r.toFixed(0)})" fill="${c}"`;
    if (k < 0.3) out += `<rect ${t} x="-9" y="-4" width="18" height="8" rx="2"/>`;
    else if (k < 0.55) out += `<circle ${t} r="${(4 + rnd() * 6).toFixed(1)}"/>`;
    else if (k < 0.75) out += `<path ${t} d="M0,-11 L3,-3 11,-3 5,2 7,10 0,5 -7,10 -5,2 -11,-3 -3,-3Z"/>`;
    else out += `<path ${t.replace(`fill="${c}"`, `fill="none" stroke="${c}"`)} stroke-width="4" stroke-linecap="round" d="M-14,0 q5,-8 10,0 t10,0 t10,0"/>`;
  }
  return `<svg class="c-confetti" viewBox="0 0 1100 850" preserveAspectRatio="none" aria-hidden="true">${out}</svg>`;
}

function starburst(level, colors) {
  const pts = [];
  for (let i = 0; i < 32; i++) {
    const a = (Math.PI * 2 * i) / 32, r = i % 2 ? 40 : 50;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`);
  }
  return `<div class="c-burst"><svg viewBox="0 0 100 100" aria-hidden="true"><polygon points="${pts.join(' ')}" fill="${colors[1]}" stroke="#fff" stroke-width="2.5"/><circle cx="50" cy="50" r="33" fill="${colors[2]}" stroke="#fff" stroke-width="2"/></svg>
    <div class="c-burst-in"><small>LEVEL</small><b>${level.level}</b><small>${esc(level.title)}</small></div></div>`;
}

function certPage({ kind, name, intro, icon, title, desc, ribbons = [], body = '', when, level, theme = 'trips' }) {
  const sg = signer(), c = CERT_THEMES[theme] || CERT_THEMES.trips;
  const confettiColors = [c[0], c[1], '#ec4899', '#facc15', '#38bdf8', '#ffffff'];
  const bits = confetti(name + title, confettiColors);
  return `<div class="cert" style="--g1:${c[0]};--g2:${c[1]};--a1:${c[2]};--a2:${c[3]}">${bits}<div class="cert-in">${bits}
    <div class="c-brand">🚙 Roadtrip Games</div>
    <div class="c-kind">${kind}</div>
    <div class="c-hero"><span class="c-rays"></span><span class="c-icon">${icon || '⭐'}</span></div>
    <div class="c-banner"><span>${title}</span></div>
    ${desc ? `<div class="c-desc">${desc}</div>` : ''}
    <div class="c-small">${intro}</div>
    <div class="c-name">${esc(name)}</div>
    ${ribbons.length ? `<div class="c-ribbons">${ribbons.map(r => `<span>${esc(r)}</span>`).join('')}</div>` : ''}
    ${body}
    ${when ? `<div class="c-when">${when}</div>` : ''}
    <div class="c-foot">
      <div class="c-sig"><div class="c-sig-name">${esc(sg.name)}</div><div class="c-sig-line"></div><div class="c-sig-title">${esc(sg.title)}</div></div>
      ${starburst(level, c)}
      <div class="c-sig"><div class="c-sig-name">&nbsp;</div><div class="c-sig-line"></div><div class="c-sig-title">Grown-up in charge</div></div>
    </div></div></div>`;
}

function awardCert(pid, awardId, tripId) {
  const a = AWARDS.find(x => x.id === awardId), l = state.life[pid], got = l.awards[awardId];
  if (!a || !got) return '';
  const tid = tripId || (got.last && got.last.trip) || got.trip;
  const trip = tid && state.trips[tid];
  const n = a.repeat && trip ? got.trips.indexOf(tid) + 1 : 0;
  const at = trip ? (trip.awards.find(x => x.player === pid && x.award === awardId) || {}).ts : got.ts;
  const lvl = levelFor(trip && trip.end && trip.badgesAtEnd[pid] !== undefined ? trip.badgesAtEnd[pid] : l.badges);
  return certPage({
    kind: a.hidden ? 'Secret award unlocked!' : 'Award unlocked!', theme: a.game === 'trips' ? 'trips' : a.game,
    name: state.players[pid].name, intro: 'Officially awarded to', icon: a.icon,
    title: esc(a.name) + (n > 1 ? ` <span class="c-times">×${n}</span>` : ''),
    desc: esc(a.desc), ribbons: trip ? endorsements(trip, pid, a.game) : [],
    when: `${trip ? `On the trip “${esc(trip.name)}”, ` : ''}${longDate(at || got.ts)}`, level: lvl,
  });
}

function levelCert(pid) {
  const l = state.life[pid], lv = levelFor(l.badges);
  const wins = l.wins.flocks + l.wins.zombies + l.wins.volvos;
  const ribbons = [plural(l.trips, 'trip', 'trips'), plural(wins, 'win', 'wins'), plural(Object.keys(l.awards).length, 'different award', 'different awards')];
  return certPage({
    kind: 'Level up!', theme: 'level', name: state.players[pid].name, intro: 'Promoted with honours:', icon: '🚀',
    title: `Level ${lv.level} · ${esc(lv.title)}`, desc: `By earning ${plural(l.badges, 'award', 'awards')} on the road, repeats included`,
    ribbons, when: longDate(Date.now()), level: lv,
  });
}

function tripCert(pid, tripId) {
  const trip = state.trips[tripId], tp = trip.by[pid];
  const medal = c => {
    const scores = [...new Set(trip.players.map(p => c.score(trip.by[p])))].sort((a, b) => b - a);
    const i = scores.indexOf(c.score(tp));
    return c.score(tp) > 0 ? ['🥇', '🥈', '🥉'][i] || '' : '';
  };
  const rows = CONTESTS.map(c => `<tr><td>${c.icon} ${c.name}</td><td>${num(c.score(tp))}${c.id === 'volvos' ? ' points' : ''}</td><td>${medal(c)}</td></tr>`).join('') +
    `<tr><td>🚗 Plates (the whole car)</td><td>${US_STATES.filter(s => trip.plates[s]).length} states</td><td></td></tr>`;
  const mine = trip.awards.filter(x => x.player === pid);
  const icons = [...new Set(mine.map(x => x.award))].map(id => AWARDS.find(a => a.id === id)).filter(Boolean);
  const body = `<table class="c-table">${rows}</table>${icons.length ? `<div class="c-earned">Awards on this trip: ${icons.map(a => `<span>${a.icon} ${esc(a.name)}</span>`).join('')}</div>` : ''}`;
  const ribbons = CONTESTS.flatMap(c => endorsements(trip, pid, c.id).map(r => `${c.icon} ${r}`)).slice(0, 5);
  return certPage({
    kind: 'Road trip legend!', theme: 'trips', name: state.players[pid].name, intro: 'Rode along, played hard and survived:', icon: '🛣️',
    title: `“${esc(trip.name)}”`, ribbons, body,
    when: `${longDate(trip.start)}${trip.end && new Date(trip.end).toDateString() !== new Date(trip.start).toDateString() ? ' to ' + longDate(trip.end) : ''}`,
    level: levelFor(trip.badgesAtEnd[pid] !== undefined ? trip.badgesAtEnd[pid] : state.life[pid].badges),
  });
}

function tripCertsSheet(tripId) {
  const trip = state.trips[tripId];
  if (!trip) return;
  sheet(`<h2>🎓 Certificates for ${esc(trip.name)}</h2><p class="muted">Pick one to print or save as a PDF.</p>` + trip.players.map(pid => {
    const ids = [...new Set(trip.awards.filter(x => x.player === pid).map(x => x.award))];
    return `<h3>${dot(pid)}${playerName(pid)}</h3><div class="row wrap">
      <button data-act="cert-trip" data-player="${pid}" data-trip="${tripId}">🛣️ Trip certificate</button>
      ${ids.map(id => { const a = AWARDS.find(x => x.id === id); return a ? `<button class="ghost" data-act="cert-award" data-player="${pid}" data-award="${id}" data-trip="${tripId}">${a.icon} ${esc(a.name)}</button>` : ''; }).join('')}
    </div>`;
  }).join(''));
}

function showCert(html) {
  if (!html) return;
  const c = $('#cert');
  c.innerHTML = `<div class="cert-bar"><button class="primary" data-act="cert-print">🖨️ Print or save as PDF</button><button class="ghost" data-act="cert-close">Close</button></div>${html}`;
  c.classList.add('open');
  document.body.classList.add('cert-open');
  c.scrollTop = 0;
}
function hideCert() { $('#cert').classList.remove('open'); document.body.classList.remove('cert-open'); }

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
  const certs = `<div class="card"><h2>🎓 Certificates</h2>
    <p class="muted">Every earned award, every level and every finished trip has a certificate to print or save as a PDF: tap an award under Awards, or 🎓 next to a trip under Stats. They're signed by:</p>
    <div class="row"><label class="grow">Name <input id="cert-signer" value="${esc(signer().name)}"></label><label class="grow">Title <input id="cert-signer-title" value="${esc(signer().title)}"></label></div></div>`;
  return trip + players + certs + locationCard() + saving;
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
      <button data-act="volvo-yes" data-player="${pid}" data-color="${color}" data-branded="0">${esc(volvoName(color, false))}<small>1 point</small></button>
      <button data-act="volvo-yes" data-player="${pid}" data-color="${color}" data-branded="1">${esc(volvoName(color, true))}<small>VOLVO on the fairing · double points</small></button>
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
      const e = lastUndoable(db.events, state, t ? t.id : null, d.player, d.game);
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
      tripCertsSheet(t.id);
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
    case 'trip-certs': tripCertsSheet(d.trip); break;
    case 'realm-who': db.realmPlayer = d.player; save(); render(); break;
    case 'realm-pass': {
      record('realm.pass', { player: d.player });
      const next = realmCurrent(state.realm);
      if (next) toast(`🎲 ${playerName(next)}'s turn!`, true);
      break;
    }
    case 'realm-rules': realmRulesSheet(); break;
    case 'realm-trade': realmTradeSheet(); break;
    case 'realm-bank': realmBankSheet(); break;
    case 'realm-build': {
      record('realm.build', { player: realmPlayer(), kind: d.kind, hex: d.hex, to: d.to });
      closeSheet();
      toast(`${BUILDINGS[d.kind].icon} ${playerName(realmPlayer())} built a ${BUILDINGS[d.kind].name.toLowerCase()}!`, true);
      break;
    }
    case 'realm-trade-yes': {
      const give = readBundle('give'), get = readBundle('get'), other = $('#trade-with').value, me = realmPlayer();
      if (!Object.keys(give).length || !Object.keys(get).length) { toast('Pick what each side gives'); break; }
      if (!canPay(purseOf(me), give)) { toast(`${playerName(me)} doesn't have that`); break; }
      if (!canPay(purseOf(other), get)) { toast(`${playerName(other)} doesn't have that`); break; }
      record('realm.trade', { player: me, with: other, give, get });
      closeSheet();
      toast('🤝 Deal!');
      break;
    }
    case 'realm-bank-yes': {
      const g = document.querySelector('input[name=bank-give]:checked').value, w = document.querySelector('input[name=bank-get]:checked').value, me = realmPlayer();
      if (g === w) { toast('Pick two different resources'); break; }
      if (!canPay(purseOf(me), { [g]: BANK_RATE })) { toast(`${playerName(me)} needs ${BANK_RATE} of those`); break; }
      record('realm.trade', { player: me, with: 'bank', give: { [g]: BANK_RATE }, get: { [w]: 1 } });
      closeSheet();
      toast('🏦 Done');
      break;
    }
    case 'cert-trip': closeSheet(); showCert(tripCert(d.player, d.trip)); break;
    case 'cert-award': closeSheet(); showCert(awardCert(d.player, d.award, d.trip)); break;
    case 'cert-level': showCert(levelCert(d.player)); break;
    case 'cert-print': window.print(); break;
    case 'cert-close': hideCert(); break;
    case 'close': closeSheet(); break;
  }
}

// ---------- Start ----------

load();
applyTheme();
document.addEventListener('click', onClick);
document.addEventListener('change', ev => {
  if (ev.target.id === 'map-trip') { db.mapTrip = ev.target.value; mapView = null; save(); render(); }
  if (ev.target.id === 'cert-signer') { db.signer = ev.target.value.trim(); save(); }
  if (ev.target.id === 'cert-signer-title') { db.signerTitle = ev.target.value.trim(); save(); }
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
