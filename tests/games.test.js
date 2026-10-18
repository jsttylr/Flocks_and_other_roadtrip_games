// Run with: node --test 'tests/*.test.js'
const test = require('node:test');
const assert = require('node:assert');
const { buildState, lastUndoable, US_STATES } = require('../web/games.js');

let clock = 0;
const E = (type, data, id) => ({ id: id || 'e' + (++clock), type, ts: clock * 1000, data });

function trip() {
  clock = 0;
  return [
    E('player.add', { id: 'mom', name: 'Mom' }),
    E('player.add', { id: 'kid', name: 'Kid' }),
    E('trip.start', { id: 't1', name: 'Beach', players: ['mom', 'kid'] }),
  ];
}

test('flocks scoring, cemetery and trip winner', () => {
  const evs = trip();
  evs.push(E('flock.add', { trip: 't1', player: 'mom', animal: 'cow', n: 30 }));
  evs.push(E('flock.add', { trip: 't1', player: 'kid', animal: 'horse', n: 120 }));
  evs.push(E('flock.wipe', { trip: 't1', player: 'kid' }));
  evs.push(E('flock.add', { trip: 't1', player: 'kid', animal: 'sheep', n: 40 }));
  evs.push(E('trip.end', { id: 't1' }));
  evs.push(E('flock.add', { trip: 't1', player: 'mom', animal: 'cow', n: 999 })); // after the end: ignored
  const st = buildState(evs);
  assert.equal(st.trips.t1.flocks.mom.score, 30);
  assert.equal(st.trips.t1.flocks.kid.score, 40);
  assert.deepEqual(st.trips.t1.winners, ['kid']);
  assert.equal(st.activeTrip, null);
  const kid = st.life.kid;
  assert.equal(kid.animals, 160);
  assert.equal(kid.lost, 120);
  assert.equal(kid.flockWins, 1);
  for (const a of ['first_flock', 'shepherd', 'big_herd', 'century', 'rip', 'heartbreak', 'champion', 'comeback']) assert.ok(kid.awards[a], a);
  assert.ok(!st.life.mom.awards.champion);
});

test('undo removes a count and a plate', () => {
  const evs = trip();
  evs.push(E('flock.add', { trip: 't1', player: 'mom', animal: 'cow', n: 5 }));
  evs.push(E('plate.spot', { trip: 't1', player: 'kid', plate: 'HI' }));
  let st = buildState(evs);
  assert.ok(st.life.kid.awards.aloha);
  evs.push(E('undo', { target: lastUndoable(evs, st, 't1', 'kid').id }));
  evs.push(E('undo', { target: lastUndoable(evs, buildState(evs), 't1', null).id }));
  st = buildState(evs);
  assert.equal(st.trips.t1.flocks.mom.score, 0);
  assert.equal(st.trips.t1.plates.HI, undefined);
  assert.ok(!st.life.kid.awards.aloha);
});

test('plates: first spotter keeps it, full house goes to everyone', () => {
  const evs = trip();
  evs.push(E('plate.spot', { trip: 't1', player: 'mom', plate: 'TX' }));
  evs.push(E('plate.spot', { trip: 't1', player: 'kid', plate: 'TX' }));
  for (const s of US_STATES) evs.push(E('plate.spot', { trip: 't1', player: 'kid', plate: s }));
  evs.push(E('plate.spot', { trip: 't1', player: 'kid', plate: 'XX' }));
  const st = buildState(evs);
  assert.equal(st.trips.t1.plates.TX.player, 'mom');
  assert.equal(Object.keys(st.trips.t1.plates).length, 50);
  assert.ok(st.life.mom.awards.full_house);
  assert.ok(st.life.kid.awards.half_way);
  assert.ok(st.life.kid.awards.coast_to_coast);
  assert.ok(!st.life.kid.awards.fifty_club, 'kid is missing Texas');
});

test('new awards are reported only for new events', () => {
  const evs = trip();
  evs.push(E('flock.add', { trip: 't1', player: 'mom', animal: 'cow', n: 1 }));
  const seen = new Set(evs.map(e => e.id));
  evs.push(E('flock.add', { trip: 't1', player: 'mom', animal: 'cow', n: 99 }));
  const st = buildState(evs, seen);
  assert.deepEqual(st.newAwards.map(a => a.award), ['shepherd', 'big_herd', 'century']);
});
