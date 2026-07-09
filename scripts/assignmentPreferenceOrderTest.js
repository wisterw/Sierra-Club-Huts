const assert = require('assert');
const { runAssignment } = require('../src/services/assignment');
const { HUTS } = require('../src/config');

function requestor(id, credits, yearsOfService, lotteryValue) {
  return {
    Requestor_ID: id,
    Credits: credits,
    years_of_service: yearsOfService,
    Email: `user${id}@example.com`,
    Lottery_value: lotteryValue,
  };
}

function requestRow(requestorId, choice, huts, ideal, min = ideal) {
  const row = {
    Requestor_ID: requestorId,
    Arrival: '2026-12-20',
    Departure: '2026-12-22',
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

function run() {
  const requestors = new Map([
    [1, requestor(1, 2, 10, 0.99)],
    [2, requestor(2, 2, 1, 0.01)],
  ]);

  const requests = [
    requestRow(1, 1, ['Benson'], 12, 12),
    requestRow(2, 1, ['Benson'], 12, 12),
  ];

  runAssignment(requests, requestors, { seed: 'preference-order', regenerateLotteryNumbers: false });

  const winner = requests.find((row) => row.Status === 'granted');
  const loser = requests.find((row) => row.Status === 'lost-lottery');
  assert(winner, 'expected a winner');
  assert(loser, 'expected a loser');
  assert.strictEqual(winner.Requestor_ID, 1, 'higher years of service should win before lottery');
  assert.strictEqual(winner.Lottery_value, 0.99, 'winner should keep preserved lottery value');

  console.log('assignment preference order test passed.');
}

run();
