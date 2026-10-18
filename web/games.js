// The rules of the games, and how scores, stats and awards are worked out from
// the list of events. Nothing in here touches the page, so it can be tested.

const ANIMALS = [
  { id: 'cow', name: 'Cows', icon: '🐄' },
  { id: 'horse', name: 'Horses', icon: '🐎' },
  { id: 'sheep', name: 'Sheep', icon: '🐑' },
  { id: 'goat', name: 'Goats', icon: '🐐' },
  { id: 'pig', name: 'Pigs', icon: '🐖' },
  { id: 'other', name: 'Other', icon: '🦙' },
];

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

// Awards. Each check looks at one player: their lifetime totals (life) and,
// during a trip, their part of that trip (tp, with plates they spotted there).
const AWARDS = [
  { id: 'first_flock', game: 'flocks', icon: '🐣', name: 'Little Bo Peep', desc: 'Count your first animal', check: c => c.life.animals >= 1 },
  { id: 'shepherd', game: 'flocks', icon: '🧑‍🌾', name: 'Shepherd', desc: 'Count 100 animals over all your trips', check: c => c.life.animals >= 100 },
  { id: 'rancher', game: 'flocks', icon: '🤠', name: 'Rancher', desc: 'Count 1,000 animals over all your trips', check: c => c.life.animals >= 1000 },
  { id: 'cattle_baron', game: 'flocks', icon: '👑', name: 'Cattle Baron', desc: 'Count 10,000 animals over all your trips', check: c => c.life.animals >= 10000 },
  { id: 'big_herd', game: 'flocks', icon: '🐃', name: 'Big Herd', desc: 'Count 50 or more animals in one go', check: c => c.life.biggest >= 50 },
  { id: 'century', game: 'flocks', icon: '💯', name: 'Century Flock', desc: 'Have 100 or more in your flock at once', check: c => c.tp && c.tp.score >= 100 },
  { id: 'rip', game: 'flocks', icon: '🪦', name: 'Rest in Peace', desc: 'Lose your flock at a cemetery', check: c => c.life.wipes >= 1 },
  { id: 'graveyard_shift', game: 'flocks', icon: '👻', name: 'Graveyard Shift', desc: 'Lose your flock 10 times', check: c => c.life.wipes >= 10 },
  { id: 'heartbreak', game: 'flocks', icon: '💔', name: 'Heartbreak', desc: 'Lose a flock of 100 or more at once', check: c => c.life.biggestLoss >= 100 },
  { id: 'champion', game: 'flocks', icon: '🏆', name: 'Trip Champion', desc: 'Have the biggest flock at the end of a trip', check: c => c.life.flockWins >= 1 },
  { id: 'dynasty', game: 'flocks', icon: '🏰', name: 'Dynasty', desc: 'Win Flocks on 5 trips', check: c => c.life.flockWins >= 5 },
  { id: 'comeback', game: 'flocks', icon: '🔥', name: 'Comeback Kid', desc: 'Win a trip after losing your flock on it', check: c => c.wonTrip && c.tp.wipes > 0 },
  { id: 'first_plate', game: 'plates', icon: '🚗', name: 'Plate Spotter', desc: 'Spot your first license plate', check: c => c.life.plates >= 1 },
  { id: 'aloha', game: 'plates', icon: '🌺', name: 'Aloha', desc: 'Spot a Hawaii plate', check: c => c.life.uniquePlates.has('HI') },
  { id: 'last_frontier', game: 'plates', icon: '🐻', name: 'Last Frontier', desc: 'Spot an Alaska plate', check: c => c.life.uniquePlates.has('AK') },
  { id: 'capital', game: 'plates', icon: '🏛️', name: 'Capital Idea', desc: 'Spot a Washington DC plate', check: c => c.life.uniquePlates.has('DC') },
  { id: 'oh_canada', game: 'plates', icon: '🍁', name: 'Oh Canada', desc: 'Spot a Canadian plate', check: c => [...c.life.uniquePlates].some(k => k.startsWith('CA-')) },
  { id: 'coast_to_coast', game: 'plates', icon: '🌊', name: 'Coast to Coast', desc: 'Spot Maine and California on the same trip', check: c => c.tp && c.tp.plates.has('ME') && c.tp.plates.has('CA') },
  { id: 'ten_trip', game: 'plates', icon: '🔟', name: 'Sharp Eyes', desc: 'Spot 10 plates first on one trip', check: c => c.tp && c.tp.plates.size >= 10 },
  { id: 'half_way', game: 'plates', icon: '🗺️', name: 'Halfway There', desc: 'Spot 25 states first on one trip', check: c => c.tp && US_STATES.filter(s => c.tp.plates.has(s)).length >= 25 },
  { id: 'fifty_club', game: 'plates', icon: '🇺🇸', name: 'Fifty Club', desc: 'Spot all 50 states over all your trips', check: c => US_STATES.every(s => c.life.uniquePlates.has(s)) },
  { id: 'full_house', game: 'plates', icon: '🎉', name: 'Full House', desc: 'Your car finds all 50 states on one trip', check: c => c.trip && US_STATES.every(s => c.trip.plates[s]) },
  { id: 'road_warrior', game: 'trips', icon: '🛣️', name: 'Road Warrior', desc: 'Play on 10 trips', check: c => c.life.trips >= 10 },
];

function emptyLife() {
  return { trips: 0, flockWins: 0, animals: 0, byAnimal: {}, wipes: 0, lost: 0, biggest: 0, biggestLoss: 0, bestFlock: 0, plates: 0, uniquePlates: new Set(), awards: {} };
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
      try { ok = a.check({ life: l, ...ctx }); } catch (_) { ok = false; }
      if (ok) {
        l.awards[a.id] = { ts: e.ts, trip: ctx.trip ? ctx.trip.id : null };
        if (seenIds && !seenIds.has(e.id)) st.newAwards.push({ player: pid, award: a.id });
      }
    }
  };
  const tripPlayer = (trip, pid) => {
    if (!trip.flocks[pid]) trip.flocks[pid] = { score: 0, counted: 0, wipes: 0, byAnimal: {}, plates: new Set() };
    return trip.flocks[pid];
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
        const players = (d.players || []).filter(pid => st.players[pid]);
        const trip = { id: d.id, name: String(d.name || 'Road trip'), players, start: e.ts, end: null, flocks: {}, plates: {}, winners: [] };
        st.trips[d.id] = trip;
        st.tripOrder.push(d.id);
        for (const pid of players) {
          tripPlayer(trip, pid);
          life(pid).trips++;
          award(pid, { trip, tp: trip.flocks[pid] }, e);
        }
        break;
      }
      case 'trip.end': {
        const trip = st.trips[d.id];
        if (!trip || trip.end) break;
        trip.end = e.ts;
        const best = Math.max(0, ...trip.players.map(pid => tripPlayer(trip, pid).score));
        trip.winners = best > 0 ? trip.players.filter(pid => trip.flocks[pid].score === best) : [];
        for (const pid of trip.players) {
          const tp = trip.flocks[pid];
          const won = trip.winners.includes(pid);
          if (won) life(pid).flockWins++;
          life(pid).bestFlock = Math.max(life(pid).bestFlock, tp.score);
          award(pid, { trip, tp, wonTrip: won }, e);
        }
        break;
      }
      case 'flock.add': {
        const trip = st.trips[d.trip];
        const n = Math.floor(Number(d.n) || 0);
        if (!trip || trip.end || !trip.players.includes(d.player) || n <= 0 || n > 100000) break;
        const tp = tripPlayer(trip, d.player);
        const animal = ANIMALS.some(a => a.id === d.animal) ? d.animal : 'other';
        tp.score += n;
        tp.counted += n;
        tp.byAnimal[animal] = (tp.byAnimal[animal] || 0) + n;
        const l = life(d.player);
        l.animals += n;
        l.byAnimal[animal] = (l.byAnimal[animal] || 0) + n;
        l.biggest = Math.max(l.biggest, n);
        award(d.player, { trip, tp }, e);
        break;
      }
      case 'flock.wipe': {
        const trip = st.trips[d.trip];
        if (!trip || trip.end || !trip.players.includes(d.player)) break;
        const tp = tripPlayer(trip, d.player);
        const l = life(d.player);
        l.wipes++;
        l.lost += tp.score;
        l.biggestLoss = Math.max(l.biggestLoss, tp.score);
        tp.wipes++;
        tp.score = 0;
        award(d.player, { trip, tp }, e);
        break;
      }
      case 'plate.spot': {
        const trip = st.trips[d.trip];
        if (!trip || trip.end || !trip.players.includes(d.player) || !PLATES[d.plate] || trip.plates[d.plate]) break;
        trip.plates[d.plate] = { player: d.player, ts: e.ts, event: e.id };
        const tp = tripPlayer(trip, d.player);
        tp.plates.add(d.plate);
        const l = life(d.player);
        l.plates++;
        l.uniquePlates.add(d.plate);
        // Full House is the whole car's, so everyone on the trip gets checked.
        for (const pid of trip.players) award(pid, { trip, tp: tripPlayer(trip, pid) }, e);
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

// The last thing done on a trip that can still be undone, newest first.
function lastUndoable(events, st, tripId, playerId) {
  const kinds = new Set(['flock.add', 'flock.wipe', 'plate.spot']);
  let best = null;
  for (const e of events) {
    if (!kinds.has(e.type) || st.undone.has(e.id) || !e.data || e.data.trip !== tripId) continue;
    if (playerId && e.data.player !== playerId) continue;
    if (!best || e.ts > best.ts || (e.ts === best.ts && e.id > best.id)) best = e;
  }
  return best;
}

if (typeof module !== 'undefined') module.exports = { ANIMALS, PLATES, PLATE_REGIONS, US_STATES, AWARDS, PLAYER_COLORS, buildState, lastUndoable };
