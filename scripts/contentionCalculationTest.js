const assert = require('assert');
const { calculateContention } = require('../src/services/contention');

function row(id, requestor, huts = ['Benson'], minimum = 4, extras = {}) {
  return { Request_ID: id, Requestor_ID: requestor, Choice_Number: 1,
    Benson: huts.includes('Benson'), Bradley: huts.includes('Bradley'), Grubb: huts.includes('Grubb'), Ludlow: huts.includes('Ludlow'),
    Arrival: '2026-12-20', Departure: '2026-12-22', Spots_ideal: minimum, Spots_min: minimum, ...extras };
}

function run() {
  const requestors = new Map([[1, { Credits: 1.5 }], [2, { Credits: 1.5 }], [3, { Credits: 2.1 }]]);
  const status = (...requests) => calculateContention(requests, requestors).get(1);
  assert.strictEqual(status(row(1, 1)), null, 'no self competition');
  assert.strictEqual(status(row(1, 1, ['Benson'], 12)), null, 'exact full capacity fits');
  assert.strictEqual(status(row(1, 1), row(2, 2, ['Benson'], 8)), null, 'equality after same-priority demand fits');
  assert.strictEqual(status(row(1, 1), row(2, 2, ['Benson'], 9)), 'at-risk');
  assert.strictEqual(status(row(1, 1), row(3, 3, ['Benson'], 9)), 'losing');
  assert.strictEqual(status(row(1, 1), row(3, 3, ['Benson'], 8)), null, 'equality after higher-priority demand fits');
  assert.strictEqual(status(row(1, 1), row(3, 3, ['Benson'], 4), row(2, 2, ['Benson'], 5)), 'at-risk');
  assert.strictEqual(status(row(1, 1), row(2, 1, ['Benson'], 12)), null, 'same requestor equal choice excluded');
  assert.strictEqual(status(row(1, 1, ['Benson'], 4, { Choice_Number: 2 }), row(2, 1, ['Benson'], 9)), 'losing', 'own earlier choice retains existing summary semantics');
  assert.strictEqual(status(row(1, 1), row(3, 3, ['Benson'], 12, { Choice_Number: 2 })), null, 'higher credits contribute first choice only');
  assert.strictEqual(status(row(1, 1, ['Benson', 'Bradley']), row(3, 3, ['Benson'], 12)), null, 'complete clear alternative');
  assert.strictEqual(status(row(1, 1, ['Benson', 'Bradley']), row(3, 3, ['Benson'], 12), row(2, 2, ['Bradley'], 12)), 'at-risk', 'best complete alternative');
  assert.strictEqual(status(row(1, 1, ['Benson', 'Bradley']),
    row(3, 3, ['Benson'], 12, { Departure: '2026-12-21' }),
    row(4, 3, ['Bradley'], 15, { Arrival: '2026-12-21' })), 'losing', 'cannot switch huts between nights');
  assert.strictEqual(status(row(1, 1), row(3, 3, ['Benson', 'Bradley'], 12)), null, 'higher-priority multi-hut demand is split');
  assert.strictEqual(status(row(1, 1, ['Benson'], 7), row(3, 3, ['Benson', 'Bradley'], 12)), 'losing');
  assert.strictEqual(status(row(1, 1), row(2, 2, ['Benson', 'Bradley'], 12)), null, 'equal-priority multi-hut demand split');
  assert.strictEqual(status(row(1, 1), row(3, 3, ['Benson'], 12, { Arrival: '2026-12-22', Departure: '2026-12-23' })), null, 'departure excluded');
  const first = row(1, 1, ['Benson'], 4, { Departure: '2026-12-21', Combination_first_request: 1 });
  const second = row(2, 1, ['Bradley'], 4, { Arrival: '2026-12-21', Combination_first_request: 1 });
  let combined = calculateContention([first, second, row(3, 3, ['Bradley'], 12)], requestors);
  assert.strictEqual(combined.get(1), 'losing');
  assert.strictEqual(combined.get(2), 'losing');
  combined = calculateContention([second, first, row(3, 2, ['Bradley'], 12)], requestors);
  assert.strictEqual(combined.get(1), 'at-risk');
  assert.strictEqual(combined.get(2), 'at-risk');
  for (const invalid of [
    [first], [first, { ...second, Requestor_ID: 2 }], [first, { ...second, Choice_Number: 2 }],
    [first, { ...second, Arrival: '2026-12-22', Departure: '2026-12-23' }],
    [first, { ...second, Bradley: false, Grubb: true }], [first, second, row(4, 1, ['Bradley'], 4, { Combination_first_request: 1 })],
  ]) assert.throws(() => calculateContention(invalid, requestors), /combination request 1/);
  assert.throws(() => calculateContention([row(1, 1, [])], requestors), /request 1/);
  assert.throws(() => calculateContention([row(1, 1, ['Benson'], 4, { Departure: 'invalid' })], requestors), /request 1/);
  console.log('Contention calculation test passed: thresholds, priority, whole stays, alternatives, and combinations.');
}

run();
