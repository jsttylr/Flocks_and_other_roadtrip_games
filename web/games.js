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
  { name: 'Mexico & special plates', country: 'X', plates: [['MX', 'Mexico'], ['PR', 'Puerto Rico'], ['DPL', 'Diplomat'], ['USG', 'US Government']] },
];

// Plate codes are unique once Canadian ones get a "CA-" prefix (some letters overlap with states).
const plateKey = (region, code) => region.country === 'CA' ? 'CA-' + code : code;
const PLATES = {};
for (const r of PLATE_REGIONS) {
  for (const [code, name] of r.plates) {
    const key = plateKey(r, code);
    PLATES[key] = { key, code, name, region: r.name, country: r.country };
  }
}
const US_STATES = Object.values(PLATES).filter(p => p.country === 'US' && p.key !== 'DC').map(p => p.key);

const PLAYER_COLORS = ['#e4572e', '#2e86de', '#20bf6b', '#f7b731', '#8854d0', '#eb3b5a', '#0fb9b1', '#a5673f'];
const MAX_PLAYERS = 4;

// Dates for the hidden awards, in the iPad's own time zone.
const day = ts => { const d = new Date(ts); return { m: d.getMonth() + 1, d: d.getDate(), wd: d.getDay(), h: d.getHours(), y: d.getFullYear() }; };
// Within about a day of a full moon (counted from a known new moon).
function fullMoon(ts) {
  const age = (((ts - Date.UTC(2000, 0, 6, 18, 14)) / 86400000) % 29.530589 + 29.530589) % 29.530589;
  return Math.abs(age - 14.765) <= 1.1;
}
// Easter Sunday (Gregorian), as month and day.
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  return { m: Math.floor((h + l - 7 * m + 114) / 31), d: ((h + l - 7 * m + 114) % 31) + 1 };
}
const zombieOn = (c, test) => c.e.type === 'zombie.add' && test(day(c.e.ts), c.e);

// Awards. Each check looks at one player: their lifetime totals (life) and,
// during a trip, their part of that trip (tp), plus the event (e) that just
// happened. License plates are played together, so plate awards go to everyone
// in the car. A "repeat" award can be earned again on every trip; a "hidden"
// one shows as a mystery until someone earns it.
const AWARDS = [
  { id: 'first_flock', game: 'flocks', icon: '🐣', name: 'Little Bo Peep', desc: 'Count your first animal', check: c => c.life.animals >= 1 },
  { id: 'shepherd', game: 'flocks', icon: '🧑‍🌾', name: 'Shepherd', desc: 'Count 100 animals over all your trips', check: c => c.life.animals >= 100 },
  { id: 'rancher', game: 'flocks', icon: '🤠', name: 'Rancher', desc: 'Count 1,000 animals over all your trips', check: c => c.life.animals >= 1000 },
  { id: 'cattle_baron', game: 'flocks', icon: '👑', name: 'Cattle Baron', desc: 'Count 10,000 animals over all your trips', check: c => c.life.animals >= 10000 },
  { id: 'big_herd', game: 'flocks', icon: '🐃', name: 'Big Herd', desc: 'Count 50 or more animals in one go', check: c => c.life.biggest >= 50 },
  { id: 'century', repeat: true, game: 'flocks', icon: '💯', name: 'Century Flock', desc: 'Have 100 or more in your flock at once', check: c => c.tp && c.tp.score >= 100 },
  { id: 'chicken_run', game: 'flocks', icon: '🐓', name: 'Chicken Run', desc: 'Count 100 chickens over all your trips', check: c => (c.life.byAnimal.chicken || 0) >= 100 },
  { id: 'grim_reaper', game: 'flocks', icon: '💀', name: 'Grim Reaper', desc: 'Call a cemetery on someone\'s flock', check: c => c.life.kills >= 1 },
  { id: 'undertaker', game: 'flocks', icon: '⚰️', name: 'Undertaker', desc: 'Kill 25 flocks with cemeteries', check: c => c.life.kills >= 25 },
  { id: 'rip', game: 'flocks', icon: '🪦', name: 'Rest in Peace', desc: 'Lose your flock to a cemetery', check: c => c.life.deaths >= 1 },
  { id: 'heartbreak', game: 'flocks', icon: '💔', name: 'Heartbreak', desc: 'Lose a flock of 100 or more at once', check: c => c.life.biggestLoss >= 100 },
  { id: 'hallelujah', game: 'flocks', icon: '⛪', name: 'Hallelujah', desc: 'Bring your flock back with a church', check: c => c.life.churches >= 1 },
  { id: 'miracle', game: 'flocks', icon: '😇', name: 'Miracle', desc: 'Bring back 100 or more animals with one church', check: c => c.life.biggestRaise >= 100 },
  { id: 'champion', repeat: true, game: 'flocks', icon: '🏆', name: 'Flock Champion', desc: 'Have the biggest flock at the end of a trip', check: c => c.won && c.won.includes('flocks') },
  { id: 'dynasty', game: 'flocks', icon: '🏰', name: 'Dynasty', desc: 'Win Flocks on 5 trips', check: c => c.life.wins.flocks >= 5 },
  { id: 'comeback', repeat: true, game: 'flocks', icon: '🔥', name: 'Comeback Kid', desc: 'Win Flocks on a trip where you lost your flock', check: c => c.won && c.won.includes('flocks') && c.tp.deaths > 0 },
  { id: 'old_macdonald', repeat: true, game: 'flocks', icon: '🚜', name: 'Old MacDonald', desc: 'Count all seven kinds of animal on one trip', check: c => c.tp && ANIMALS.every(a => c.tp.byAnimal[a.id]) },
  { id: 'triple_crown', repeat: true, game: 'flocks', icon: '🎖️', name: 'Triple Crown', desc: 'Win Flocks, Zombies and Volvos on the same trip', check: c => c.won && c.won.length === 3 },
  { id: 'ghost_story', hidden: true, repeat: true, game: 'flocks', icon: '👻', name: 'Ghost Story', desc: 'Call a cemetery on Halloween', check: c => c.e.type === 'flock.cemetery' && day(c.e.ts).m === 10 && day(c.e.ts).d === 31 },
  { id: 'easter', hidden: true, repeat: true, game: 'flocks', icon: '🥚', name: 'He Is Risen', desc: 'Bring your flock back with a church on Easter Sunday', check: c => { if (c.e.type !== 'flock.church') return false; const t = day(c.e.ts), x = easter(t.y); return t.m === x.m && t.d === x.d; } },

  { id: 'first_zombie', game: 'zombies', icon: '🧟', name: 'Zombie Spotter', desc: 'Spot your first zombie', check: c => c.life.zombies >= 1 },
  { id: 'zombie_hunter', game: 'zombies', icon: '🔦', name: 'Zombie Hunter', desc: 'Spot 25 zombies over all your trips', check: c => c.life.zombies >= 25 },
  { id: 'apocalypse', game: 'zombies', icon: '☣️', name: 'Zombie Apocalypse', desc: 'Spot 100 zombies over all your trips', check: c => c.life.zombies >= 100 },
  { id: 'zombie_zoo', repeat: true, game: 'zombies', icon: '🐾', name: 'Zombie Zoo', desc: 'Spot all six kinds of zombie on one trip', check: c => c.tp && ZOMBIES.every(z => c.tp.zombieBy[z.id]) },
  { id: 'zombie_king', repeat: true, game: 'zombies', icon: '🦴', name: 'Zombie King', desc: 'Have the biggest zombie flock at the end of a trip', check: c => c.won && c.won.includes('zombies') },
  { id: 'oh_deer', repeat: true, game: 'zombies', icon: '🦌', name: 'Oh Deer', desc: 'Spot 10 zombie deer on one trip', check: c => c.tp && (c.tp.zombieBy.deer || 0) >= 10 },
  { id: 'halloween', hidden: true, repeat: true, game: 'zombies', icon: '🎃', name: 'Trick or Treat', desc: 'Spot a zombie on Halloween', check: c => zombieOn(c, t => t.m === 10 && t.d === 31) },
  { id: 'dia_muertos', hidden: true, repeat: true, game: 'zombies', icon: '🌼', name: 'Día de los Muertos', desc: 'Spot a zombie on the Day of the Dead (November 1 or 2)', check: c => zombieOn(c, t => t.m === 11 && t.d <= 2) },
  { id: 'friday13', hidden: true, repeat: true, game: 'zombies', icon: '🔪', name: 'Friday the 13th', desc: 'Spot a zombie on Friday the 13th', check: c => zombieOn(c, t => t.wd === 5 && t.d === 13) },
  { id: 'witching_hour', hidden: true, repeat: true, game: 'zombies', icon: '🕛', name: 'Witching Hour', desc: 'Spot a zombie between midnight and 3 in the morning', check: c => zombieOn(c, t => t.h < 3) },
  { id: 'full_moon', hidden: true, repeat: true, game: 'zombies', icon: '🌕', name: 'Bad Moon Rising', desc: 'Spot a zombie on the night of a full moon', check: c => zombieOn(c, () => fullMoon(c.e.ts)) },
  { id: 'rudolph', hidden: true, repeat: true, game: 'zombies', icon: '🎄', name: 'Grandma Got Run Over', desc: 'Spot a zombie deer on Christmas Eve or Christmas Day', check: c => zombieOn(c, (t, e) => e.data.animal === 'deer' && t.m === 12 && (t.d === 24 || t.d === 25)) },

  { id: 'first_volvo', game: 'volvos', icon: '🚚', name: 'Truck Spotter', desc: 'Spot your first Volvo truck', check: c => c.life.volvos >= 1 },
  { id: 'say_it_twice', game: 'volvos', icon: '🗣️', name: 'Say It Twice', desc: 'Spot a Volvo truck with VOLVO on the fairing', check: c => c.life.volvoBranded >= 1 },
  { id: 'rainbow', repeat: true, game: 'volvos', icon: '🌈', name: 'Rainbow Fleet', desc: 'Spot Volvo trucks in 6 colours on one trip', check: c => c.tp && Object.keys(c.tp.volvoBy).length >= 6 },
  { id: 'convoy', game: 'volvos', icon: '🛻', name: 'Convoy', desc: 'Spot 100 Volvo trucks over all your trips', check: c => c.life.volvos >= 100 },
  { id: 'volvo_champ', repeat: true, game: 'volvos', icon: '🥇', name: 'Volvo Champion', desc: 'Score the most Volvo points on a trip', check: c => c.won && c.won.includes('volvos') },
  { id: 'fleet', repeat: true, game: 'volvos', icon: '🚛', name: 'Fleet Manager', desc: 'Spot 25 Volvo trucks on one trip', check: c => c.tp && c.tp.volvos >= 25 },

  { id: 'first_plate', game: 'plates', icon: '🚗', name: 'Plate Spotters', desc: 'Your car finds its first plate', check: c => c.life.uniquePlates.size >= 1 },
  { id: 'aloha', game: 'plates', icon: '🌺', name: 'Aloha', desc: 'Your car finds a Hawaii plate', check: c => c.life.uniquePlates.has('HI') },
  { id: 'last_frontier', game: 'plates', icon: '🐻', name: 'Last Frontier', desc: 'Your car finds an Alaska plate', check: c => c.life.uniquePlates.has('AK') },
  { id: 'capital', game: 'plates', icon: '🏛️', name: 'Capital Idea', desc: 'Your car finds a Washington DC plate', check: c => c.life.uniquePlates.has('DC') },
  { id: 'oh_canada', game: 'plates', icon: '🍁', name: 'Oh Canada', desc: 'Your car finds a Canadian plate', check: c => [...c.life.uniquePlates].some(k => k.startsWith('CA-')) },
  { id: 'hola', game: 'plates', icon: '🌮', name: '¡Hola, México!', desc: 'Your car finds a Mexican plate', check: c => c.life.uniquePlates.has('MX') },
  { id: 'isla', game: 'plates', icon: '🏝️', name: 'Isla del Encanto', desc: 'Your car finds a Puerto Rico plate', check: c => c.life.uniquePlates.has('PR') },
  { id: 'diplomat', game: 'plates', icon: '🕴️', name: 'Diplomatic Immunity', desc: 'Your car finds a diplomat plate', check: c => c.life.uniquePlates.has('DPL') },
  { id: 'gov_issue', game: 'plates', icon: '🦅', name: 'Government Issue', desc: 'Your car finds a US Government plate', check: c => c.life.uniquePlates.has('USG') },
  { id: 'border_to_border', repeat: true, game: 'plates', icon: '🧭', name: 'Border to Border', desc: 'A Canadian and a Mexican plate on the same trip', check: c => c.trip && c.trip.plates.MX && Object.keys(c.trip.plates).some(k => k.startsWith('CA-')) },
  { id: 'coast_to_coast', repeat: true, game: 'plates', icon: '🌊', name: 'Coast to Coast', desc: 'Maine and California on the same trip', check: c => c.trip && c.trip.plates.ME && c.trip.plates.CA },
  { id: 'half_way', repeat: true, game: 'plates', icon: '🗺️', name: 'Halfway There', desc: '25 states on one trip', check: c => c.trip && US_STATES.filter(s => c.trip.plates[s]).length >= 25 },
  { id: 'full_house', repeat: true, game: 'plates', icon: '🧹', name: 'Clean Sweep', desc: 'All 50 states on one trip', check: c => c.trip && US_STATES.every(s => c.trip.plates[s]) },
  { id: 'fifty_club', game: 'plates', icon: '🇺🇸', name: 'Fifty Club', desc: 'All 50 states over all your trips', check: c => US_STATES.every(s => c.life.uniquePlates.has(s)) },

  { id: 'homesteader', game: 'realm', icon: '🏠', name: 'Homesteader', desc: 'Build your first settlement in the Realm', check: c => c.e.type === 'realm.build' && c.e.data.kind === 'settlement' },
  { id: 'city_slicker', game: 'realm', icon: '🏙️', name: 'City Slicker', desc: 'Grow a settlement into a city', check: c => c.e.type === 'realm.build' && c.e.data.kind === 'city' },
  { id: 'long_haul', game: 'realm', icon: '🛤️', name: 'Long Haul', desc: 'Hold the Longest Road in the Realm', check: c => c.realm && c.realm.longest === c.pid },
  { id: 'land_baron', game: 'realm', icon: '🗺️', name: 'Land Baron', desc: 'Hold Biggest Territory in the Realm', check: c => c.realm && c.realm.biggest === c.pid },
  { id: 'buckle_up', game: 'trips', icon: '🚙', name: 'Buckle Up', desc: 'Play your first trip', check: c => c.life.trips >= 1 },
  { id: 'road_warrior', game: 'trips', icon: '🛣️', name: 'Road Warrior', desc: 'Play on 10 trips', check: c => c.life.trips >= 10 },
  { id: 'globetrotter', game: 'trips', icon: '🧳', name: 'Globetrotter', desc: 'Play on 25 trips', check: c => c.life.trips >= 25 },
];

// Levels go up with every award earned, repeats included, like badges on a
// watch. Each level needs one more award than the last: 1, 2, 3, ...
const LEVEL_TITLES = ['Passenger', 'Backseat Spotter', 'Window Watcher', 'Road Scout', 'Navigator', 'Trailblazer', 'Road Tripper', 'Highway Hero', 'Road Royalty', 'Grand Tourer'];
function levelFor(n) {
  let level = 1, need = 0;
  while (n >= need + level) { need += level; level++; }
  const title = LEVEL_TITLES[Math.min(level, LEVEL_TITLES.length) - 1];
  return { level, title, badges: n, from: need, to: need + level };
}

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
    uniquePlates: new Set(), awards: {}, badges: 0,
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
  const st = { players: {}, playerOrder: [], trips: {}, tripOrder: [], life: {}, newAwards: [], undone, realm: emptyRealm() };
  const realm = st.realm;
  const purse = pid => realm.purse[pid] || (realm.purse[pid] = emptyPurse());
  const earn = (trip, pid, res, n = 1) => { const t = trip.earned[pid] || (trip.earned[pid] = emptyPurse()); t[res] += n; };

  const life = pid => st.life[pid] || (st.life[pid] = emptyLife());
  // l.awards[id] is { ts, trip } of the first time, plus count, the last time
  // and the trips it was earned on (a repeat award once per trip).
  const award = (pid, ctx, e) => {
    const l = life(pid);
    const before = levelFor(l.badges).level;
    const tripId = ctx.trip ? ctx.trip.id : null;
    for (const a of AWARDS) {
      const got = l.awards[a.id];
      if (got && (!a.repeat || !tripId || got.trips.includes(tripId))) continue;
      let ok = false;
      try { ok = !!a.check({ life: l, e, realm, pid, ...ctx }); } catch (_) { ok = false; }
      if (!ok) continue;
      if (got) { got.count++; got.last = { ts: e.ts, trip: tripId }; got.trips.push(tripId); }
      else l.awards[a.id] = { ts: e.ts, trip: tripId, count: 1, last: { ts: e.ts, trip: tripId }, trips: tripId ? [tripId] : [] };
      l.badges++;
      if (tripId) ctx.trip.awards.push({ player: pid, award: a.id, ts: e.ts, count: l.awards[a.id].count });
      if (seenIds && !seenIds.has(e.id)) st.newAwards.push({ player: pid, award: a.id, count: l.awards[a.id].count });
    }
    const after = levelFor(l.badges);
    if (after.level > before && seenIds && !seenIds.has(e.id)) st.newAwards.push({ player: pid, level: after });
  };
  // A sighting on the map.
  const pin = (trip, e, kind, label, icon, pid) => {
    const loc = cleanLoc(e.data.loc);
    if (!loc) return;
    trip.pins.push({ ...loc, ts: e.ts, kind, label, icon, player: pid || null, event: e.id });
    // The same sighting claims ground in the Realm.
    const key = hexAt(loc.lat, loc.lon);
    const h = realm.hexes[key] || (realm.hexes[key] = { key, counts: {}, kinds: {}, owner: null, terrain: null, building: null, first: e.ts });
    trip.hexHits.add(key);
    const res = PIN_RESOURCE[kind];
    if (res) { h.kinds[res] = (h.kinds[res] || 0) + 1; h.terrain = RESOURCES.map(r => r.id).reduce((a, b) => (h.kinds[b] || 0) > (h.kinds[a] || 0) ? b : a, res); }
    if (pid) {
      h.counts[pid] = (h.counts[pid] || 0) + 1;
      if (!h.owner || (h.owner !== pid && h.counts[pid] > (h.counts[h.owner] || 0))) h.owner = pid;
    }
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

  // Points: 1 a settlement, 2 a city, and 2 each for Longest Road and Biggest Territory.
  const realmScore = () => {
    const pids = st.playerOrder;
    const best = (vals, min, holder) => {
      const top = Math.max(0, ...pids.map(p => vals[p] || 0));
      if (top < min) return null;
      const leaders = pids.filter(p => (vals[p] || 0) === top);
      return leaders.includes(holder) ? holder : leaders.length === 1 ? leaders[0] : null;
    };
    realm.land = {};
    for (const h of Object.values(realm.hexes)) if (h.owner) realm.land[h.owner] = (realm.land[h.owner] || 0) + 1;
    for (const p of pids) realm.roadLength[p] = longestRoad(realm.roads, p);
    realm.longest = best(realm.roadLength, LONGEST_ROAD_MIN, realm.longest);
    realm.biggest = best(realm.land, BIGGEST_LAND_MIN, realm.biggest);
    for (const p of pids) {
      let pts = 0;
      for (const h of Object.values(realm.hexes)) if (h.building && h.building.player === p) pts += BUILDINGS[h.building.kind].points;
      if (realm.longest === p) pts += BONUS_POINTS;
      if (realm.biggest === p) pts += BONUS_POINTS;
      realm.points[p] = pts;
    }
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
        const trip = { id: d.id, name: String(d.name || 'Road trip'), players, start: e.ts, end: null, by: {}, plates: {}, pins: [], winners: {}, awards: [], badgesAtEnd: {}, earned: {}, paid: {}, hexHits: new Set(), steals: [] };
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
        // Realm payday: resources for the trip's sightings, one of each for
        // coming along, and a harvest from settled hexes someone drove through.
        for (const pid of trip.players) {
          const got = emptyPurse(), seen = trip.earned[pid] || emptyPurse();
          for (const r of RESOURCES) got[r.id] = Math.floor(seen[r.id] / EARN_EVERY[r.id]) + 1;
          for (const key of trip.hexHits) {
            const b = realm.hexes[key].building, t = realm.hexes[key].terrain;
            if (b && b.player === pid && t) got[t] += b.kind === 'city' ? 2 : 1;
          }
          pay(purse(pid), got, 1);
          trip.paid[pid] = got;
        }
        // A cemetery is the robber: its caller takes one of each victim's most plentiful resource.
        for (const { thief, victims } of trip.steals) {
          for (const v of victims) {
            const vp = purse(v), top = RESOURCES.map(r => r.id).reduce((a, b) => vp[b] > vp[a] ? b : a);
            if (vp[top] > 0) { vp[top]--; purse(thief)[top]++; }
          }
        }
        realmScore();
        for (const pid of trip.players) {
          life(pid).bestFlock = Math.max(life(pid).bestFlock, trip.by[pid].score);
          award(pid, { trip, tp: trip.by[pid], won: won[pid] || [] }, e);
          trip.badgesAtEnd[pid] = life(pid).badges;
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
        earn(x.trip, d.player, 'wool');
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
        earn(x.trip, d.player, 'lumber');
        if (victims.length) x.trip.steals.push({ thief: d.player, victims });
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
        earn(x.trip, d.player, 'lumber');
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
        earn(x.trip, d.player, 'brick', n);
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
        earn(x.trip, d.player, 'ore', pts);
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
          earn(trip, pid, 'grain');
          life(pid).uniquePlates.add(d.plate);
          award(pid, { trip, tp: trip.by[pid] }, e);
        }
        break;
      }
      case 'realm.build': {
        const pid = d.player, kind = d.kind, b = BUILDINGS[kind];
        if (!st.players[pid] || !b || !canPay(purse(pid), b.cost)) break;
        if (kind === 'road') {
          if (!canRoad(realm, pid, d.hex, d.to)) break;
          realm.roads[roadKey(d.hex, d.to)] = { player: pid, ts: e.ts };
        } else if (kind === 'settlement') {
          if (!canSettle(realm, pid, d.hex)) break;
          realm.hexes[d.hex].building = { player: pid, kind, ts: e.ts };
        } else {
          const h = realm.hexes[d.hex];
          if (!h || !h.building || h.building.player !== pid || h.building.kind !== 'settlement') break;
          h.building = { player: pid, kind, ts: e.ts };
        }
        pay(purse(pid), b.cost);
        realmScore();
        award(pid, {}, e);
        break;
      }
      // Two players swap resources, or one swaps 4 of a kind with the bank for 1 of another.
      case 'realm.trade': {
        const give = cleanBundle(d.give), get = cleanBundle(d.get);
        if (!st.players[d.player] || !Object.keys(give).length || !Object.keys(get).length) break;
        if (d.with === 'bank') {
          const [gk, gn] = Object.entries(give)[0], [wk, wn] = Object.entries(get)[0];
          if (Object.keys(give).length !== 1 || Object.keys(get).length !== 1 || gk === wk || gn !== BANK_RATE * wn || !canPay(purse(d.player), give)) break;
        } else if (!st.players[d.with] || d.with === d.player || !canPay(purse(d.player), give) || !canPay(purse(d.with), get)) break;
        pay(purse(d.player), give); pay(purse(d.player), get, 1);
        if (d.with !== 'bank') { pay(purse(d.with), get); pay(purse(d.with), give, 1); }
        break;
      }
    }
  }

  realmScore();
  for (const t of Object.values(st.trips)) t.hexHits = [...t.hexHits];

  // The newest trip that hasn't been ended is the one being played.
  st.activeTrip = null;
  for (let i = st.tripOrder.length - 1; i >= 0; i--) {
    const t = st.trips[st.tripOrder[i]];
    if (!t.end) { st.activeTrip = t; break; }
  }
  return st;
}

// ---------- The Realm ----------
// The game played after a trip, a bit like Settlers of Catan. Every sighting
// with a location lands on a hex laid over the real map. Whoever has made the
// most sightings in a hex holds that territory. Sightings also earn resources,
// paid out when a trip ends, and players spend them on roads, settlements and
// cities, and trade them with each other. The board grows with every trip.

const RESOURCES = [
  { id: 'wool', name: 'Wool', icon: '🐑', from: 'flocks' },
  { id: 'brick', name: 'Bricks', icon: '🧱', from: 'zombies' },
  { id: 'ore', name: 'Ore', icon: '⛏️', from: 'Volvo points' },
  { id: 'grain', name: 'Grain', icon: '🌾', from: 'plates' },
  { id: 'lumber', name: 'Lumber', icon: '🪵', from: 'cemeteries and churches' },
];
// What each kind of sighting is worth, and the terrain a hex full of them becomes.
const PIN_RESOURCE = { flock: 'wool', zombie: 'brick', volvo: 'ore', plate: 'grain', cemetery: 'lumber', church: 'lumber' };
const TERRAIN = { wool: '🌿 Pasture', brick: '🧱 Hills', ore: '⛰️ Mountains', grain: '🌾 Fields', lumber: '🌲 Forest' };
const BUILDINGS = {
  road: { name: 'Road', icon: '🛣️', cost: { brick: 1, lumber: 1 } },
  settlement: { name: 'Settlement', icon: '🏠', points: 1, cost: { brick: 1, lumber: 1, wool: 1, grain: 1 } },
  city: { name: 'City', icon: '🏰', points: 2, cost: { grain: 2, ore: 3 } },
};
const BANK_RATE = 4;
const LONGEST_ROAD_MIN = 5, BIGGEST_LAND_MIN = 3, BONUS_POINTS = 2;
// Sightings per resource, paid out at the end of a trip, plus one of each for taking part.
const EARN_EVERY = { wool: 3, brick: 2, ore: 3, grain: 4, lumber: 1 };

// Pointy-top hexes about 20 km across, on a simple flat projection of the map.
const HEX = 0.18, HEX_LAT0 = Math.cos(40 * Math.PI / 180);
function hexAt(lat, lon) {
  const x = lon * HEX_LAT0, y = lat;
  let q = (Math.sqrt(3) / 3 * x - y / 3) / HEX, r = (2 / 3 * y) / HEX, z = -q - r;
  let rq = Math.round(q), rr = Math.round(r); const rz = Math.round(z);
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), dz = Math.abs(rz - z);
  if (dq > dr && dq > dz) rq = -rr - rz; else if (dr > dz) rr = -rq - rz;
  return rq + ',' + rr;
}
function hexCorners(key) {
  const [q, r] = key.split(',').map(Number);
  const cx = HEX * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r), cy = HEX * 1.5 * r;
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 180 * (60 * i - 30);
    pts.push([cy + HEX * Math.sin(a), (cx + HEX * Math.cos(a)) / HEX_LAT0]);
  }
  return { center: [cy, cx / HEX_LAT0], corners: pts };
}
const HEX_DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
function hexNeighbors(key) {
  const [q, r] = key.split(',').map(Number);
  return HEX_DIRS.map(([dq, dr]) => (q + dq) + ',' + (r + dr));
}
const roadKey = (a, b) => a < b ? a + '|' + b : b + '|' + a;
const emptyPurse = () => Object.fromEntries(RESOURCES.map(r => [r.id, 0]));
const canPay = (purse, cost) => Object.entries(cost).every(([k, n]) => (purse[k] || 0) >= n);
const pay = (purse, cost, sign = -1) => { for (const [k, n] of Object.entries(cost)) purse[k] = (purse[k] || 0) + sign * n; };
function cleanBundle(b) {
  const out = {};
  for (const r of RESOURCES) { const n = Math.floor(Number(b && b[r.id]) || 0); if (n > 0 && n < 1000) out[r.id] = n; }
  return out;
}

function emptyRealm() { return { hexes: {}, roads: {}, purse: {}, points: {}, roadLength: {}, land: {}, longest: null, biggest: null }; }

// The longest chain of one player's roads, counted in roads, without using a road twice.
function longestRoad(roads, pid) {
  const adj = {};
  for (const [k, r] of Object.entries(roads)) {
    if (r.player !== pid) continue;
    const [a, b] = k.split('|');
    (adj[a] = adj[a] || []).push([b, k]);
    (adj[b] = adj[b] || []).push([a, k]);
  }
  let best = 0;
  const used = new Set();
  const walk = (node, len) => {
    best = Math.max(best, len);
    for (const [next, k] of adj[node] || []) {
      if (used.has(k)) continue;
      used.add(k); walk(next, len + 1); used.delete(k);
    }
  };
  for (const node of Object.keys(adj)) walk(node, 0);
  return best;
}

// Can this player put a building on this hex, or a road between these two hexes?
function canSettle(realm, pid, key) {
  const h = realm.hexes[key];
  if (!h || h.building) return false;
  if (h.owner === pid) return true;
  return hexNeighbors(key).some(n => { const r = realm.roads[roadKey(key, n)]; return r && r.player === pid; });
}
function canRoad(realm, pid, a, b) {
  if (!realm.hexes[a] || !realm.hexes[b] || !hexNeighbors(a).includes(b) || realm.roads[roadKey(a, b)]) return false;
  const mine = k => { const h = realm.hexes[k]; return (h.building && h.building.player === pid) || hexNeighbors(k).some(n => { const r = realm.roads[roadKey(k, n)]; return r && r.player === pid; }); };
  return mine(a) || mine(b);
}

// Endorsements: the little extras printed on a certificate, saying how a
// player played a game on one trip ("With only cows", "By a landslide").
function endorsements(trip, pid, game) {
  const tp = trip && trip.by[pid];
  if (!tp) return [];
  const out = [];
  const won = id => (trip.winners[id] || []).includes(pid);
  const only = (by, list) => { const ks = Object.keys(by).filter(k => by[k] > 0); return ks.length === 1 ? list.find(x => x.id === ks[0]) : null; };
  const margin = (c) => {
    const mine = c.score(tp), rest = trip.players.filter(p => p !== pid).map(p => c.score(trip.by[p]));
    const next = rest.length ? Math.max(...rest) : 0;
    if (mine > 0 && (next === 0 ? rest.length > 0 : mine >= 2 * next)) out.push('By a landslide');
    else if (mine > next && mine - next <= Math.max(2, Math.round(mine * 0.05))) out.push('Photo finish');
  };
  const contest = id => CONTESTS.find(c => c.id === id);
  if (game === 'flocks') {
    const a = only(tp.byAnimal, ANIMALS);
    if (a) out.push(`With only ${a.name.toLowerCase()}`);
    if (ANIMALS.every(x => tp.byAnimal[x.id])) out.push('Every animal on the farm');
    if (tp.deaths === 0 && tp.counted > 0) out.push('Never lost a flock');
    if (tp.deaths > 0) out.push(tp.deaths === 1 ? 'Survived a cemetery' : `Survived ${tp.deaths} cemeteries`);
    if (tp.churches > 0 && tp.deaths > 0) out.push('Saved by a church');
    if (tp.kills >= 3) out.push(`Buried ${tp.kills} flocks`);
    if (won('flocks')) margin(contest('flocks'));
  } else if (game === 'zombies') {
    const z = only(tp.zombieBy, ZOMBIES);
    if (z && tp.zombies > 1) out.push(`Nothing but ${z.name.toLowerCase()}`);
    if (ZOMBIES.every(x => tp.zombieBy[x.id])) out.push('All six kinds');
    if (won('zombies')) margin(contest('zombies'));
  } else if (game === 'volvos') {
    const c = only(tp.volvoBy, VOLVO_COLORS);
    if (c && tp.volvos > 1 && c.id !== 'other') out.push(`Only ${c.name.toLowerCase()} trucks`);
    if (Object.keys(tp.volvoBy).length >= 6) out.push('A rainbow of trucks');
    if (tp.volvoBranded >= 3 && tp.volvoBranded * 2 >= tp.volvos) out.push('Say-it-twice specialist');
    if (won('volvos')) margin(contest('volvos'));
  } else if (game === 'plates') {
    const n = US_STATES.filter(st => trip.plates[st]).length;
    if (n) out.push(`${n} state${n === 1 ? '' : 's'} this trip`);
    if (Object.keys(trip.plates).some(k => k.startsWith('CA-'))) out.push('Plates from Canada');
  }
  return out;
}

// The last thing a player did on a trip in one game that can still be undone.
const UNDO_KINDS = {
  flocks: ['flock.add', 'flock.cemetery', 'flock.church', 'flock.wipe'],
  zombies: ['zombie.add'],
  volvos: ['volvo.add'],
  realm: ['realm.build', 'realm.trade'],
};
function lastUndoable(events, st, tripId, playerId, game) {
  const kinds = new Set(UNDO_KINDS[game] || Object.values(UNDO_KINDS).flat());
  let best = null;
  for (const e of events) {
    if (!kinds.has(e.type) || st.undone.has(e.id) || !e.data || (game !== 'realm' && e.data.trip !== tripId)) continue;
    if (playerId && e.data.player !== playerId) continue;
    if (!best || e.ts > best.ts || (e.ts === best.ts && e.id > best.id)) best = e;
  }
  return best;
}

if (typeof module !== 'undefined') module.exports = { ANIMALS, ZOMBIES, VOLVO_COLORS, PLATES, PLATE_REGIONS, US_STATES, AWARDS, LEVEL_TITLES, levelFor, plateKey, endorsements, RESOURCES, BUILDINGS, TERRAIN, BANK_RATE, EARN_EVERY, LONGEST_ROAD_MIN, BIGGEST_LAND_MIN, hexAt, hexCorners, hexNeighbors, roadKey, canSettle, canRoad, canPay, longestRoad, CONTESTS, PLAYER_COLORS, MAX_PLAYERS, volvoName, buildState, lastUndoable };
