// Run with: node --test 'tests/*.test.js'
const test = require('node:test');
const assert = require('node:assert');
const { buildState, lastUndoable, US_STATES, volvoName, levelFor, AWARDS } = require('../web/games.js');

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
  for (const z of ['deer', 'rabbit', 'squirrel', 'fox', 'raccoon', 'opossum']) evs.push(E('zombie.add', { trip: 't1', player: 'kid', animal: z }));
  evs.push(E('volvo.add', { trip: 't1', player: 'mom', color: 'white', branded: true }));
  evs.push(E('volvo.add', { trip: 't1', player: 'mom', color: 'blue' }));
  evs.push(E('volvo.add', { trip: 't1', player: 'kid', color: 'red' }));
  evs.push(E('volvo.add', { trip: 't1', player: 'kid', color: 'red' }));
  evs.push(E('flock.cemetery', { trip: 't1', player: 'mom', victims: ['kid'] }));
  evs.push(E('trip.end', { id: 't1' }));
  const st = buildState(evs);
  assert.equal(st.trips.t1.by.kid.zombies, 6, 'cemeteries leave zombies alone');
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
