const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { SqliteStore } = require('../src/data/sqliteStore');
const { validateRequest, summarizeByChoice } = require('../src/services/requestLogic');
const { HUTS } = require('../src/config');

function makeTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sierra-club-huts-trip-'));
  return path.join(dir, 'huts.sqlite');
}

function requestor(id, credits) {
  return { Requestor_ID: id, Credits: credits, Email: `user${id}@example.com` };
}

function requestRow(requestorId, choice, huts, arrival, departure, ideal, min = ideal, extras = {}) {
  const row = {
    Requestor_ID: requestorId,
    Arrival: arrival,
    Departure: departure,
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
    ...extras,
  };
  for (const hut of HUTS) {
    row[hut] = huts.includes(hut);
  }
  return row;
}

function run() {
  assert.strictEqual(validateRequest(requestRow(1, 1, ['Benson'], '2026-12-20', '2026-12-22', 4, 2)), null);
  assert(validateRequest(requestRow(1, 1, ['Benson'], '2026-12-22', '2026-12-20', 4, 2)));
  assert(validateRequest(requestRow(1, 1, ['Benson'], '2026-12-20', '2026-12-28', 4, 2)));
  assert(validateRequest(requestRow(1, 1, [], '2026-12-20', '2026-12-22', 4, 2)));
  assert(validateRequest(requestRow(1, 1, ['Benson'], '2026-12-20', '2026-12-22', 16, 2)));
  assert(validateRequest(requestRow(1, 1, ['Benson'], '2026-12-20', '2026-12-22', 4, 5)));
  assert(validateRequest(requestRow(1, 0, ['Benson'], '2026-12-20', '2026-12-22', 4, 2)));

  const dbPath = makeTempDb();
  const store = new SqliteStore({ dbPath, importTsv: false });
  const requestorRecord = store.upsertRequestor({
    Email: 'TRIP.TEST@EXAMPLE.COM',
    Credits: 2,
  });

  const requests = [
    requestRow(requestorRecord.Requestor_ID, 1, ['Benson', 'Bradley'], '2026-12-20', '2026-12-22', 4, 2),
    requestRow(requestorRecord.Requestor_ID, 2, ['Grubb'], '2026-12-23', '2026-12-25', 6, 3),
    requestRow(requestorRecord.Requestor_ID, 4, ['Ludlow'], '2026-12-26', '2026-12-28', 5, 2),
  ];

  store.replaceRequestsForRequestor(requestorRecord.Requestor_ID, requests);
  const saved = store.getRequestsByRequestorId(requestorRecord.Requestor_ID);
  assert.deepStrictEqual(saved.map((r) => r.Choice_Number), [1, 2, 3], 'choices should renumber sequentially');
  assert.strictEqual(saved[0].hut_count_flexibility, 2);
  assert.strictEqual(saved[0].saturday_week_number.length, 10);

  const linkedRequests = saved.map((row) => ({
    ...row,
    Combination_first_request: row.Request_ID === saved[0].Request_ID ? null : saved[0].Request_ID,
  }));
  store.replaceRequestsForRequestor(requestorRecord.Requestor_ID, linkedRequests);
  const relinked = store.getRequestsByRequestorId(requestorRecord.Requestor_ID);
  assert.strictEqual(relinked[1].Combination_first_request, relinked[0].Request_ID);

  const requestorsById = new Map([
    [1, requestor(1, 3)],
    [2, requestor(2, 2)],
    [3, requestor(3, 2)],
  ]);
  const summaryRequests = [
    requestRow(1, 1, ['Benson'], '2026-12-20', '2026-12-22', 4, 2),
    requestRow(2, 1, ['Benson'], '2026-12-20', '2026-12-22', 2, 1),
    requestRow(3, 2, ['Benson'], '2026-12-20', '2026-12-22', 3, 2),
  ];
  const summary = summarizeByChoice(summaryRequests, 2, 3, requestorsById);
  const benson = summary.find((row) => row.hut === 'Benson');
  assert(benson, 'expected a summary row for Benson');
  assert.strictEqual(benson.higherPrioritySpots, 6);
  assert.strictEqual(benson.samePrioritySpots, 0);
  assert.strictEqual(benson.samePriorityGroups, 0);

  store.close();
  console.log('trip request verification test passed.');
}

run();
