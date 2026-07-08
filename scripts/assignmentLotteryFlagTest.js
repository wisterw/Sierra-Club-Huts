const assert = require('assert');
const { runAssignment } = require('../src/services/assignment');
const { HUTS } = require('../src/config');

function requestor(id, credits, lotteryValue) {
  return {
    Requestor_ID: id,
    Credits: credits,
    Email: `user${id}@example.com`,
    Lottery_value: lotteryValue,
  };
}

function requestRow(requestorId, choice, huts, ideal, min = ideal) {
  const row = {
    Requestor_ID: requestorId,
    Arrival: '2026-02-01',
    Departure: '2026-02-03',
    Choice_Number: choice,
    Spots_ideal: ideal,
    Spots_min: min,
    Hut_granted: '',
    Spots_granted: 0,
    Status: 'requested',
    Confirmed_How: '',
    Assignment_audit: '',
    Creation_date: '',
    Last_mod_date: '',
  };
  for (const hut of HUTS) {
    row[hut] = huts.includes(hut);
  }
  return row;
}

function cloneRequestors(requestors) {
  return new Map([...requestors.entries()].map(([id, requestorRow]) => [id, { ...requestorRow }]));
}

function cloneRequests(requests) {
  return requests.map((row) => ({ ...row }));
}

function buildSample() {
  const requestors = new Map([
    [1, requestor(1, 2, 0.99)],
    [2, requestor(2, 2, 0.01)],
  ]);

  const requests = [
    requestRow(1, 1, ['Benson'], 12, 12),
    requestRow(2, 1, ['Benson'], 12, 12),
  ];

  return { requestors, requests };
}

function run() {
  const { requestors, requests } = buildSample();

  const defaultRequestors = cloneRequestors(requestors);
  const defaultRequests = cloneRequests(requests);
  runAssignment(defaultRequests, defaultRequestors, { seed: 'lottery-default' });

  assert.notStrictEqual(defaultRequestors.get(1).Lottery_value, 0.99, 'default assignment should regenerate lottery values');
  assert.notStrictEqual(defaultRequestors.get(2).Lottery_value, 0.01, 'default assignment should regenerate lottery values');

  const defaultWinner = defaultRequests.find((row) => row.Status === 'granted');
  const defaultLoser = defaultRequests.find((row) => row.Status === 'lost-lottery');
  assert(defaultWinner, 'expected a granted request in default run');
  assert(defaultLoser, 'expected a lost-lottery request in default run');
  assert(defaultWinner.Lottery_value < defaultLoser.Lottery_value, 'lower lottery value should win the tie');

  const preservedRequestors = cloneRequestors(requestors);
  const preservedRequests = cloneRequests(requests);
  runAssignment(preservedRequests, preservedRequestors, {
    seed: 'lottery-default',
    regenerateLotteryNumbers: false,
  });

  assert.strictEqual(preservedRequestors.get(1).Lottery_value, 0.99, 'regeneration-off should preserve existing lottery values');
  assert.strictEqual(preservedRequestors.get(2).Lottery_value, 0.01, 'regeneration-off should preserve existing lottery values');

  const preservedWinner = preservedRequests.find((row) => row.Status === 'granted');
  const preservedLoser = preservedRequests.find((row) => row.Status === 'lost-lottery');
  assert(preservedWinner, 'expected a granted request when regeneration is disabled');
  assert(preservedLoser, 'expected a lost-lottery request when regeneration is disabled');
  assert.strictEqual(preservedWinner.Requestor_ID, 2, 'the lower preserved lottery should win');
  assert.strictEqual(preservedWinner.Lottery_value, 0.01, 'request row should reflect the preserved lottery value');

  console.log('assignment lottery flag test passed.');
}

run();
