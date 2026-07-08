const assert = require('assert');
const { runAssignment } = require('../src/services/assignment');
const { HUTS } = require('../src/config');

function requestor(id, credits) {
  return { Requestor_ID: id, Credits: credits, Email: `user${id}@example.com` };
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

function run() {
  const requestors = new Map([
    [1, requestor(1, 3)],
    [2, requestor(2, 2)],
  ]);

  const requests = [
    requestRow(1, 1, ['Benson'], 12, 12),
    requestRow(1, 2, ['Bradley'], 2, 1),
    requestRow(2, 1, ['Benson'], 1, 1),
  ];

  runAssignment(requests, requestors, { seed: 'assignment-test' });

  const choice1 = requests.find((r) => r.Requestor_ID === 1 && r.Choice_Number === 1);
  const choice2 = requests.find((r) => r.Requestor_ID === 1 && r.Choice_Number === 2);
  const secondUser = requests.find((r) => r.Requestor_ID === 2);

  assert.strictEqual(choice1.Status, 'granted');
  assert.strictEqual(choice2.Status, 'not-used');
  assert.strictEqual(secondUser.Status, 'lost-lottery');
  assert.match(choice1.Assignment_audit, /Granted/);
  assert.match(secondUser.Assignment_audit, /No requested hut/);

  console.log('assignment status test passed.');
}

run();
