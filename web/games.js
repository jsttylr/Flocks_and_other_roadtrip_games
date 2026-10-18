// The rules of the games, and how scores, stats and awards are worked out from
// the list of events. Nothing in here touches the page, so it can be tested.

// The page's version. It must match appVersion in main.go (a Go test checks),
// so a page left over on the iPad can tell the server has a newer one.
const PAGE_VERSION = '0.4.1';

// Flocks: live animals. A cemetery kills flocks; a church brings yours back.
// Deer count too, but they aren't farm animals, so Old MacDonald doesn't need them.
const ANIMALS = [
  { id: 'cow', name: 'Cows', icon: '🐄', farm: true },
  { id: 'horse', name: 'Horses', icon: '🐎', farm: true },
  { id: 'sheep', name: 'Sheep', icon: '🐑', farm: true },
  { id: 'goat', name: 'Goats', icon: '🐐', farm: true },
  { id: 'chicken', name: 'Chickens', icon: '🐔', farm: true },
  { id: 'llama', name: 'Llamas & alpacas', icon: '🦙', farm: true },
  { id: 'pig', name: 'Pigs', icon: '🐖', farm: true },
  { id: 'deer', name: 'Deer', icon: '🦌' },
];
const FARM_ANIMALS = ANIMALS.filter(a => a.farm);

// Zombie flocks: roadkill. Already dead, so cemeteries and churches leave them alone.
const ZOMBIES = [
  { id: 'deer', name: 'Deer', icon: '🦌' },
  { id: 'rabbit', name: 'Rabbits', icon: '🐇' },
  { id: 'squirrel', name: 'Squirrels', icon: '🐿️' },
  { id: 'fox', name: 'Foxes', icon: '🦊' },
  { id: 'raccoon', name: 'Raccoons', icon: '🦝' },
  { id: 'opossum', name: 'Opossums', icon: '🐀' },
  { id: 'groundhog', name: 'Groundhogs', icon: '🦫' },
  { id: 'iguana', name: 'Iguanas', icon: '🦎' },
];

// Fields: crops spotted from the car, a game of their own. Each field also
// puts one of the spotter's farmers on that tile of the Realm.
const CROPS = [
  { id: 'corn', name: 'Corn', icon: '🌽' },
  { id: 'soy', name: 'Soybeans', icon: '🫘' },
  { id: 'wheat', name: 'Wheat', icon: '🌾' },
  { id: 'tobacco', name: 'Tobacco', icon: '🍂' },
  { id: 'cotton', name: 'Cotton', icon: '☁️' },
  { id: 'hay', name: 'Hay', icon: '🪹' },
  { id: 'sunflower', name: 'Sunflowers', icon: '🌻' },
  { id: 'pumpkin', name: 'Pumpkins', icon: '🎃' },
  { id: 'orchard', name: 'Orchard', icon: '🍎', res: 'lumber' },
  { id: 'vineyard', name: 'Vineyard', icon: '🍇', res: 'lumber' },
];
const cropRes = id => (CROPS.find(c => c.id === id) || {}).res || 'grain';

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
// Other Volvos, scored on the same tab: classic cars, wagons and equipment.
const VOLVO_OTHERS = [
  { id: 'classic', short: 'Classic', name: 'Classic Volvo', note: '140, 240, 740 or 850', icon: '🚗', points: 2 },
  { id: 'wagon', short: 'Wagon', name: 'Volvo wagon', note: 'any newer estate', icon: '🚙', points: 1 },
  { id: 'excavator', short: 'Excavator', name: 'Volvo excavator', note: 'construction', icon: '🏗️', points: 2 },
  { id: 'loader', short: 'Loader', name: 'Volvo wheel loader', note: 'construction', icon: '🚜', points: 2 },
  { id: 'hauler', short: 'Hauler', name: 'Volvo dump truck', note: 'construction hauler', icon: '⛰️', points: 2 },
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
  { id: 'old_macdonald', repeat: true, game: 'flocks', icon: '🚜', name: 'Old MacDonald', desc: 'Count all seven kinds of farm animal on one trip', check: c => c.tp && FARM_ANIMALS.every(a => c.tp.byAnimal[a.id]) },
  { id: 'bambi', repeat: true, game: 'flocks', icon: '🫎', name: 'Bambi Spotter', desc: 'Count 5 live deer on one trip', check: c => c.tp && (c.tp.byAnimal.deer || 0) >= 5 },
  { id: 'triple_crown', repeat: true, game: 'flocks', icon: '🎖️', name: 'Triple Crown', desc: 'Win Flocks, Zombies and Volvos on the same trip', check: c => c.won && ['flocks', 'zombies', 'volvos'].every(g => c.won.includes(g)) },
  { id: 'ghost_story', hidden: true, repeat: true, game: 'flocks', icon: '👻', name: 'Ghost Story', desc: 'Call a cemetery on Halloween', check: c => c.e.type === 'flock.cemetery' && day(c.e.ts).m === 10 && day(c.e.ts).d === 31 },
  { id: 'easter', hidden: true, repeat: true, game: 'flocks', icon: '🥚', name: 'He Is Risen', desc: 'Bring your flock back with a church on Easter Sunday', check: c => { if (c.e.type !== 'flock.church') return false; const t = day(c.e.ts), x = easter(t.y); return t.m === x.m && t.d === x.d; } },

  { id: 'first_zombie', game: 'zombies', icon: '🧟', name: 'Zombie Spotter', desc: 'Spot your first zombie', check: c => c.life.zombies >= 1 },
  { id: 'zombie_hunter', game: 'zombies', icon: '🔦', name: 'Zombie Hunter', desc: 'Spot 25 zombies over all your trips', check: c => c.life.zombies >= 25 },
  { id: 'apocalypse', game: 'zombies', icon: '☣️', name: 'Zombie Apocalypse', desc: 'Spot 100 zombies over all your trips', check: c => c.life.zombies >= 100 },
  { id: 'zombie_zoo', repeat: true, game: 'zombies', icon: '🐾', name: 'Zombie Zoo', desc: 'Spot all eight kinds of zombie on one trip', check: c => c.tp && ZOMBIES.every(z => c.tp.zombieBy[z.id]) },
  { id: 'zombie_king', repeat: true, game: 'zombies', icon: '🦴', name: 'Zombie King', desc: 'Have the biggest zombie flock at the end of a trip', check: c => c.won && c.won.includes('zombies') },
  { id: 'oh_deer', repeat: true, game: 'zombies', icon: '🦌', name: 'Oh Deer', desc: 'Spot 10 zombie deer on one trip', check: c => c.tp && (c.tp.zombieBy.deer || 0) >= 10 },
  { id: 'halloween', hidden: true, repeat: true, game: 'zombies', icon: '🎃', name: 'Trick or Treat', desc: 'Spot a zombie on Halloween', check: c => zombieOn(c, t => t.m === 10 && t.d === 31) },
  { id: 'dia_muertos', hidden: true, repeat: true, game: 'zombies', icon: '🌼', name: 'Día de los Muertos', desc: 'Spot a zombie on the Day of the Dead (November 1 or 2)', check: c => zombieOn(c, t => t.m === 11 && t.d <= 2) },
  { id: 'friday13', hidden: true, repeat: true, game: 'zombies', icon: '🔪', name: 'Friday the 13th', desc: 'Spot a zombie on Friday the 13th', check: c => zombieOn(c, t => t.wd === 5 && t.d === 13) },
  { id: 'witching_hour', hidden: true, repeat: true, game: 'zombies', icon: '🕛', name: 'Witching Hour', desc: 'Spot a zombie between midnight and 3 in the morning', check: c => zombieOn(c, t => t.h < 3) },
  { id: 'full_moon', hidden: true, repeat: true, game: 'zombies', icon: '🌕', name: 'Bad Moon Rising', desc: 'Spot a zombie on the night of a full moon', check: c => zombieOn(c, () => fullMoon(c.e.ts)) },
  { id: 'here_be_dragons', game: 'zombies', icon: '🦖', name: 'Here Be Dragons', desc: 'Spot a zombie iguana', check: c => (c.life.zombieBy.iguana || 0) >= 1 },
  { id: 'shadow', hidden: true, repeat: true, game: 'zombies', icon: '🌤️', name: 'Six More Weeks', desc: 'Spot a zombie groundhog on Groundhog Day (February 2)', check: c => zombieOn(c, (t, e) => e.data.animal === 'groundhog' && t.m === 2 && t.d === 2) },
  { id: 'rudolph', hidden: true, repeat: true, game: 'zombies', icon: '🎄', name: 'Grandma Got Run Over', desc: 'Spot a zombie deer on Christmas Eve or Christmas Day', check: c => zombieOn(c, (t, e) => e.data.animal === 'deer' && t.m === 12 && (t.d === 24 || t.d === 25)) },

  { id: 'first_volvo', game: 'volvos', icon: '🚚', name: 'Truck Spotter', desc: 'Spot your first Volvo truck', check: c => c.life.volvos >= 1 },
  { id: 'say_it_twice', game: 'volvos', icon: '🗣️', name: 'Say It Twice', desc: 'Spot a Volvo truck with VOLVO on the fairing', check: c => c.life.volvoBranded >= 1 },
  { id: 'rainbow', repeat: true, game: 'volvos', icon: '🌈', name: 'Rainbow Fleet', desc: 'Spot Volvo trucks in 6 colours on one trip', check: c => c.tp && Object.keys(c.tp.volvoBy).length >= 6 },
  { id: 'convoy', game: 'volvos', icon: '🛻', name: 'Convoy', desc: 'Spot 100 Volvo trucks over all your trips', check: c => c.life.volvos >= 100 },
  { id: 'volvo_champ', repeat: true, game: 'volvos', icon: '🥇', name: 'Volvo Champion', desc: 'Score the most Volvo points on a trip', check: c => c.won && c.won.includes('volvos') },
  { id: 'brick', game: 'volvos', icon: '🧱', name: 'The Brick', desc: 'Spot a classic Volvo (140, 240, 740 or 850)', check: c => (c.life.volvoKind.classic || 0) >= 1 },
  { id: 'family_hauler', game: 'volvos', icon: '🎒', name: 'Family Hauler', desc: 'Spot 10 Volvo wagons over all your trips', check: c => (c.life.volvoKind.wagon || 0) >= 10 },
  { id: 'heavy_metal', game: 'volvos', icon: '👷', name: 'Heavy Metal', desc: 'Spot a piece of Volvo construction equipment', check: c => ['excavator', 'loader', 'hauler'].some(k => c.life.volvoKind[k]) },
  { id: 'smorgasbord', repeat: true, game: 'volvos', icon: '🇸🇪', name: 'Smörgåsbord', desc: 'Spot a Volvo truck and every other kind of Volvo on one trip', check: c => c.tp && c.tp.volvos > 0 && VOLVO_OTHERS.every(k => c.tp.volvoKind[k.id]) },
  { id: 'fleet', repeat: true, game: 'volvos', icon: '🚛', name: 'Fleet Manager', desc: 'Spot 25 Volvo trucks on one trip', check: c => c.tp && c.tp.volvos >= 25 },

  { id: 'first_field', game: 'fields', icon: '🌱', name: 'Green Thumb', desc: 'Spot your first field', check: c => c.life.fields >= 1 },
  { id: 'corn_maze', game: 'fields', icon: '🌽', name: 'Corn Maze', desc: 'Spot 25 corn fields over all your trips', check: c => (c.life.cropBy.corn || 0) >= 25 },
  { id: 'orchard_keeper', game: 'fields', icon: '🍏', name: 'Orchard Keeper', desc: 'Spot 10 orchards over all your trips', check: c => (c.life.cropBy.orchard || 0) >= 10 },
  { id: 'harvest_moon', repeat: true, game: 'fields', icon: '🎑', name: 'Harvest Moon', desc: 'Spot every kind of crop on one trip', check: c => c.tp && CROPS.every(x => c.tp.cropBy[x.id]) },
  { id: 'field_champ', repeat: true, game: 'fields', icon: '🏵️', name: 'Field Marshal', desc: 'Spot the most fields on a trip', check: c => c.won && c.won.includes('fields') },
  { id: 'great_plains', game: 'fields', icon: '🌄', name: 'Great Plains', desc: 'Spot 250 fields over all your trips', check: c => c.life.fields >= 250 },
  { id: 'jack_o', hidden: true, repeat: true, game: 'fields', icon: '🕯️', name: 'Pumpkin King', desc: 'Spot a pumpkin patch in October', check: c => c.e.type === 'field.add' && c.e.data.crop === 'pumpkin' && day(c.e.ts).m === 10 },

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
  { id: 'land_baron', game: 'realm', icon: '🏞️', name: 'Land Baron', desc: 'Hold Biggest Territory in the Realm', check: c => c.realm && c.realm.biggest === c.pid },
  { id: 'trailhead', game: 'realm', icon: '🚧', name: 'Trailhead', desc: 'Build your first road', check: c => c.life.realm.roads >= 1 },
  { id: 'road_crew', game: 'realm', icon: '🦺', name: 'Road Crew', desc: 'Build 10 roads', check: c => c.life.realm.roads >= 10 },
  { id: 'township', game: 'realm', icon: '🏘️', name: 'Township', desc: 'Build 3 settlements', check: c => c.life.realm.settlements >= 3 },
  { id: 'metropolis', game: 'realm', icon: '🌆', name: 'Metropolis', desc: 'Grow 3 cities', check: c => c.life.realm.cities >= 3 },
  { id: 'handshake', game: 'realm', icon: '🤝', name: 'Handshake', desc: 'Make your first trade with another player', check: c => c.life.realm.trades >= 1 },
  { id: 'wheeler_dealer', game: 'realm', icon: '💱', name: 'Wheeler Dealer', desc: 'Make 10 trades with other players', check: c => c.life.realm.trades >= 10 },
  { id: 'banker', game: 'realm', icon: '🏦', name: 'Money Talks', desc: 'Trade with the bank', check: c => c.life.realm.bank >= 1 },
  { id: 'robber_baron', game: 'realm', icon: '🦹', name: 'Robber Baron', desc: 'Steal 10 resources with cemeteries', check: c => c.life.realm.stolen >= 10 },
  { id: 'harvest_home', game: 'realm', icon: '🧺', name: 'Harvest Home', desc: 'Collect a harvest from your settlement', check: c => c.life.realm.harvested >= 1 },
  { id: 'treasure', game: 'realm', icon: '💰', name: 'Treasure Chest', desc: 'Hold 5 of every resource at once', check: c => c.realm && c.realm.purse[c.pid] && RESOURCES.every(r => c.realm.purse[c.pid][r.id] >= 5) },
  { id: 'knighted', game: 'realm', icon: '🛡️', name: 'Knighted', desc: 'Reach the rank of Knight (3 Realm points)', check: c => c.realm && (c.realm.points[c.pid] || 0) >= 3 },
  { id: 'duke', game: 'realm', icon: '🎩', name: 'Your Grace', desc: 'Reach the rank of Duke (15 Realm points)', check: c => c.realm && (c.realm.points[c.pid] || 0) >= 15 },
  { id: 'monarch', game: 'realm', icon: '🫅', name: 'Long Live the Monarch', desc: 'Reach 21 Realm points', check: c => c.realm && (c.realm.points[c.pid] || 0) >= 21 },
  { id: 'abbot', game: 'realm', icon: '🛐', name: 'Abbot', desc: 'Found a monastery with a church', check: c => c.life.realm.monasteries >= 1 },
  { id: 'full_circle', game: 'realm', icon: '⭕', name: 'Full Circle', desc: 'Complete a monastery (visit all 6 tiles around it)', check: c => c.life.realm.completed >= 1 },
  { id: 'gold_rush', game: 'realm', icon: '🪙', name: 'Gold Rush', desc: 'Hold 20 gold at once', check: c => c.realm && c.realm.purse[c.pid] && c.realm.purse[c.pid].gold >= 20 },
  { id: 'breadbasket', game: 'realm', icon: '🥖', name: 'Breadbasket', desc: 'Hold a farm of 5 tiles or more', check: c => c.realm && c.realm.farms.some(f => f.owners.includes(c.pid) && f.hexes.length >= 5) },
  { id: 'first_steps', game: 'explore', icon: '👣', name: 'First Steps', desc: 'Explore your first new map tile', check: c => c.life.explore.tiles >= 1 },
  { id: 'pioneer', game: 'explore', icon: '🚩', name: 'Pioneer', desc: 'Be the first to spot something in a new tile', check: c => c.life.explore.pioneered >= 1 },
  { id: 'frontier', game: 'explore', icon: '🏕️', name: 'Frontier Spirit', desc: 'Pioneer 50 tiles', check: c => c.life.explore.pioneered >= 50 },
  { id: 'off_the_map', repeat: true, game: 'explore', icon: '🔭', name: 'Off the Map', desc: 'Explore 40 new tiles on one trip', check: c => c.tp && c.tp.explored >= 40 },
  { id: 'cartographer', game: 'explore', icon: '📜', name: 'Cartographer', desc: 'Explore 200 tiles', check: c => c.life.explore.tiles >= 200 },
  { id: 'regular', game: 'explore', icon: '☕', name: 'Regulars', desc: 'Pass through the same tile on 10 trips', check: c => c.life.explore.mostVisits >= 10 },
  { id: 'far_from_home', game: 'explore', icon: '🛰️', name: 'Far From Home', desc: 'Reach a tile 500 km from where your map began', check: c => c.life.explore.farthest >= 500 },
  { id: 'thousand_miles', game: 'explore', icon: '🌎', name: 'A Thousand Miles', desc: 'Reach a tile 1,600 km from where your map began', check: c => c.life.explore.farthest >= 1600 },
  { id: 'first_leg', game: 'drive', icon: '🔑', name: 'Behind the Wheel', desc: 'Drive part of a trip', check: c => c.life.drive.km > 0 },
  { id: 'wheelman', repeat: true, game: 'drive', icon: '🏎️', name: 'Wheelman', desc: 'Drive 50 km on one trip', check: c => c.tp && c.tp.driven >= 50 },
  { id: 'marathon', repeat: true, game: 'drive', icon: '⏱️', name: 'Marathon', desc: 'Drive 300 km without swapping drivers', check: c => c.tp && c.tp.bestStint >= 300 },
  { id: 'relay', repeat: true, game: 'drive', icon: '🔄', name: 'Relay Team', desc: 'Swap drivers 3 times on one trip (everyone in the car gets it)', check: c => c.trip && c.trip.swaps >= 3 },
  { id: 'night_shift', game: 'drive', icon: '🦉', name: 'Night Shift', desc: 'Drive after 9 at night', check: c => c.life.drive.night > 0 },
  { id: 'chauffeur', game: 'drive', icon: '🧢', name: 'Chauffeur', desc: 'Drive on 10 trips', check: c => c.life.drive.trips >= 10 },
  { id: 'iron_butt', game: 'drive', icon: '🛞', name: 'Iron Butt', desc: 'Drive 1,000 km over all your trips', check: c => c.life.drive.km >= 1000 },
  { id: 'road_scholar', game: 'drive', icon: '📏', name: 'Road Scholar', desc: 'Drive 10,000 km over all your trips', check: c => c.life.drive.km >= 10000 },
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
  { id: 'fields', name: 'Fields', icon: '🌽', score: tp => tp.fields },
];

function emptyLife() {
  return {
    trips: 0, wins: { flocks: 0, zombies: 0, volvos: 0, fields: 0 },
    animals: 0, byAnimal: {}, biggest: 0, bestFlock: 0,
    kills: 0, deaths: 0, lost: 0, biggestLoss: 0, churches: 0, raised: 0, biggestRaise: 0,
    zombies: 0, zombieBy: {}, volvos: 0, volvoPoints: 0, volvoBy: {}, volvoBranded: 0, volvoKind: {},
    fields: 0, cropBy: {}, drive: { km: 0, trips: 0, night: 0, bestStint: 0 },
    uniquePlates: new Set(), awards: {}, badges: 0,
    explore: { tiles: 0, pioneered: 0, farthest: 0, mostVisits: 0 },
    realm: { roads: 0, settlements: 0, cities: 0, trades: 0, bank: 0, stolen: 0, harvested: 0, turns: 0, monasteries: 0, completed: 0, gold: 0, wage: 0 },
  };
}

function emptyTripPlayer() {
  return { explored: 0, fields: 0, cropBy: {}, driven: 0, stint: 0, bestStint: 0, score: 0, counted: 0, dead: 0, deaths: 0, kills: 0, churches: 0, byAnimal: {}, zombies: 0, zombieBy: {}, volvos: 0, volvoPoints: 0, volvoBy: {}, volvoBranded: 0, volvoKind: {} };
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
    const h = visit(trip, key, e, pid);
    const res = PIN_RESOURCE[kind];
    if (res) { h.kinds[res] = (h.kinds[res] || 0) + 1; h.terrain = RESOURCES.map(r => r.id).reduce((a, b) => (h.kinds[b] || 0) > (h.kinds[a] || 0) ? b : a, res); }
    if (pid) {
      h.counts[pid] = (h.counts[pid] || 0) + 1;
      if (!h.owner || (h.owner !== pid && h.counts[pid] > (h.counts[h.owner] || 0))) h.owner = pid;
    }
  };
  // A trip reaching a hex, by a sighting or just driving through. A hex nobody
  // in the family has been to before counts as explored for everyone in the
  // car; a first sighting there makes its spotter a pioneer.
  const visit = (trip, key, e, pid) => {
    let h = realm.hexes[key];
    if (!h) {
      h = realm.hexes[key] = { key, counts: {}, kinds: {}, owner: null, terrain: null, building: null, first: e.ts, trips: new Set(), spotted: false, farm: false, farmers: {}, monastery: null };
      if (!realm.home) realm.home = key;
      const km = hexKm(realm.home, key);
      for (const p of trip.aboard) {
        const l = life(p);
        l.explore.tiles++;
        l.explore.farthest = Math.max(l.explore.farthest, km);
        trip.by[p].explored++;
      }
    }
    if (pid && !h.spotted) life(pid).explore.pioneered++;
    if (pid) h.spotted = true;
    if (!h.trips.has(trip.id)) {
      h.trips.add(trip.id);
      for (const p of trip.aboard) life(p).explore.mostVisits = Math.max(life(p).explore.mostVisits, h.trips.size);
    }
    trip.hexHits.add(key);
    return h;
  };
  // Checks and returns the trip and player an in-trip event is about.
  const inTrip = d => {
    const trip = st.trips[d.trip];
    if (!trip || trip.end || !trip.aboard.has(d.player)) return null;
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
    realm.farms = farmRegions(realm);
    for (const h of Object.values(realm.hexes)) if (h.owner) realm.land[h.owner] = (realm.land[h.owner] || 0) + 1;
    for (const p of pids) realm.roadLength[p] = longestRoad(realm.roads, p);
    realm.longest = best(realm.roadLength, LONGEST_ROAD_MIN, realm.longest);
    realm.biggest = best(realm.land, BIGGEST_LAND_MIN, realm.biggest);
    for (const p of pids) {
      let pts = 0;
      for (const h of Object.values(realm.hexes)) {
        if (h.building && h.building.player === p) pts += BUILDINGS[h.building.kind].points;
        if (h.monastery && h.monastery.complete && h.monastery.player === p) pts += 1;
      }
      // A farm's owners score 1 for every city it feeds, like Carcassonne farmers.
      for (const f of realm.farms) if (f.owners.includes(p)) pts += f.cities;
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
        const trip = { id: d.id, name: String(d.name || 'Road trip'), players, aboard: new Set(players), start: e.ts, end: null, by: {}, plates: {}, pins: [], winners: {}, awards: [], badgesAtEnd: {}, earned: {}, paid: {}, wage: {}, hexHits: new Set(), steals: [],
          driver: players.includes(d.driver) ? d.driver : null, legs: [], swaps: 0, km: 0, track: [], lastTrack: null };
        trip.legs.push({ player: trip.driver, ts: e.ts });
        st.trips[d.id] = trip;
        st.tripOrder.push(d.id);
        for (const pid of players) {
          trip.by[pid] = emptyTripPlayer();
          life(pid).trips++;
          award(pid, { trip, tp: trip.by[pid] }, e);
        }
        break;
      }
      // Someone hops in or out of the car at a stop. They only play while aboard.
      case 'trip.crew': {
        const trip = st.trips[d.trip];
        if (!trip || trip.end || !st.players[d.player]) break;
        if (d.aboard) {
          if (trip.aboard.has(d.player) || trip.aboard.size >= MAX_PLAYERS) break;
          trip.aboard.add(d.player);
          if (!trip.by[d.player]) {
            trip.players.push(d.player);
            trip.by[d.player] = emptyTripPlayer();
            life(d.player).trips++;
            award(d.player, { trip, tp: trip.by[d.player] }, e);
          }
        } else {
          if (!trip.aboard.has(d.player)) break;
          trip.aboard.delete(d.player);
          if (trip.driver === d.player) { trip.driver = null; trip.legs.push({ player: null, ts: e.ts }); }
        }
        break;
      }
      // A new driver: a player in the car, or null for someone not playing.
      case 'trip.driver': {
        const trip = st.trips[d.trip];
        const pid = d.player && trip && trip.aboard.has(d.player) ? d.player : null;
        if (!trip || trip.end || (d.player && !pid) || trip.driver === pid) break;
        trip.driver = pid;
        trip.swaps++;
        trip.legs.push({ player: pid, ts: e.ts });
        if (pid) trip.by[pid].stint = 0;
        for (const p of trip.aboard) award(p, { trip, tp: trip.by[p] }, e);
        break;
      }
      // A GPS spot saved about every half a kilometre: the route, the distance
      // and who drove it, and the tiles driven through.
      case 'trip.track': {
        const trip = st.trips[d.trip], loc = cleanLoc(d.loc);
        if (!trip || trip.end || !loc) break;
        const km = trip.lastTrack ? kmBetween(trip.lastTrack, loc) : 0;
        if (km > 0 && km < MAX_HOP_KM) {
          trip.km += km;
          const pid = trip.driver;
          if (pid) {
            const tp = trip.by[pid], l = life(pid), t = day(e.ts);
            if (!tp.driven) l.drive.trips++;
            tp.driven += km;
            tp.stint += km;
            tp.bestStint = Math.max(tp.bestStint, tp.stint);
            l.drive.km += km;
            l.drive.bestStint = Math.max(l.drive.bestStint, tp.stint);
            if (t.h >= 21 || t.h < 5) l.drive.night += km;
          }
        }
        trip.lastTrack = loc;
        trip.track.push([loc.lat, loc.lon]);
        visit(trip, hexAt(loc.lat, loc.lon), e, null);
        for (const pid of trip.aboard) award(pid, { trip, tp: trip.by[pid] }, e);
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
        // coming along, the driver's wage, a harvest from settled hexes someone
        // drove through, grain from farms, and gold from monasteries.
        const sighted = {};
        for (const pid of trip.players) {
          const seen = trip.earned[pid] || emptyPurse();
          sighted[pid] = RESOURCES.reduce((n, r) => n + Math.floor(seen[r.id] / EARN_EVERY[r.id]), 0);
        }
        const farms = farmRegions(realm);
        for (const pid of trip.players) {
          const got = emptyPurse(), seen = trip.earned[pid] || emptyPurse(), tp = trip.by[pid];
          for (const r of RESOURCES) got[r.id] = Math.floor(seen[r.id] / EARN_EVERY[r.id]) + 1;
          // The driver can't spot much, so they're paid by the km, and never
          // less than the passengers' average for the share of the trip they drove.
          const others = trip.players.filter(p => p !== pid);
          const wage = Math.floor(tp.driven / WAGE_KM);
          let topup = 0;
          if (tp.driven > 0 && trip.km > 0 && others.length) {
            const avg = others.reduce((n, p) => n + sighted[p], 0) / others.length;
            topup = Math.max(0, Math.floor(avg * Math.min(1, tp.driven / trip.km)) - sighted[pid]);
          }
          for (let i = 0; i < wage + topup; i++) got[WAGE_ORDER[i % WAGE_ORDER.length]]++;
          trip.wage[pid] = { wage, topup };
          life(pid).realm.wage += wage + topup;
          for (const key of trip.hexHits) {
            const b = realm.hexes[key].building, t = realm.hexes[key].terrain;
            if (b && b.player === pid && t) { const n = b.kind === 'city' ? 2 : 1; got[t] += n; life(pid).realm.harvested += n; }
          }
          for (const f of farms) if (f.owners.includes(pid)) got.grain += f.fed;
          // A monastery pays out after a trip that passes through its tile.
          for (const key of trip.hexHits) {
            const h = realm.hexes[key], m = h.monastery;
            if (!m || m.player !== pid) continue;
            const ring = hexNeighbors(h.key).filter(k => realm.hexes[k]).length;
            got.gold += ring;
            if (ring === 6 && !m.complete) { m.complete = true; got.gold += MONASTERY_BONUS; life(pid).realm.completed++; }
          }
          pay(purse(pid), got, 1);
          trip.paid[pid] = got;
        }
        // A cemetery is the robber: its caller takes one of each victim's most plentiful resource.
        for (const { thief, victims } of trip.steals) {
          for (const v of victims) {
            const vp = purse(v), top = RESOURCES.map(r => r.id).reduce((a, b) => vp[b] > vp[a] ? b : a);
            if (vp[top] > 0) { vp[top]--; purse(thief)[top]++; life(thief).realm.stolen++; }
          }
        }
        realmScore();
        // Turns in the Realm start over after every trip. Whoever did worst on
        // the trip goes first, which helps the youngest catch up.
        if (trip.players.length) {
          const place = pid => CONTESTS.reduce((n, c) => n + trip.players.filter(q => c.score(trip.by[q]) > c.score(trip.by[pid])).length, 0);
          const order = [...trip.players].sort((a, b) => place(b) - place(a));
          realm.turn = { order, i: 0, round: 1, trip: trip.id };
        }
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
        // The driver's flock is safe: they can't watch for churches.
        const victims = [...new Set(d.victims || [])].filter(v => x.trip.aboard.has(v) && v !== x.trip.driver);
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
        // The first church in a tile nobody has built in founds a monastery there.
        const cl = cleanLoc(d.loc), ch = cl && realm.hexes[hexAt(cl.lat, cl.lon)];
        if (ch && !ch.monastery && !ch.building) { ch.monastery = { player: d.player, ts: e.ts, complete: false }; x.l.realm.monasteries++; }
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
      case 'field.add': {
        const x = inTrip(d);
        if (!x) break;
        const crop = CROPS.find(c => c.id === d.crop) || CROPS[0];
        x.tp.fields++;
        x.tp.cropBy[crop.id] = (x.tp.cropBy[crop.id] || 0) + 1;
        x.l.fields++;
        x.l.cropBy[crop.id] = (x.l.cropBy[crop.id] || 0) + 1;
        pin(x.trip, e, 'field', `${crop.name} field`, crop.icon, d.player);
        // A field puts the spotter's farmer on that tile.
        const fl = cleanLoc(d.loc), fh = fl && realm.hexes[hexAt(fl.lat, fl.lon)];
        if (fh) { fh.farm = true; fh.farmers[d.player] = (fh.farmers[d.player] || 0) + 1; realm.farms = farmRegions(realm); }
        earn(x.trip, d.player, cropRes(crop.id));
        award(d.player, x, e);
        break;
      }
      case 'volvo.add': {
        const x = inTrip(d);
        if (!x) break;
        const other = VOLVO_OTHERS.find(k => k.id === d.kind);
        if (other) {
          x.tp.volvoKind[other.id] = (x.tp.volvoKind[other.id] || 0) + 1;
          x.l.volvoKind[other.id] = (x.l.volvoKind[other.id] || 0) + 1;
          x.tp.volvoPoints += other.points;
          x.l.volvoPoints += other.points;
          pin(x.trip, e, 'volvo', other.name, other.icon, d.player);
          earn(x.trip, d.player, 'ore', other.points);
          award(d.player, x, e);
          break;
        }
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
        for (const pid of trip.aboard) {
          earn(trip, pid, 'grain');
          life(pid).uniquePlates.add(d.plate);
          award(pid, { trip, tp: trip.by[pid] }, e);
        }
        break;
      }
      // The iPad drove into a hex it hadn't been in yet on this trip.
      case 'trip.hex': {
        const trip = st.trips[d.trip], loc = cleanLoc(d.loc);
        if (!trip || trip.end || !loc) break;
        visit(trip, hexAt(loc.lat, loc.lon), e, null);
        for (const pid of trip.aboard) award(pid, { trip, tp: trip.by[pid] }, e);
        break;
      }
      // Builds name tiles, so ones made on an older, bigger grid no longer
      // fit the map. They're skipped, which hands back what they cost.
      case 'realm.build': {
        const pid = d.player, kind = d.kind, b = BUILDINGS[kind];
        if (d.grid !== GRID || !st.players[pid] || !b || !realmMayPlay(realm, pid) || !canPay(purse(pid), b.cost)) break;
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
        life(pid).realm[kind === 'road' ? 'roads' : kind === 'settlement' ? 'settlements' : 'cities']++;
        realmScore();
        for (const p of st.playerOrder) award(p, {}, e);
        break;
      }
      // Two players swap resources, or one swaps 4 of a kind with the bank for 1 of another.
      case 'realm.trade': {
        const give = cleanBundle(d.give), get = cleanBundle(d.get);
        if (!st.players[d.player] || !realmMayPlay(realm, d.player) || !Object.keys(give).length || !Object.keys(get).length) break;
        if (d.with === 'bank') {
          const [gk, gn] = Object.entries(give)[0], [wk, wn] = Object.entries(get)[0];
          if (Object.keys(give).length !== 1 || Object.keys(get).length !== 1 || gk === wk || gk === 'gold' || wk === 'gold' || gn !== BANK_RATE * wn || !canPay(purse(d.player), give)) break;
        } else if (!st.players[d.with] || d.with === d.player || !canPay(purse(d.player), give) || !canPay(purse(d.with), get)) break;
        pay(purse(d.player), give); pay(purse(d.player), get, 1);
        if (d.with !== 'bank') { pay(purse(d.with), get); pay(purse(d.with), give, 1); life(d.player).realm.trades++; life(d.with).realm.trades++; award(d.with, {}, e); }
        else life(d.player).realm.bank++;
        award(d.player, {}, e);
        break;
      }
      // Gold from monasteries buys any resource.
      case 'realm.buy': {
        const pid = d.player, n = Math.floor(Number(d.n) || 1);
        if (!st.players[pid] || !realmMayPlay(realm, pid) || !RESOURCES.some(r => r.id === d.res) || n < 1 || n > 99 || purse(pid).gold < GOLD_PRICE * n) break;
        purse(pid).gold -= GOLD_PRICE * n;
        purse(pid)[d.res] += n;
        award(pid, {}, e);
        break;
      }
      // The player whose turn it is hands the dice on.
      case 'realm.pass': {
        const t = realm.turn;
        if (!t || realmCurrent(realm) !== d.player) break;
        life(d.player).realm.turns++;
        t.i++;
        if (t.i >= t.order.length) { t.i = 0; t.round++; }
        award(d.player, {}, e);
        break;
      }
    }
  }

  realmScore();
  for (const t of Object.values(st.trips)) { t.hexHits = [...t.hexHits]; t.aboard = [...t.aboard]; }
  for (const h of Object.values(realm.hexes)) h.visits = h.trips.size;

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
  { id: 'grain', name: 'Grain', icon: '🌾', from: 'plates and fields' },
  { id: 'lumber', name: 'Lumber', icon: '🪵', from: 'cemeteries, churches, orchards and vineyards' },
];
// What each kind of sighting is worth, and the terrain a hex full of them becomes.
const PIN_RESOURCE = { flock: 'wool', zombie: 'brick', volvo: 'ore', plate: 'grain', field: 'grain', cemetery: 'lumber', church: 'lumber' };
const TERRAIN = { wool: '🌿 Pasture', brick: '🧱 Hills', ore: '⛰️ Mountains', grain: '🌾 Fields', lumber: '🌲 Forest' };
const BUILDINGS = {
  road: { name: 'Road', icon: '🛣️', cost: { brick: 1, lumber: 1 } },
  settlement: { name: 'Settlement', icon: '🏠', points: 1, cost: { brick: 1, lumber: 1, wool: 1, grain: 1 } },
  city: { name: 'City', icon: '🏰', points: 2, cost: { grain: 2, ore: 3 } },
};
const BANK_RATE = 4;
const LONGEST_ROAD_MIN = 7, BIGGEST_LAND_MIN = 5, BONUS_POINTS = 2;
// Gold comes from monasteries: 1 for each visited tile around one, after
// every trip through it, and a bonus once all six are visited. It buys any resource.
const GOLD_PRICE = 2, MONASTERY_BONUS = 3;
// The driver's wage: one resource for every WAGE_KM driven, taking turns.
const WAGE_KM = 50, WAGE_ORDER = ['brick', 'lumber', 'ore', 'grain', 'wool'];
// A gap between GPS spots longer than this is a glitch, not driving.
const MAX_HOP_KM = 300;
// Sightings per resource, paid out at the end of a trip, plus one of each for taking part.
const EARN_EVERY = { wool: 3, brick: 2, ore: 3, grain: 4, lumber: 1 };

// Pointy-top hexes about 10 km across, on a simple flat projection of the map.
// GRID goes up whenever HEX changes, so builds on the old tiles are dropped.
const HEX = 0.09, GRID = 2, HEX_LAT0 = Math.cos(40 * Math.PI / 180);
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
// Distance between two places, and between two hex centres, in km.
function kmBetween(a, b) {
  const rad = Math.PI / 180;
  const h = Math.sin((b.lat - a.lat) * rad / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lon - a.lon) * rad / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
function hexKm(a, b) {
  const [la1, lo1] = hexCorners(a).center, [la2, lo2] = hexCorners(b).center;
  return Math.round(kmBetween({ lat: la1, lon: lo1 }, { lat: la2, lon: lo2 }));
}
// Farms, like Carcassonne's fields: tiles with a field spotted in them join up
// with their neighbours. Whoever has the most farmers in a farm owns it (ties
// share), and it feeds every settlement and city on it or next to it.
function farmRegions(realm) {
  const seen = new Set(), out = [];
  for (const start of Object.keys(realm.hexes)) {
    if (seen.has(start) || !realm.hexes[start].farm) continue;
    const hexes = [], todo = [start], farmers = {};
    seen.add(start);
    while (todo.length) {
      const k = todo.pop();
      hexes.push(k);
      for (const [p, n] of Object.entries(realm.hexes[k].farmers)) farmers[p] = (farmers[p] || 0) + n;
      for (const n of hexNeighbors(k)) if (!seen.has(n) && realm.hexes[n] && realm.hexes[n].farm) { seen.add(n); todo.push(n); }
    }
    const top = Math.max(0, ...Object.values(farmers));
    const owners = top ? Object.keys(farmers).filter(p => farmers[p] === top) : [];
    const near = new Set(hexes);
    for (const k of hexes) for (const n of hexNeighbors(k)) near.add(n);
    let settlements = 0, cities = 0;
    for (const k of near) { const b = realm.hexes[k] && realm.hexes[k].building; if (b) b.kind === 'city' ? cities++ : settlements++; }
    out.push({ hexes: hexes.sort(), farmers, owners, settlements, cities, fed: settlements + cities });
  }
  return out;
}
// Explorer score: 1 for every tile the family had never been to, reached with
// this player in the car, plus 2 more for each one they pioneered (spotted
// something there first). Ranks go by the score.
const exploreScore = x => x.tiles + 2 * x.pioneered;
const EXPLORE_RANKS = [[0, 'Homebody'], [10, 'Day Tripper'], [30, 'Scout'], [80, 'Pathfinder'], [160, 'Voyager'], [300, 'Explorer'], [600, 'Cartographer'], [1200, 'Legend of the Road']];
// Driver ranks go by km driven over all trips.
const DRIVE_RANKS = [[0, 'Learner\'s Permit'], [25, 'Licensed'], [150, 'Road Captain'], [500, 'Long Hauler'], [1500, 'Road Warrior'], [5000, 'Legend of the Highway']];
function driveRank(km) {
  let i = 0;
  while (i + 1 < DRIVE_RANKS.length && km >= DRIVE_RANKS[i + 1][0]) i++;
  return { title: DRIVE_RANKS[i][1], from: DRIVE_RANKS[i][0], next: DRIVE_RANKS[i + 1] ? { km: DRIVE_RANKS[i + 1][0], title: DRIVE_RANKS[i + 1][1] } : null };
}
function exploreRank(tiles) {
  let i = 0;
  while (i + 1 < EXPLORE_RANKS.length && tiles >= EXPLORE_RANKS[i + 1][0]) i++;
  return { title: EXPLORE_RANKS[i][1], from: EXPLORE_RANKS[i][0], next: EXPLORE_RANKS[i + 1] ? { tiles: EXPLORE_RANKS[i + 1][0], title: EXPLORE_RANKS[i + 1][1] } : null };
}
const roadKey = (a, b) => a < b ? a + '|' + b : b + '|' + a;
// A purse holds the five resources plus gold (which the robber can't take).
const emptyPurse = () => ({ ...Object.fromEntries(RESOURCES.map(r => [r.id, 0])), gold: 0 });
const canPay = (purse, cost) => Object.entries(cost).every(([k, n]) => (purse[k] || 0) >= n);
const pay = (purse, cost, sign = -1) => { for (const [k, n] of Object.entries(cost)) purse[k] = (purse[k] || 0) + sign * n; };
function cleanBundle(b) {
  const out = {};
  for (const k of [...RESOURCES.map(r => r.id), 'gold']) { const n = Math.floor(Number(b && b[k]) || 0); if (n > 0 && n < 1000) out[k] = n; }
  return out;
}

function emptyRealm() { return { home: null, hexes: {}, roads: {}, purse: {}, points: {}, roadLength: {}, land: {}, farms: [], longest: null, biggest: null, turn: null }; }

// Ranks in the Realm go by Realm points.
const REALM_RANKS = [[0, 'Wanderer'], [1, 'Squire'], [3, 'Knight'], [6, 'Baron'], [10, 'Count'], [15, 'Duke'], [21, 'Monarch']];
function realmRank(points) {
  let i = 0;
  while (i + 1 < REALM_RANKS.length && points >= REALM_RANKS[i + 1][0]) i++;
  return { title: REALM_RANKS[i][1], next: REALM_RANKS[i + 1] ? { points: REALM_RANKS[i + 1][0], title: REALM_RANKS[i + 1][1] } : null };
}
// Whose turn it is, if turns have started; null means anyone may play.
const realmCurrent = realm => realm.turn ? realm.turn.order[realm.turn.i] : null;
const realmMayPlay = (realm, pid) => !realm.turn || realmCurrent(realm) === pid;

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
    if (FARM_ANIMALS.every(x => tp.byAnimal[x.id])) out.push('Every animal on the farm');
    if ((tp.byAnimal.deer || 0) >= 5) out.push('Oh deer, so many deer');
    if (tp.deaths === 0 && tp.counted > 0) out.push('Never lost a flock');
    if (tp.deaths > 0) out.push(tp.deaths === 1 ? 'Survived a cemetery' : `Survived ${tp.deaths} cemeteries`);
    if (tp.churches > 0 && tp.deaths > 0) out.push('Saved by a church');
    if (tp.kills >= 3) out.push(`Buried ${tp.kills} flocks`);
    if (won('flocks')) margin(contest('flocks'));
  } else if (game === 'zombies') {
    const z = only(tp.zombieBy, ZOMBIES);
    if (z && tp.zombies > 1) out.push(`Nothing but ${z.name.toLowerCase()}`);
    if (ZOMBIES.every(x => tp.zombieBy[x.id])) out.push('All eight kinds');
    if (won('zombies')) margin(contest('zombies'));
  } else if (game === 'volvos') {
    const c = only(tp.volvoBy, VOLVO_COLORS);
    if (c && tp.volvos > 1 && c.id !== 'other') out.push(`Only ${c.name.toLowerCase()} trucks`);
    if (Object.keys(tp.volvoBy).length >= 6) out.push('A rainbow of trucks');
    if (tp.volvoBranded >= 3 && tp.volvoBranded * 2 >= tp.volvos) out.push('Say-it-twice specialist');
    if (tp.volvoKind.classic) out.push(tp.volvoKind.classic === 1 ? 'Found a classic' : `${tp.volvoKind.classic} classics`);
    if (['excavator', 'loader', 'hauler'].some(k => tp.volvoKind[k])) out.push('Hard hat zone');
    if (won('volvos')) margin(contest('volvos'));
  } else if (game === 'fields') {
    const c = only(tp.cropBy, CROPS);
    if (c && tp.fields > 1) out.push(`Nothing but ${c.name.toLowerCase()}`);
    if (CROPS.every(x => tp.cropBy[x.id])) out.push('Every crop in the country');
    if (won('fields')) margin(contest('fields'));
  } else if (game === 'drive') {
    if (tp.driven >= 1) out.push(`Drove ${Math.round(tp.driven)} km`);
    if (tp.bestStint >= 300) out.push('Marathon stint');
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
  fields: ['field.add'],
  realm: ['realm.build', 'realm.trade', 'realm.buy', 'realm.pass'],
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

if (typeof module !== 'undefined') module.exports = { PAGE_VERSION, FARM_ANIMALS, CROPS, VOLVO_OTHERS, GRID, GOLD_PRICE, MONASTERY_BONUS, WAGE_KM, DRIVE_RANKS, driveRank, kmBetween, farmRegions, ANIMALS, ZOMBIES, VOLVO_COLORS, PLATES, PLATE_REGIONS, US_STATES, AWARDS, LEVEL_TITLES, levelFor, plateKey, endorsements, RESOURCES, BUILDINGS, TERRAIN, BANK_RATE, EARN_EVERY, LONGEST_ROAD_MIN, BIGGEST_LAND_MIN, REALM_RANKS, realmRank, EXPLORE_RANKS, exploreRank, exploreScore, hexKm, realmCurrent, realmMayPlay, hexAt, hexCorners, hexNeighbors, roadKey, canSettle, canRoad, canPay, longestRoad, CONTESTS, PLAYER_COLORS, MAX_PLAYERS, volvoName, buildState, lastUndoable };
