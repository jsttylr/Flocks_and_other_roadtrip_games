// Run with: node --test 'tests/*.test.js'
const test = require('node:test');
const assert = require('node:assert');
const { buildState, lastUndoable, US_STATES, volvoName } = require('../web/games.js');

let clock = 0;
const E = (type, data, id) => ({ id: id || 'e' + String(++clock).padStart(4, '0'), type, ts: clock * 1000, data });

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
  assert.deepEqual(st.newAwards.map(a => a.award), ['shepherd', 'big_herd', 'century']);
});
