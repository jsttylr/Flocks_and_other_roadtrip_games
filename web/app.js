// The tablet side: keeps every event on the tablet, sends them to the home
// server whenever it can reach it, and draws the screens.

// ---------- Saved on the tablet ----------

const KEY = 'roadtrip.v1';
let db = { events: [], seq: 0, tab: 'flocks' }; // events: [{id,type,ts,data,seq?}]
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
  // crypto.randomUUID only works on https pages, and the home server is plain http.
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return Date.now().toString(36) + '-' + Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
}

function record(type, data) {
  const before = known;
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

// ---------- Talking to the home server ----------

let syncing = false, syncTimer = null, lastOK = 0, lastErr = '';

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
      // The home server lost its history (a new install, say). This tablet still
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

// ---------- Helpers ----------

const $ = sel => document.querySelector(sel);
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
function playerName(pid) { const p = state.players[pid]; return p ? esc(p.name) : '?'; }
function dot(pid) { const p = state.players[pid]; return `<span class="dot" style="background:${p ? p.color : '#999'}"></span>`; }
function fmtDate(ts) { return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
function fmtTime(ts) { return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); }
function num(n) { return Number(n || 0).toLocaleString(); }

let toastTimer = null;
function toast(html, big) {
  const t = $('#toast');
  t.innerHTML = html;
  t.className = 'toast show' + (big ? ' big' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, big ? 4000 : 2500);
}

function sheet(html) {
  $('#sheet-body').innerHTML = html;
  $('#sheet').classList.add('open');
}
function closeSheet() { $('#sheet').classList.remove('open'); }

// ---------- Screens ----------

const TABS = [['flocks', '🐄 Flocks'], ['plates', '🚗 Plates'], ['stats', '📊 Stats'], ['awards', '🏅 Awards'], ['setup', '⚙️ Trips & players']];

function render() {
  $('#tabs').innerHTML = TABS.map(([id, label]) => `<button class="tab${db.tab === id ? ' on' : ''}" data-tab="${id}">${label}</button>`).join('');
  const t = state.activeTrip;
  $('#trip-name').textContent = t ? t.name : 'No trip going';
  const view = { flocks: viewFlocks, plates: viewPlates, stats: viewStats, awards: viewAwards, setup: viewSetup }[db.tab] || viewFlocks;
  $('#main').innerHTML = view();
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
  if (lastErr && n) text += ' (no connection)';
  el.className = 'sync ' + cls;
  el.textContent = text;
}

function noTrip() {
  return `<div class="card center"><h2>No trip going right now</h2>
    <p>Start a trip to play. Everyone on the trip plays both Flocks and the license plate game.</p>
    <button class="big primary" data-act="new-trip">Start a trip</button></div>`;
}

function viewFlocks() {
  const t = state.activeTrip;
  if (!t) return noTrip();
  if (!t.players.length) return `<div class="card center"><p>This trip has no players.</p></div>`;
  const leader = Math.max(...t.players.map(pid => t.flocks[pid].score));
  return `<div class="flocks" style="--cols:${Math.min(t.players.length, 4)}">` + t.players.map(pid => {
    const tp = t.flocks[pid], p = state.players[pid];
    const lead = tp.score > 0 && tp.score === leader;
    return `<section class="flock" style="--pc:${p.color}">
      <header><span class="pname">${esc(p.name)}</span>${lead ? '<span class="crown">👑</span>' : ''}</header>
      <div class="score">${num(tp.score)}</div>
      <div class="sub">${num(tp.counted)} counted · ${tp.wipes} ${tp.wipes === 1 ? 'cemetery' : 'cemeteries'}</div>
      <div class="animals">${ANIMALS.map(a => `<button class="animal" data-act="count" data-player="${pid}" data-animal="${a.id}">
        <span class="icon">${a.icon}</span><span>${a.name}</span><span class="n">${num(tp.byAnimal[a.id] || 0)}</span></button>`).join('')}</div>
      <div class="row">
        <button class="danger" data-act="wipe" data-player="${pid}">🪦 Cemetery!</button>
        <button class="ghost" data-act="undo" data-player="${pid}">↩ Undo</button>
      </div>
    </section>`;
  }).join('') + `</div>`;
}

function viewPlates() {
  const t = state.activeTrip;
  if (!t) return noTrip();
  const seen = Object.keys(t.plates);
  const states = US_STATES.filter(s => t.plates[s]).length;
  const canada = seen.filter(k => k.startsWith('CA-')).length;
  const counts = t.players.map(pid => `<span class="chip">${dot(pid)}${playerName(pid)} ${t.flocks[pid].plates.size}</span>`).join('');
  return `<div class="card plate-head">
      <div><b class="bignum">${states}</b> of 50 states${t.plates.DC ? ' + DC' : ''}${canada ? ` · ${canada} Canadian` : ''}</div>
      <div class="chips">${counts}</div>
      <div class="bar"><div style="width:${states * 2}%"></div></div>
    </div>` + PLATE_REGIONS.map(r => `<h3 class="region">${r.name}</h3><div class="plates">` + r.plates.map(([code, name]) => {
    const key = r.country === 'CA' ? 'CA-' + code : code;
    const s = t.plates[key];
    const p = s && state.players[s.player];
    return `<button class="plate${s ? ' seen' : ''}" data-act="plate" data-plate="${key}" ${p ? `style="--pc:${p.color}"` : ''}>
      <span class="code">${code}</span><span class="pl-name">${name}</span>${p ? `<span class="by">${esc(p.name)}</span>` : ''}</button>`;
  }).join('') + `</div>`).join('');
}

function visiblePlayers() { return state.playerOrder.filter(pid => !state.players[pid].hidden); }

function viewStats() {
  const pids = visiblePlayers();
  if (!pids.length) return `<div class="card center"><p>Add players under Trips &amp; players to start keeping stats.</p></div>`;
  const rows = [
    ['Trips', l => l.trips],
    ['Flocks wins', l => l.flockWins],
    ['Animals counted', l => l.animals],
    ...ANIMALS.map(a => [`&nbsp;&nbsp;${a.icon} ${a.name}`, l => l.byAnimal[a.id] || 0]),
    ['Cemeteries', l => l.wipes],
    ['Animals lost to cemeteries', l => l.lost],
    ['Biggest flock at a trip\'s end', l => l.bestFlock],
    ['Biggest single count', l => l.biggest],
    ['Plates spotted first', l => l.plates],
    ['Different plates ever', l => l.uniquePlates.size],
    ['Awards', l => Object.keys(l.awards).length],
  ];
  const lifeTable = `<div class="card scroll"><h2>All-time</h2><table class="stats"><thead><tr><th></th>${pids.map(pid => `<th>${dot(pid)}${playerName(pid)}</th>`).join('')}</tr></thead><tbody>` +
    rows.map(([label, f]) => {
      const vals = pids.map(pid => f(state.life[pid]));
      const best = Math.max(...vals);
      return `<tr><td>${label}</td>${vals.map(v => `<td class="${v > 0 && v === best && pids.length > 1 ? 'best' : ''}">${num(v)}</td>`).join('')}</tr>`;
    }).join('') + `</tbody></table></div>`;

  const everPlates = new Set();
  for (const pid of state.playerOrder) for (const k of state.life[pid].uniquePlates) everPlates.add(k);
  const family = `<div class="card"><h2>The whole car, all-time</h2><p><b>${state.tripOrder.length}</b> trips · <b>${US_STATES.filter(s => everPlates.has(s)).length}</b> of 50 states seen${everPlates.has('DC') ? ' + DC' : ''} · <b>${[...everPlates].filter(k => k.startsWith('CA-')).length}</b> Canadian</p>
    <p class="muted">Still never seen: ${US_STATES.filter(s => !everPlates.has(s)).map(s => PLATES[s].name).join(', ') || 'nothing. You\'ve seen them all!'}</p></div>`;

  const trips = [...state.tripOrder].reverse().map(id => state.trips[id]);
  const history = `<div class="card scroll"><h2>Trips</h2><table class="stats trips"><thead><tr><th>Trip</th><th>When</th><th>Flocks</th><th>Plates</th><th>Winner</th></tr></thead><tbody>` +
    trips.map(t => `<tr><td>${esc(t.name)}${t.end ? '' : ' <span class="live">playing</span>'}</td><td>${fmtDate(t.start)}</td>
      <td>${t.players.map(pid => `${dot(pid)}${num(t.flocks[pid].score)}`).join(' ')}</td>
      <td>${US_STATES.filter(s => t.plates[s]).length} states</td>
      <td>${t.end ? (t.winners.map(playerName).join(' & ') || 'nobody') : '–'}</td></tr>`).join('') +
    `</tbody></table></div>`;
  return lifeTable + family + history;
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

function viewSetup() {
  const t = state.activeTrip;
  const trip = t
    ? `<div class="card"><h2>Playing: ${esc(t.name)}</h2><p>Started ${fmtDate(t.start)} at ${fmtTime(t.start)} with ${t.players.map(playerName).join(', ')}.</p>
        <button class="big" data-act="end-trip">🏁 End this trip</button>
        <p class="muted">Ending the trip crowns the Flocks winner and locks in the scores.</p></div>`
    : `<div class="card"><h2>No trip going</h2><button class="big primary" data-act="new-trip">Start a trip</button></div>`;
  const players = `<div class="card"><h2>Players</h2><div class="plist">` + state.playerOrder.map(pid => {
    const p = state.players[pid];
    return `<div class="prow${p.hidden ? ' hidden' : ''}">${dot(pid)}<span class="grow">${esc(p.name)}</span>
      <button class="ghost" data-act="edit-player" data-player="${pid}">Change</button></div>`;
  }).join('') + `</div><button data-act="add-player">+ Add a player</button></div>`;
  const status = `<div class="card"><h2>Saving</h2><p id="sync-detail">${syncDetail()}</p>
    <p class="muted">Everything is kept on this tablet as you play, so you don't need a signal in the car. It's sent to the home server the next time this tablet is on your home Wi-Fi with this page open. Keep this page open (or come back to it) at home after a trip.</p>
    <div class="row"><button data-act="sync">Save at home now</button><a class="button ghost" href="api/backup">Download a backup</a></div></div>`;
  return trip + players + status;
}

function syncDetail() {
  const n = pending().length;
  const parts = [];
  parts.push(n ? `${n} thing${n === 1 ? '' : 's'} on this tablet waiting to be saved at home.` : 'Everything on this tablet is saved at home.');
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

function plateSheet(key) {
  const t = state.activeTrip;
  const pl = PLATES[key];
  const s = t.plates[key];
  if (s) {
    sheet(`<h2>${pl.name}</h2><p>${dot(s.player)}${playerName(s.player)} spotted it at ${fmtTime(s.ts)}.</p>
      <div class="row"><button class="danger" data-act="unspot" data-event="${s.event}">Remove it</button><button class="ghost" data-act="close">Keep it</button></div>`);
    return;
  }
  if (t.players.length === 1) { spot(key, t.players[0]); return; }
  sheet(`<h2>Who spotted ${pl.name}?</h2><div class="who">` +
    t.players.map(pid => `<button style="--pc:${state.players[pid].color}" data-act="spot" data-plate="${key}" data-player="${pid}">${playerName(pid)}</button>`).join('') + `</div>`);
}

function spot(key, pid) {
  record('plate.spot', { trip: state.activeTrip.id, player: pid, plate: key });
  toast(`${PLATES[key].name} for ${playerName(pid)}`);
}

function newTripSheet() {
  const pids = visiblePlayers();
  const d = new Date();
  sheet(`<h2>Start a trip</h2>
    <label>Trip name<input id="trip-name-in" value="Trip on ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}"></label>
    <p>Who's playing?</p>
    <div class="who pick">${pids.map(pid => `<label class="pickp" style="--pc:${state.players[pid].color}"><input type="checkbox" value="${pid}" checked>${playerName(pid)}</label>`).join('') || '<p class="muted">No players yet. Add some below.</p>'}</div>
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
  const b = ev.target.closest('[data-act],[data-tab]');
  if (!b) return;
  if (b.dataset.tab) { db.tab = b.dataset.tab; save(); render(); window.scrollTo(0, 0); return; }
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
    case 'wipe': {
      const tp = t.flocks[d.player];
      sheet(`<h2>🪦 Cemetery on ${playerName(d.player)}'s side?</h2><p>${playerName(d.player)} loses all ${num(tp.score)} in their flock.</p>
        <div class="row"><button class="danger big" data-act="wipe-yes" data-player="${d.player}">Yes, lose the flock</button><button class="ghost" data-act="close">No</button></div>`);
      break;
    }
    case 'wipe-yes':
      record('flock.wipe', { trip: t.id, player: d.player, reason: 'cemetery' });
      closeSheet();
      break;
    case 'undo': {
      const e = lastUndoable(db.events, state, t.id, d.player);
      if (!e) { toast('Nothing to undo'); break; }
      record('undo', { target: e.id });
      toast('Undone');
      break;
    }
    case 'plate': plateSheet(d.plate); break;
    case 'spot': spot(d.plate, d.player); closeSheet(); break;
    case 'unspot': record('undo', { target: d.event }); closeSheet(); break;
    case 'new-trip': newTripSheet(); break;
    case 'add-player-inline': {
      const name = $('#new-player-name').value.trim();
      if (!name) break;
      const keep = [...document.querySelectorAll('.pick input:checked')].map(i => i.value);
      const pid = newId();
      record('player.add', { id: pid, name, color: PLAYER_COLORS[state.playerOrder.length % PLAYER_COLORS.length] });
      const name0 = $('#trip-name-in') ? $('#trip-name-in').value : '';
      newTripSheet();
      $('#trip-name-in').value = name0;
      document.querySelectorAll('.pick input').forEach(i => { i.checked = keep.includes(i.value) || i.value === pid; });
      break;
    }
    case 'start-trip': {
      const players = [...document.querySelectorAll('.pick input:checked')].map(i => i.value);
      if (!players.length) { toast('Pick at least one player'); break; }
      if (t) record('trip.end', { id: t.id });
      record('trip.start', { id: newId(), name: $('#trip-name-in').value.trim() || 'Road trip', players });
      closeSheet();
      db.tab = 'flocks';
      render();
      break;
    }
    case 'end-trip':
      sheet(`<h2>End ${esc(t.name)}?</h2><p>This crowns the Flocks winner and locks the scores. You can't add to it afterwards.</p>
        <div class="row"><button class="primary big" data-act="end-yes">End the trip</button><button class="ghost" data-act="close">Not yet</button></div>`);
      break;
    case 'end-yes': {
      record('trip.end', { id: t.id });
      closeSheet();
      const done = state.trips[t.id];
      toast(done.winners.length ? `🏆 ${done.winners.map(playerName).join(' & ')} won ${esc(done.name)}!` : 'Trip ended', true);
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
    case 'close': closeSheet(); break;
  }
}

// ---------- Start ----------

load();
document.addEventListener('click', onClick);
$('#sheet').addEventListener('click', ev => { if (ev.target.id === 'sheet') closeSheet(); });
refresh(known);
sync();
setInterval(sync, 15000);
window.addEventListener('online', sync);
document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
// Keep a copy of the page on the tablet for opening it with no signal. Browsers
// only allow this on https addresses, so on plain home Wi-Fi it quietly does nothing.
if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('sw.js').catch(() => {});
