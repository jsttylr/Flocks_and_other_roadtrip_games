// Run with: node --test 'tests/*.test.js'
const test = require('node:test');
const assert = require('node:assert');
const { buildState, lastUndoable, hexCorners, CROPS, driveRank, kmBetween, US_STATES, volvoName, levelFor, AWARDS, endorsements, hexAt, hexNeighbors, longestRoad, roadKey, realmCurrent, realmRank, exploreRank } = require('../web/games.js');

// An ordinary day (noon, no holiday, no full moon) so hidden awards stay hidden.
const BASE = new Date(2026, 0, 20, 12).getTime();
let clock = 0;
const E = (type, data, id, ts) => ({ id: id || 'e' + String(++clock).padStart(4, '0'), type, ts: ts || BASE + clock * 1000, data });

function trip(players = ['mom', 'kid']) {
  clock = 0;
  return [
    ...players.map(p => E('player.add', { id: p, name: p })),
    E('trip.start', { id: 't1', name: 'Beach', players }),
  ];
}

test('cemetery kills the named flocks, church brings yours back', () => {
  const evs = trip(['mom', 'kid', 'dad']);
  evs.push(E('flock.add', { trip: 't1', player: 'mom', animal: 'cow', n: 30 }));
  evs.push(E('flock.add', { trip: 't1', player: 'kid', animal: 'horse', n: 120 }));
  evs.push(E('flock.add', { trip: 't1', player: 'dad', animal: 'chicken', n: 10 }));
  evs.push(E('flock.cemetery', { trip: 't1', player: 'mom', victims: ['kid', 'dad'] }));
  let st = buildState(evs);
  assert.equal(st.trips.t1.by.mom.score, 30);
  assert.equal(st.trips.t1.by.kid.score, 0);
  assert.equal(st.trips.t1.by.kid.dead, 120);
  assert.equal(st.life.mom.kills, 2);
  assert.ok(st.life.mom.awards.grim_reaper);
  assert.ok(st.life.kid.awards.heartbreak);

  evs.push(E('flock.add', { trip: 't1', player: 'kid', animal: 'sheep', n: 5 }));
  evs.push(E('flock.church', { trip: 't1', player: 'kid' }));
  evs.push(E('trip.end', { id: 't1' }));
  evs.push(E('flock.add', { trip: 't1', player: 'mom', animal: 'cow', n: 999 })); // after the end: ignored
  st = buildState(evs);
  assert.equal(st.trips.t1.by.kid.score, 125);
  assert.equal(st.trips.t1.by.kid.dead, 0);
  assert.equal(st.trips.t1.by.dad.score, 0, 'no church for dad');
  assert.deepEqual(st.trips.t1.winners.flocks, ['kid']);
  for (const a of ['hallelujah', 'miracle', 'champion', 'comeback', 'century']) assert.ok(st.life.kid.awards[a], a);
  assert.equal(st.life.mom.animals, 30);
});

test('zombies and Volvo trucks are their own contests', () => {
  const evs = trip();
  for (const z of ['deer', 'rabbit', 'squirrel', 'fox', 'raccoon', 'opossum', 'groundhog', 'iguana']) evs.push(E('zombie.add', { trip: 't1', player: 'kid', animal: z }));
  evs.push(E('volvo.add', { trip: 't1', player: 'mom', color: 'white', branded: true }));
  evs.push(E('volvo.add', { trip: 't1', player: 'mom', color: 'blue' }));
  evs.push(E('volvo.add', { trip: 't1', player: 'kid', color: 'red' }));
  evs.push(E('volvo.add', { trip: 't1', player: 'kid', color: 'red' }));
  evs.push(E('flock.cemetery', { trip: 't1', player: 'mom', victims: ['kid'] }));
  evs.push(E('trip.end', { id: 't1' }));
  const st = buildState(evs);
  assert.equal(st.trips.t1.by.kid.zombies, 8, 'cemeteries leave zombies alone');
  assert.deepEqual(st.trips.t1.winners.zombies, ['kid']);
  assert.deepEqual(st.trips.t1.winners.volvos, ['mom']);
  assert.deepEqual(st.trips.t1.winners.flocks, []);
  assert.ok(st.life.kid.awards.zombie_zoo);
  assert.ok(st.life.mom.awards.say_it_twice);
  assert.equal(st.life.mom.volvoBranded, 1);
  assert.equal(st.trips.t1.by.mom.volvoPoints, 3, 'a Volvo truck white Volvo scores double');
  assert.equal(st.trips.t1.by.mom.volvos, 2);
  assert.equal(volvoName('white', true), 'Volvo truck white Volvo');
  assert.equal(volvoName('white', false), 'Volvo truck white');
});

test('undo takes back the last thing in that game only', () => {
  const evs = trip();
  evs.push(E('flock.add', { trip: 't1', player: 'mom', animal: 'cow', n: 5 }));
  evs.push(E('zombie.add', { trip: 't1', player: 'mom', animal: 'deer' }));
  let st = buildState(evs);
  evs.push(E('undo', { target: lastUndoable(evs, st, 't1', 'mom', 'flocks').id }));
  st = buildState(evs);
  assert.equal(st.trips.t1.by.mom.score, 0);
  assert.equal(st.trips.t1.by.mom.zombies, 1);
});

test('plates are for the whole car, and locations make map pins', () => {
  const evs = trip();
  evs.push(E('plate.spot', { trip: 't1', plate: 'TX', loc: { lat: 30.2, lon: -97.7, acc: 8 } }));
  evs.push(E('plate.spot', { trip: 't1', plate: 'TX' }));
  for (const s of US_STATES) evs.push(E('plate.spot', { trip: 't1', plate: s }));
  evs.push(E('plate.spot', { trip: 't1', plate: 'XX' }));
  evs.push(E('flock.add', { trip: 't1', player: 'kid', animal: 'llama', n: 2, loc: { lat: 'junk' } }));
  const st = buildState(evs);
  assert.equal(Object.keys(st.trips.t1.plates).length, 50);
  for (const p of ['mom', 'kid']) for (const a of ['full_house', 'fifty_club', 'coast_to_coast', 'aloha']) assert.ok(st.life[p].awards[a], p + ' ' + a);
  assert.deepEqual(st.trips.t1.pins.map(p => [p.kind, p.lat]), [['plate', 30.2]]);
});

test('new awards are reported only for new events', () => {
  const evs = trip();
  evs.push(E('flock.add', { trip: 't1', player: 'mom', animal: 'cow', n: 1 }));
  const seen = new Set(evs.map(e => e.id));
  evs.push(E('flock.add', { trip: 't1', player: 'mom', animal: 'cow', n: 99 }));
  const st = buildState(evs, seen);
  assert.deepEqual(st.newAwards.filter(a => a.award).map(a => a.award), ['shepherd', 'big_herd', 'century']);
  assert.deepEqual(st.newAwards.filter(a => a.level).map(a => a.level.level), [3], 'buckle up + first animal + 3 new = 5 awards, level 3');
});

test('repeat awards count once per trip and raise the level', () => {
  const evs = trip();
  for (const t of ['t1', 't2']) {
    if (t === 't2') evs.push(E('trip.start', { id: 't2', name: 'Lake', players: ['mom', 'kid'] }));
    evs.push(E('flock.add', { trip: t, player: 'kid', animal: 'cow', n: 150 }));
    evs.push(E('flock.add', { trip: t, player: 'kid', animal: 'cow', n: 10 }));
    evs.push(E('trip.end', { id: t }));
  }
  const st = buildState(evs);
  const a = st.life.kid.awards;
  assert.equal(a.champion.count, 2);
  assert.deepEqual(a.champion.trips, ['t1', 't2']);
  assert.equal(a.century.count, 2, 'once per trip, not once per count');
  assert.equal(a.first_flock.count, 1, 'one-time awards stay one-time');
  const total = Object.values(a).reduce((n, x) => n + x.count, 0);
  assert.equal(st.life.kid.badges, total);
  assert.equal(levelFor(st.life.kid.badges).level, levelFor(total).level);
  assert.deepEqual([0, 1, 2, 3, 6, 10].map(n => levelFor(n).level), [1, 2, 2, 3, 4, 5]);
});

test('hidden zombie awards go by the date', () => {
  const evs = trip();
  evs.push(E('zombie.add', { trip: 't1', player: 'kid', animal: 'raccoon' }, null, new Date(2026, 9, 31, 18).getTime()));
  evs.push(E('zombie.add', { trip: 't1', player: 'kid', animal: 'deer' }, null, new Date(2026, 11, 25, 1).getTime()));
  evs.push(E('zombie.add', { trip: 't1', player: 'mom', animal: 'fox' }, null, new Date(2026, 1, 13, 14).getTime())); // Friday 13 Feb 2026
  evs.push(E('zombie.add', { trip: 't1', player: 'mom', animal: 'fox' }, null, Date.UTC(2026, 4, 31, 8, 45) + 6 * 3600e3)); // full moon 31 May 2026
  evs.push(E('flock.church', { trip: 't1', player: 'mom' }, null, new Date(2026, 3, 5, 10).getTime())); // Easter 2026
  const st = buildState(evs);
  for (const id of ['halloween', 'rudolph', 'witching_hour']) assert.ok(st.life.kid.awards[id], id);
  for (const id of ['friday13', 'full_moon', 'easter']) assert.ok(st.life.mom.awards[id], id);
  assert.ok(!st.life.kid.awards.friday13 && !st.life.mom.awards.halloween);
  assert.ok(AWARDS.filter(x => x.hidden).every(x => x.repeat));
});

test('Mexico, Puerto Rico, diplomat and government plates', () => {
  const evs = trip();
  for (const p of ['MX', 'PR', 'DPL', 'USG', 'CA-ON']) evs.push(E('plate.spot', { trip: 't1', plate: p }));
  const st = buildState(evs);
  for (const id of ['hola', 'isla', 'diplomat', 'gov_issue', 'border_to_border']) assert.ok(st.life.kid.awards[id], id);
  assert.ok(!US_STATES.includes('PR'), 'Puerto Rico does not count toward the 50');
});

test('certificate endorsements say how the trip was won', () => {
  const evs = trip();
  evs.push(E('flock.add', { trip: 't1', player: 'kid', animal: 'cow', n: 40 }));
  evs.push(E('flock.add', { trip: 't1', player: 'kid', animal: 'cow', n: 12 }));
  evs.push(E('flock.add', { trip: 't1', player: 'mom', animal: 'horse', n: 10 }));
  evs.push(E('flock.cemetery', { trip: 't1', player: 'kid', victims: ['mom'] }));
  evs.push(E('flock.add', { trip: 't1', player: 'mom', animal: 'sheep', n: 50 }));
  evs.push(E('trip.end', { id: 't1' }));
  const st = buildState(evs);
  const t = st.trips.t1;
  assert.deepEqual(endorsements(t, 'kid', 'flocks'), ['With only cows', 'Never lost a flock', 'Photo finish']);
  assert.deepEqual(endorsements(t, 'mom', 'flocks'), ['Survived a cemetery']);
  assert.ok(t.awards.some(a => a.player === 'kid' && a.award === 'champion'));
  assert.equal(t.badgesAtEnd.kid, st.life.kid.badges);
});

test('the Realm: territory, payday, building, trading and longest road', () => {
  const evs = trip();
  const here = { lat: 41.26, lon: -95.94 };
  const home = hexAt(here.lat, here.lon);
  // Kid makes three sightings in one hex, mom one: the hex is kid's.
  for (let i = 0; i < 3; i++) evs.push(E('flock.add', { trip: 't1', player: 'kid', animal: 'cow', n: 2, loc: here }));
  evs.push(E('zombie.add', { trip: 't1', player: 'mom', animal: 'deer', loc: here }));
  evs.push(E('flock.cemetery', { trip: 't1', player: 'kid', victims: ['mom'] }));
  evs.push(E('trip.end', { id: 't1' }));
  let st = buildState(evs);
  const h = st.realm.hexes[home];
  assert.equal(h.owner, 'kid');
  assert.equal(h.terrain, 'wool');
  // Kid: wool 3/3+1 = 2, lumber 1/1+1 = 2, others 1. Then the cemetery steals one from mom.
  assert.equal(st.trips.t1.paid.kid.wool, 2);
  assert.equal(st.trips.t1.paid.kid.lumber, 2);
  const kidBefore = { ...st.realm.purse.kid };
  assert.equal(Object.values(kidBefore).reduce((a, b) => a + b, 0), 8, '7 paid + 1 stolen');

  assert.deepEqual(st.realm.turn.order, ['mom', 'kid'], 'a tie on the trip keeps the usual order');
  evs.push(E('realm.build', { grid: 2, player: 'kid', kind: 'settlement', hex: home }));     // not kid's turn yet: refused
  evs.push(E('realm.build', { grid: 2, player: 'mom', kind: 'settlement', hex: home }));     // not mom's land: refused
  evs.push(E('realm.pass', { player: 'mom' }));
  evs.push(E('realm.build', { grid: 2, player: 'kid', kind: 'settlement', hex: home }));
  const next = hexNeighbors(home)[0];
  evs.push(E('realm.build', { grid: 2, player: 'kid', kind: 'road', hex: home, to: next }));   // next isn't on the board yet: refused
  st = buildState(evs);
  assert.deepEqual(st.realm.hexes[home].building && st.realm.hexes[home].building.player, 'kid');
  assert.equal(st.realm.points.kid, 1);
  assert.equal(Object.keys(st.realm.roads).length, 0);
  assert.ok(st.life.kid.awards.homesteader);
  assert.equal(st.realm.purse.kid.wool, kidBefore.wool - 1, 'the refused build cost nothing');

  // Trading checks both sides can pay; the bank takes 4 for 1.
  evs.push(E('realm.trade', { player: 'kid', with: 'mom', give: { wool: 1 }, get: { ore: 1 } }));
  evs.push(E('realm.trade', { player: 'kid', with: 'mom', give: { wool: 50 }, get: { ore: 1 } }));
  evs.push(E('realm.trade', { player: 'kid', with: 'bank', give: { lumber: 3 }, get: { ore: 1 } }));
  evs.push(E('realm.trade', { player: 'mom', with: 'kid', give: { ore: 1 }, get: { wool: 1 } }));  // not mom's turn
  st = buildState(evs);
  assert.equal(st.realm.purse.kid.ore, kidBefore.ore + 1);
  assert.ok(st.life.kid.awards.handshake && st.life.mom.awards.handshake);
  evs.push(E('realm.pass', { player: 'kid' }));
  st = buildState(evs);
  assert.equal(realmCurrent(st.realm), 'mom');
  assert.equal(st.realm.turn.round, 2);
  assert.equal(st.realm.purse.kid.wool, kidBefore.wool - 1 - 1, 'one for the settlement, one traded');

  const roads = {};
  ['a|b', 'b|c', 'c|d', 'b|e'].forEach(k => { roads[k] = { player: 'kid' }; });
  assert.equal(longestRoad(roads, 'kid'), 3);
  assert.equal(roadKey('b', 'a'), 'a|b');
  assert.deepEqual([0, 1, 3, 9, 30].map(n => realmRank(n).title), ['Wanderer', 'Squire', 'Knight', 'Baron', 'Monarch']);
});

test('exploring: new tiles count for the whole car, first sightings make pioneers', () => {
  const evs = trip();
  const at = (lat, lon) => ({ lat, lon });
  evs.push(E('trip.hex', { trip: 't1', loc: at(41.26, -95.94) }));
  evs.push(E('trip.hex', { trip: 't1', loc: at(41.26, -95.94) }));               // same tile: nothing new
  evs.push(E('flock.add', { trip: 't1', player: 'kid', animal: 'cow', n: 3, loc: at(41.26, -95.94) })); // first sighting there
  evs.push(E('zombie.add', { trip: 't1', player: 'mom', animal: 'deer', loc: at(41.26, -95.94) }));     // not first
  for (let i = 1; i <= 45; i++) evs.push(E('trip.hex', { trip: 't1', loc: at(41.26, -95.94 + i * 0.5) }));
  evs.push(E('trip.end', { id: 't1' }));
  const st = buildState(evs);
  assert.equal(st.life.mom.explore.tiles, 46);
  assert.equal(st.life.kid.explore.tiles, 46);
  assert.equal(st.life.kid.explore.pioneered, 1);
  assert.equal(st.life.mom.explore.pioneered, 0);
  assert.ok(st.life.kid.explore.farthest > 1800 && st.life.kid.explore.farthest < 2000, String(st.life.kid.explore.farthest));
  for (const id of ['first_steps', 'off_the_map', 'far_from_home']) assert.ok(st.life.mom.awards[id], id);
  assert.ok(st.life.kid.awards.pioneer && !st.life.mom.awards.pioneer);
  assert.equal(exploreRank(46).title, 'Scout');
});

test('the driver: km by GPS, a shield from cemeteries, swaps, a wage and awards', () => {
  const evs = trip(['mom', 'kid', 'dad']);
  evs[evs.length - 1].data.driver = 'dad';
  const step = 0.009;                       // about 1 km of latitude
  const at = i => ({ lat: 41 + i * step, lon: -96 });
  for (let i = 0; i <= 60; i++) evs.push(E('trip.track', { trip: 't1', loc: at(i) }));
  evs.push(E('flock.add', { trip: 't1', player: 'dad', animal: 'cow', n: 40 }));
  evs.push(E('flock.add', { trip: 't1', player: 'kid', animal: 'deer', n: 6 }));
  evs.push(E('flock.cemetery', { trip: 't1', player: 'kid', victims: ['dad', 'mom'] }));   // dad is driving: safe
  evs.push(E('trip.driver', { trip: 't1', player: 'mom' }));
  for (let i = 61; i <= 80; i++) evs.push(E('trip.track', { trip: 't1', loc: at(i) }));
  evs.push(E('trip.driver', { trip: 't1', player: null }));
  evs.push(E('trip.driver', { trip: 't1', player: 'dad' }));
  for (let i = 0; i < 12; i++) evs.push(E('zombie.add', { trip: 't1', player: 'kid', animal: 'rabbit' }));
  evs.push(E('trip.end', { id: 't1' }));
  const st = buildState(evs), t = st.trips.t1;
  assert.equal(t.by.dad.score, 40, "the driver's flock survived");
  assert.equal(t.by.kid.byAnimal.deer, 6, 'live deer count as a flock');
  assert.ok(st.life.kid.awards.bambi);
  assert.ok(Math.abs(t.by.dad.driven - 60) < 1, String(t.by.dad.driven));
  assert.ok(Math.abs(t.by.mom.driven - 20) < 1, String(t.by.mom.driven));
  assert.ok(Math.abs(t.km - 80) < 1);
  assert.equal(t.track.length, 81);
  assert.equal(t.swaps, 3);
  assert.ok(st.life.dad.awards.wheelman && st.life.dad.awards.first_leg && !st.life.mom.awards.wheelman);
  assert.ok(st.life.kid.awards.relay, 'relay goes to everyone in the car');
  // Dad drove 60 km: 1 resource of wage. Kid spotted plenty, so dad is topped
  // up to his share of the passengers' average too.
  assert.equal(t.wage.dad.wage, 1);
  assert.equal(t.wage.mom.wage, 0);
  assert.ok(t.wage.dad.topup >= 0);
  assert.equal(driveRank(60).title, 'Licensed');
  assert.ok(Math.abs(kmBetween({ lat: 41, lon: -96 }, { lat: 42, lon: -96 }) - 111.2) < 0.5);
});

test("who's in the car: hop in and out mid-trip", () => {
  const evs = trip(['mom', 'kid']);
  evs.splice(2, 0, E('player.add', { id: 'cousin', name: 'Cousin' }));
  evs.push(E('trip.crew', { trip: 't1', player: 'cousin', aboard: true }));
  evs.push(E('flock.add', { trip: 't1', player: 'cousin', animal: 'cow', n: 5 }));
  evs.push(E('plate.spot', { trip: 't1', plate: 'OH' }));
  evs.push(E('trip.crew', { trip: 't1', player: 'cousin', aboard: false }));
  evs.push(E('flock.add', { trip: 't1', player: 'cousin', animal: 'cow', n: 50 }));     // not in the car: ignored
  evs.push(E('plate.spot', { trip: 't1', plate: 'TX' }));
  evs.push(E('trip.end', { id: 't1' }));
  const st = buildState(evs), t = st.trips.t1;
  assert.deepEqual(t.players, ['mom', 'kid', 'cousin']);
  assert.deepEqual(t.aboard, ['mom', 'kid']);
  assert.equal(t.by.cousin.score, 5);
  assert.ok(st.life.cousin.uniquePlates.has('OH') && !st.life.cousin.uniquePlates.has('TX'));
  assert.equal(st.life.cousin.trips, 1);
  assert.ok(t.paid.cousin, 'cousin still gets paid for their part');
});

test('fields, farms and monasteries: grain for settlements, gold for visited tiles', () => {
  const evs = trip();
  const here = { lat: 41.26, lon: -95.94 }, home = hexAt(here.lat, here.lon);
  const near = hexNeighbors(home)[0], c = hexCorners(near).center, there = { lat: c[0], lon: c[1] };
  for (const crop of ['corn', 'corn', 'soy']) evs.push(E('field.add', { trip: 't1', player: 'kid', crop, loc: here }));
  evs.push(E('field.add', { trip: 't1', player: 'mom', crop: 'orchard', loc: there }));
  evs.push(E('flock.church', { trip: 't1', player: 'mom', loc: there }));          // founds a monastery
  evs.push(E('flock.church', { trip: 't1', player: 'kid', loc: there }));          // one per tile
  evs.push(E('trip.end', { id: 't1' }));
  let st = buildState(evs);
  assert.equal(st.trips.t1.by.kid.fields, 3);
  assert.deepEqual(st.trips.t1.winners.fields, ['kid']);
  assert.ok(st.life.kid.awards.first_field && st.life.kid.awards.field_champ);
  assert.equal(st.realm.farms.length, 1, 'touching farm tiles make one farm');
  assert.deepEqual(st.realm.farms[0].owners, ['kid']);
  const m = st.realm.hexes[hexAt(there.lat, there.lon)].monastery;
  assert.equal(m.player, 'mom');
  assert.ok(st.life.mom.awards.abbot);
  assert.equal(st.trips.t1.paid.mom.gold, 1, 'one visited tile next to the monastery');
  // A settlement on the farm: the farm then feeds it.
  assert.deepEqual(st.realm.turn.order, ['mom', 'kid'], 'mom did worse, so she goes first');
  evs.push(E('realm.pass', { player: 'mom' }));
  evs.push(E('realm.build', { player: 'kid', kind: 'settlement', hex: home }));                 // old grid: dropped
  st = buildState(evs);
  assert.equal(st.realm.hexes[home].building, null, 'a build from the old grid is dropped');
  evs.push(E('realm.build', { grid: 2, player: 'kid', kind: 'settlement', hex: home }));
  st = buildState(evs);
  assert.equal(st.realm.farms[0].fed, 1);
  evs.push(E('trip.start', { id: 't2', name: 'Again', players: ['mom', 'kid'] }));
  evs.push(E('trip.track', { trip: 't2', loc: there }));                        // through the monastery's tile
  evs.push(E('trip.end', { id: 't2' }));
  st = buildState(evs);
  assert.equal(st.trips.t2.paid.kid.grain, 2, '1 for coming along, 1 from the farm');
  // Gold buys a resource for 2.
  const who = realmCurrent(st.realm);
  evs.push(E('realm.trade', { player: who, with: 'bank', give: { gold: 4 }, get: { ore: 1 } }));   // the bank won't take gold
  st = buildState(evs);
  assert.equal(st.realm.purse.mom.gold, 2);
});

test('classic Volvos, wagons and equipment score on the Volvo tab', () => {
  const evs = trip();
  for (const kind of ['classic', 'wagon', 'excavator', 'loader', 'hauler']) evs.push(E('volvo.add', { trip: 't1', player: 'kid', kind }));
  evs.push(E('volvo.add', { trip: 't1', player: 'kid', color: 'white' }));
  evs.push(E('zombie.add', { trip: 't1', player: 'kid', animal: 'groundhog' }, null, new Date(2026, 1, 2, 12).getTime()));
  evs.push(E('trip.end', { id: 't1' }, null, new Date(2026, 1, 3, 12).getTime()));
  const st = buildState(evs), tp = st.trips.t1.by.kid;
  assert.equal(tp.volvoPoints, 2 + 1 + 2 + 2 + 2 + 1);
  assert.equal(tp.volvos, 1, 'only trucks count as trucks');
  for (const id of ['brick', 'heavy_metal', 'smorgasbord', 'shadow']) assert.ok(st.life.kid.awards[id], id);
  assert.ok(endorsements(st.trips.t1, 'kid', 'volvos').includes('Hard hat zone'));
});

test('every award has its own icon', () => {
  const icons = AWARDS.map(a => a.icon);
  assert.deepEqual(icons.filter((x, i) => icons.indexOf(x) !== i), []);
  assert.equal(CROPS.length, 10);
});
