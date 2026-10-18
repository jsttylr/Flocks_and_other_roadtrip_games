// The rules of the games, and how scores, stats and awards are worked out from
// the list of events. Nothing in here touches the page, so it can be tested.

// Flocks: live farm animals. A cemetery kills flocks; a church brings yours back.
const ANIMALS = [
  { id: 'cow', name: 'Cows', icon: '🐄' },
  { id: 'horse', name: 'Horses', icon: '🐎' },
  { id: 'sheep', name: 'Sheep', icon: '🐑' },
  { id: 'goat', name: 'Goats', icon: '🐐' },
  { id: 'chicken', name: 'Chickens', icon: '🐔' },
  { id: 'llama', name: 'Llamas & alpacas', icon: '🦙' },
  { id: 'pig', name: 'Pigs', icon: '🐖' },
];

// Zombie flocks: roadkill. Already dead, so cemeteries and churches leave them alone.
const ZOMBIES = [
  { id: 'deer', name: 'Deer', icon: '🦌' },
  { id: 'rabbit', name: 'Rabbits', icon: '🐇' },
  { id: 'squirrel', name: 'Squirrels', icon: '🐿️' },
  { id: 'fox', name: 'Foxes', icon: '🦊' },
  { id: 'raccoon', name: 'Raccoons', icon: '🦝' },
  { id: 'opossum', name: 'Opossums', icon: '🐀' },
];

// Volvo trucks, by cab colour, one point each. One with VOLVO on the cab
// fairing is a "Volvo truck <colour> Volvo" and scores double.
const VOLVO_COLORS = [
  { id: 'white', name: 'White', hex: '#f4f4f4' },
  { id: 'black', name: 'Black', hex: '#222222' },
  { id: 'silver', name: 'Silver', hex: '#b8bcc2' },
  { id: 'blue', name: 'Blue', hex: '#1f5fbf' },
  { id: 'red', name: 'Red', hex: '#c62828' },
  { id: 'green', name: 'Green', hex: '#2e7d32' },
  { id: 'orange', name: 'Orange', hex: '#ef6c00' },
  { id: 'yellow', name: 'Yellow', hex: '#f9c80e' },
  { id: 'brown', name: 'Brown', hex: '#6d4c41' },
  { id: 'purple', name: 'Purple', hex: '#6a1b9a' },
  { id: 'other', name: 'Other', hex: 'linear-gradient(135deg,#e53935,#fdd835,#43a047,#1e88e5)' },
];
function volvoName(color, branded) {
  const c = (VOLVO_COLORS.find(v => v.id === color) || { name: color }).name.toLowerCase();
  return `Volvo truck ${c}${branded ? ' Volvo' : ''}`;
}

const PLATE_REGIONS = [
  { name: 'Northeast', country: 'US', plates: [['CT', 'Connecticut'], ['DE', 'Delaware'], ['ME', 'Maine'], ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NY', 'New York'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['VT', 'Vermont'], ['DC', 'Washington DC']] },
  { name: 'Southeast', country: 'US', plates: [['AL', 'Alabama'], ['AR', 'Arkansas'], ['FL', 'Florida'], ['GA', 'Georgia'], ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['MS', 'Mississippi'], ['NC', 'North Carolina'], ['SC', 'South Carolina'], ['TN', 'Tennessee'], ['VA', 'Virginia'], ['WV', 'West Virginia']] },
  { name: 'Midwest', country: 'US', plates: [['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MO', 'Missouri'], ['NE', 'Nebraska'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['SD', 'South Dakota'], ['WI', 'Wisconsin']] },
  { name: 'Southwest', country: 'US', plates: [['AZ', 'Arizona'], ['NM', 'New Mexico'], ['OK', 'Oklahoma'], ['TX', 'Texas']] },
  { name: 'West', country: 'US', plates: [['AK', 'Alaska'], ['CA', 'California'], ['CO', 'Colorado'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['MT', 'Montana'], ['NV', 'Nevada'], ['OR', 'Oregon'], ['UT', 'Utah'], ['WA', 'Washington'], ['WY', 'Wyoming']] },
  { name: 'Canada', country: 'CA', plates: [['AB', 'Alberta'], ['BC', 'British Columbia'], ['MB', 'Manitoba'], ['NB', 'New Brunswick'], ['NL', 'Newfoundland'], ['NS', 'Nova Scotia'], ['NT', 'NW Territories'], ['NU', 'Nunavut'], ['ON', 'Ontario'], ['PE', 'PEI'], ['QC', 'Quebec'], ['SK', 'Saskatchewan'], ['YT', 'Yukon']] },
];

// Plate codes are unique once Canadian ones get a "CA-" prefix (some letters overlap with states).
const PLATES = {};
for (const r of PLATE_REGIONS) {
  for (const [code, name] of r.plates) {
    const key = r.country === 'CA' ? 'CA-' + code : code;
    PLATES[key] = { key, code, name, region: r.name, country: r.country };
  }
}
const US_STATES = Object.values(PLATES).filter(p => p.country === 'US' && p.key !== 'DC').map(p => p.key);

const PLAYER_COLORS = ['#e4572e', '#2e86de', '#20bf6b', '#f7b731', '#8854d0', '#eb3b5a', '#0fb9b1', '#a5673f'];
const MAX_PLAYERS = 4;

// Awards. Each check looks at one player: their lifetime totals (life) and,
// during a trip, their part of that trip (tp). License plates are played
// together, so plate awards go to everyone in the car.
const AWARDS = [
  { id: 'first_flock', game: 'flocks', icon: '🐣', name: 'Little Bo Peep', desc: 'Count your first animal', check: c => c.life.animals >= 1 },
  { id: 'shepherd', game: 'flocks', icon: '🧑‍🌾', name: 'Shepherd', desc: 'Count 100 animals over all your trips', check: c => c.life.animals >= 100 },
  { id: 'rancher', game: 'flocks', icon: '🤠', name: 'Rancher', desc: 'Count 1,000 animals over all your trips', check: c => c.life.animals >= 1000 },
  { id: 'cattle_baron', game: 'flocks', icon: '👑', name: 'Cattle Baron', desc: 'Count 10,000 animals over all your trips', check: c => c.life.animals >= 10000 },
  { id: 'big_herd', game: 'flocks', icon: '🐃', name: 'Big Herd', desc: 'Count 50 or more animals in one go', check: c => c.life.biggest >= 50 },
  { id: 'century', game: 'flocks', icon: '💯', name: 'Century Flock', desc: 'Have 100 or more in your flock at once', check: c => c.tp && c.tp.score >= 100 },
  { id: 'chicken_run', game: 'flocks', icon: '🐓', name: 'Chicken Run', desc: 'Count 100 chickens over all your trips', check: c => (c.life.byAnimal.chicken || 0) >= 100 },
  { id: 'grim_reaper', game: 'flocks', icon: '💀', name: 'Grim Reaper', desc: 'Call a cemetery on someone\'s flock', check: c => c.life.kills >= 1 },
  { id: 'undertaker', game: 'flocks', icon: '⚰️', name: 'Undertaker', desc: 'Kill 25 flocks with cemeteries', check: c => c.life.kills >= 25 },
  { id: 'rip', game: 'flocks', icon: '🪦', name: 'Rest in Peace', desc: 'Lose your flock to a cemetery', check: c => c.life.deaths >= 1 },
  { id: 'heartbreak', game: 'flocks', icon: '💔', name: 'Heartbreak', desc: 'Lose a flock of 100 or more at once', check: c => c.life.biggestLoss >= 100 },
  { id: 'hallelujah', game: 'flocks', icon: '⛪', name: 'Hallelujah', desc: 'Bring your flock back with a church', check: c => c.life.churches >= 1 },
  { id: 'miracle', game: 'flocks', icon: '😇', name: 'Miracle', desc: 'Bring back 100 or more animals with one church', check: c => c.life.biggestRaise >= 100 },
  { id: 'champion', game: 'flocks', icon: '🏆', name: 'Flock Champion', desc: 'Have the biggest flock at the end of a trip', check: c => c.life.wins.flocks >= 1 },
  { id: 'dynasty', game: 'flocks', icon: '🏰', name: 'Dynasty', desc: 'Win Flocks on 5 trips', check: c => c.life.wins.flocks >= 5 },
  { id: 'comeback', game: 'flocks', icon: '🔥', name: 'Comeback Kid', desc: 'Win Flocks on a trip where you lost your flock', check: c => c.won && c.won.includes('flocks') && c.tp.deaths > 0 },

  { id: 'first_zombie', game: 'zombies', icon: '🧟', name: 'Zombie Spotter', desc: 'Spot your first zombie', check: c => c.life.zombies >= 1 },
  { id: 'zombie_hunter', game: 'zombies', icon: '🔦', name: 'Zombie Hunter', desc: 'Spot 25 zombies over all your trips', check: c => c.life.zombies >= 25 },
  { id: 'apocalypse', game: 'zombies', icon: '☣️', name: 'Zombie Apocalypse', desc: 'Spot 100 zombies over all your trips', check: c => c.life.zombies >= 100 },
  { id: 'zombie_zoo', game: 'zombies', icon: '🎃', name: 'Zombie Zoo', desc: 'Spot all six kinds of zombie on one trip', check: c => c.tp && ZOMBIES.every(z => c.tp.zombieBy[z.id]) },
  { id: 'zombie_king', game: 'zombies', icon: '🦴', name: 'Zombie King', desc: 'Have the biggest zombie flock at the end of a trip', check: c => c.life.wins.zombies >= 1 },

  { id: 'first_volvo', game: 'volvos', icon: '🚚', name: 'Truck Spotter', desc: 'Spot your first Volvo truck', check: c => c.life.volvos >= 1 },
  { id: 'say_it_twice', game: 'volvos', icon: '🗣️', name: 'Say It Twice', desc: 'Spot a Volvo truck with VOLVO on the fairing', check: c => c.life.volvoBranded >= 1 },
  { id: 'rainbow', game: 'volvos', icon: '🌈', name: 'Rainbow Fleet', desc: 'Spot Volvo trucks in 6 colours on one trip', check: c => c.tp && Object.keys(c.tp.volvoBy).length >= 6 },
  { id: 'convoy', game: 'volvos', icon: '🛻', name: 'Convoy', desc: 'Spot 100 Volvo trucks over all your trips', check: c => c.life.volvos >= 100 },
  { id: 'volvo_champ', game: 'volvos', icon: '🥇', name: 'Volvo Champion', desc: 'Score the most Volvo points on a trip', check: c => c.life.wins.volvos >= 1 },

  { id: 'first_plate', game: 'plates', icon: '🚗', name: 'Plate Spotters', desc: 'Your car finds its first plate', check: c => c.life.uniquePlates.size >= 1 },
  { id: 'aloha', game: 'plates', icon: '🌺', name: 'Aloha', desc: 'Your car finds a Hawaii plate', check: c => c.life.uniquePlates.has('HI') },
  { id: 'last_frontier', game: 'plates', icon: '🐻', name: 'Last Frontier', desc: 'Your car finds an Alaska plate', check: c => c.life.uniquePlates.has('AK') },
  { id: 'capital', game: 'plates', icon: '🏛️', name: 'Capital Idea', desc: 'Your car finds a Washington DC plate', check: c => c.life.uniquePlates.has('DC') },
  { id: 'oh_canada', game: 'plates', icon: '🍁', name: 'Oh Canada', desc: 'Your car finds a Canadian plate', check: c => [...c.life.uniquePlates].some(k => k.startsWith('CA-')) },
  { id: 'coast_to_coast', game: 'plates', icon: '🌊', name: 'Coast to Coast', desc: 'Maine and California on the same trip', check: c => c.trip && c.trip.plates.ME && c.trip.plates.CA },
  { id: 'half_way', game: 'plates', icon: '🗺️', name: 'Halfway There', desc: '25 states on one trip', check: c => c.trip && US_STATES.filter(s => c.trip.plates[s]).length >= 25 },
  { id: 'full_house', game: 'plates', icon: '🎉', name: 'Full House', desc: 'All 50 states on one trip', check: c => c.trip && US_STATES.every(s => c.trip.plates[s]) },
  { id: 'fifty_club', game: 'plates', icon: '🇺🇸', name: 'Fifty Club', desc: 'All 50 states over all your trips', check: c => US_STATES.every(s => c.life.uniquePlates.has(s)) },

  { id: 'road_warrior', game: 'trips', icon: '🛣️', name: 'Road Warrior', desc: 'Play on 10 trips', check: c => c.life.trips >= 10 },
];

// The games decided at the end of a trip, and the score each is decided on.
const CONTESTS = [
  { id: 'flocks', name: 'Flocks', icon: '🐄', score: tp => tp.score },
  { id: 'zombies', name: 'Zombies', icon: '🧟', score: tp => tp.zombies },
  { id: 'volvos', name: 'Volvos', icon: '🚚', score: tp => tp.volvoPoints },
];

function emptyLife() {
  return {
    trips: 0, wins: { flocks: 0, zombies: 0, volvos: 0 },
    animals: 0, byAnimal: {}, biggest: 0, bestFlock: 0,
    kills: 0, deaths: 0, lost: 0, biggestLoss: 0, churches: 0, raised: 0, biggestRaise: 0,
    zombies: 0, zombieBy: {}, volvos: 0, volvoPoints: 0, volvoBy: {}, volvoBranded: 0,
    uniquePlates: new Set(), awards: {},
  };
}

function emptyTripPlayer() {
  return { score: 0, counted: 0, dead: 0, deaths: 0, kills: 0, churches: 0, byAnimal: {}, zombies: 0, zombieBy: {}, volvos: 0, volvoPoints: 0, volvoBy: {}, volvoBranded: 0 };
}

// A location saved with a sighting, if it looks sane.
function cleanLoc(l) {
  if (!l || typeof l !== 'object') return null;
  const lat = Number(l.lat), lon = Number(l.lon);
  if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

// buildState replays every event, oldest first, and returns everything the page shows.
// newAwards lists awards earned by events not in `seenIds` (for the "you earned" pop-up).
function buildState(events, seenIds) {
  const sorted = [...events].sort((a, b) => a.ts - b.ts || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const undone = new Set(sorted.filter(e => e.type === 'undo' && e.data && e.data.target).map(e => e.data.target));
  const st = { players: {}, playerOrder: [], trips: {}, tripOrder: [], life: {}, newAwards: [], undone };

  const life = pid => st.life[pid] || (st.life[pid] = emptyLife());
  const award = (pid, ctx, e) => {
    const l = life(pid);
    for (const a of AWARDS) {
      if (l.awards[a.id]) continue;
      let ok = false;
      try { ok = !!a.check({ life: l, ...ctx }); } catch (_) { ok = false; }
      if (ok) {
        l.awards[a.id] = { ts: e.ts, trip: ctx.trip ? ctx.trip.id : null };
        if (seenIds && !seenIds.has(e.id)) st.newAwards.push({ player: pid, award: a.id });
      }
    }
  };
  // A sighting on the map.
  const pin = (trip, e, kind, label, icon, pid) => {
    const loc = cleanLoc(e.data.loc);
    if (loc) trip.pins.push({ ...loc, ts: e.ts, kind, label, icon, player: pid || null, event: e.id });
  };
  // Checks and returns the trip and player an in-trip event is about.
  const inTrip = d => {
    const trip = st.trips[d.trip];
    if (!trip || trip.end || !trip.players.includes(d.player)) return null;
    return { trip, tp: trip.by[d.player], l: life(d.player) };
  };
  const count = d => {
    const n = Math.floor(Number(d.n === undefined ? 1 : d.n) || 0);
    return n > 0 && n <= 100000 ? n : 0;
  };

  for (const e of sorted) {
    if (e.type === 'undo' || undone.has(e.id)) continue;
    const d = e.data || {};
    switch (e.type) {
      case 'player.add':
        if (!d.id || st.players[d.id]) break;
        st.players[d.id] = { id: d.id, name: String(d.name || 'Player'), color: d.color || PLAYER_COLORS[st.playerOrder.length % PLAYER_COLORS.length], hidden: false };
        st.playerOrder.push(d.id);
        life(d.id);
        break;
      case 'player.edit': {
        const p = st.players[d.id];
        if (!p) break;
        if (d.name) p.name = String(d.name);
        if (d.color) p.color = d.color;
        if (typeof d.hidden === 'boolean') p.hidden = d.hidden;
        break;
      }
      case 'trip.start': {
        if (!d.id || st.trips[d.id]) break;
        const players = [...new Set(d.players || [])].filter(pid => st.players[pid]).slice(0, MAX_PLAYERS);
        const trip = { id: d.id, name: String(d.name || 'Road trip'), players, start: e.ts, end: null, by: {}, plates: {}, pins: [], winners: {} };
        st.trips[d.id] = trip;
        st.tripOrder.push(d.id);
        for (const pid of players) {
          trip.by[pid] = emptyTripPlayer();
          life(pid).trips++;
          award(pid, { trip, tp: trip.by[pid] }, e);
        }
        break;
      }
      case 'trip.end': {
        const trip = st.trips[d.id];
        if (!trip || trip.end) break;
        trip.end = e.ts;
        const won = {};
        for (const c of CONTESTS) {
          const best = Math.max(0, ...trip.players.map(pid => c.score(trip.by[pid])));
          trip.winners[c.id] = best > 0 ? trip.players.filter(pid => c.score(trip.by[pid]) === best) : [];
          for (const pid of trip.winners[c.id]) {
            life(pid).wins[c.id]++;
            (won[pid] = won[pid] || []).push(c.id);
          }
        }
        for (const pid of trip.players) {
          life(pid).bestFlock = Math.max(life(pid).bestFlock, trip.by[pid].score);
          award(pid, { trip, tp: trip.by[pid], won: won[pid] || [] }, e);
        }
        break;
      }
      case 'flock.add': {
        const x = inTrip(d), n = count(d);
        if (!x || !n) break;
        const animal = ANIMALS.find(a => a.id === d.animal) || ANIMALS[0];
        x.tp.score += n;
        x.tp.counted += n;
        x.tp.byAnimal[animal.id] = (x.tp.byAnimal[animal.id] || 0) + n;
        x.l.animals += n;
        x.l.byAnimal[animal.id] = (x.l.byAnimal[animal.id] || 0) + n;
        x.l.biggest = Math.max(x.l.biggest, n);
        pin(x.trip, e, 'flock', `${n} ${animal.name.toLowerCase()}`, animal.icon, d.player);
        award(d.player, x, e);
        break;
      }
      // The player who spots a cemetery kills the flocks of the players they name.
      case 'flock.cemetery': {
        const x = inTrip(d);
        if (!x) break;
        const victims = [...new Set(d.victims || [])].filter(v => x.trip.players.includes(v));
        let killed = 0;
        for (const v of victims) {
          const vt = x.trip.by[v], vl = life(v);
          if (vt.score > 0) killed++;
          vl.deaths++;
          vl.lost += vt.score;
          vl.biggestLoss = Math.max(vl.biggestLoss, vt.score);
          vt.dead += vt.score;
          vt.deaths++;
          vt.score = 0;
          award(v, { trip: x.trip, tp: vt }, e);
        }
        x.tp.kills += killed;
        x.l.kills += killed;
        pin(x.trip, e, 'cemetery', `Cemetery: ${victims.length} flock${victims.length === 1 ? '' : 's'} killed`, '🪦', d.player);
        award(d.player, x, e);
        break;
      }
      // Older version: a cemetery that killed the flock of the player who tapped it.
      case 'flock.wipe': {
        const x = inTrip(d);
        if (!x) break;
        x.l.deaths++;
        x.l.lost += x.tp.score;
        x.l.biggestLoss = Math.max(x.l.biggestLoss, x.tp.score);
        x.tp.dead += x.tp.score;
        x.tp.deaths++;
        x.tp.score = 0;
        award(d.player, x, e);
        break;
      }
      // A church brings back everything the player has lost to cemeteries since their last church.
      case 'flock.church': {
        const x = inTrip(d);
        if (!x) break;
        const n = x.tp.dead;
        x.tp.score += n;
        x.tp.dead = 0;
        x.tp.churches++;
        x.l.churches++;
        x.l.raised += n;
        x.l.biggestRaise = Math.max(x.l.biggestRaise, n);
        pin(x.trip, e, 'church', `Church: ${n} brought back`, '⛪', d.player);
        award(d.player, x, e);
        break;
      }
      case 'zombie.add': {
        const x = inTrip(d), n = count(d);
        if (!x || !n) break;
        const z = ZOMBIES.find(a => a.id === d.animal) || ZOMBIES[0];
        x.tp.zombies += n;
        x.tp.zombieBy[z.id] = (x.tp.zombieBy[z.id] || 0) + n;
        x.l.zombies += n;
        x.l.zombieBy[z.id] = (x.l.zombieBy[z.id] || 0) + n;
        pin(x.trip, e, 'zombie', `Zombie ${z.name.toLowerCase()}${n > 1 ? ' ×' + n : ''}`, z.icon, d.player);
        award(d.player, x, e);
        break;
      }
      case 'volvo.add': {
        const x = inTrip(d);
        if (!x) break;
        const color = VOLVO_COLORS.some(c => c.id === d.color) ? d.color : 'other';
        x.tp.volvos++;
        x.tp.volvoBy[color] = (x.tp.volvoBy[color] || 0) + 1;
        x.l.volvos++;
        x.l.volvoBy[color] = (x.l.volvoBy[color] || 0) + 1;
        const pts = d.branded ? 2 : 1;
        x.tp.volvoPoints += pts;
        x.l.volvoPoints += pts;
        if (d.branded) { x.tp.volvoBranded++; x.l.volvoBranded++; }
        pin(x.trip, e, 'volvo', volvoName(color, d.branded), '🚚', d.player);
        award(d.player, x, e);
        break;
      }
      // License plates are a game for the whole car.
      case 'plate.spot': {
        const trip = st.trips[d.trip];
        if (!trip || trip.end || !PLATES[d.plate] || trip.plates[d.plate]) break;
        trip.plates[d.plate] = { ts: e.ts, event: e.id };
        pin(trip, e, 'plate', `${PLATES[d.plate].name} plate`, '🚗', null);
        for (const pid of trip.players) {
          life(pid).uniquePlates.add(d.plate);
          award(pid, { trip, tp: trip.by[pid] }, e);
        }
        break;
      }
    }
  }

  // The newest trip that hasn't been ended is the one being played.
  st.activeTrip = null;
  for (let i = st.tripOrder.length - 1; i >= 0; i--) {
    const t = st.trips[st.tripOrder[i]];
    if (!t.end) { st.activeTrip = t; break; }
  }
  return st;
}

// The last thing a player did on a trip in one game that can still be undone.
const UNDO_KINDS = {
  flocks: ['flock.add', 'flock.cemetery', 'flock.church', 'flock.wipe'],
  zombies: ['zombie.add'],
  volvos: ['volvo.add'],
};
function lastUndoable(events, st, tripId, playerId, game) {
  const kinds = new Set(UNDO_KINDS[game] || Object.values(UNDO_KINDS).flat());
  let best = null;
  for (const e of events) {
    if (!kinds.has(e.type) || st.undone.has(e.id) || !e.data || e.data.trip !== tripId) continue;
    if (playerId && e.data.player !== playerId) continue;
    if (!best || e.ts > best.ts || (e.ts === best.ts && e.id > best.id)) best = e;
  }
  return best;
}

if (typeof module !== 'undefined') module.exports = { ANIMALS, ZOMBIES, VOLVO_COLORS, PLATES, PLATE_REGIONS, US_STATES, AWARDS, CONTESTS, PLAYER_COLORS, MAX_PLAYERS, volvoName, buildState, lastUndoable };
