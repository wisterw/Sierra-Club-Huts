const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { SqliteStore } = require('../src/data/sqliteStore');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sierra-club-huts-'));
}

function run() {
  const tempDir = makeTempDir();
  const dbPath = path.join(tempDir, 'huts.sqlite');

  const store = new SqliteStore({ dbPath });
  const requestorCount = store.db.prepare('SELECT COUNT(*) AS c FROM requestors').get().c;
  const requestCount = store.db.prepare('SELECT COUNT(*) AS c FROM ski_trip_requests').get().c;
  assert(requestorCount > 0, 'expected imported requestors');
  assert(requestCount > 0, 'expected imported requests');
  store.close();

  const reopened = new SqliteStore({ dbPath, importTsv: false });
  const requestorColumns = reopened.db.prepare('PRAGMA table_info(requestors)').all().map((row) => row.name);
  assert(requestorColumns.includes('lottery_value'), 'expected requestors table to include lottery_value');
  const reopenedCounts = {
    requestors: reopened.db.prepare('SELECT COUNT(*) AS c FROM requestors').get().c,
    requests: reopened.db.prepare('SELECT COUNT(*) AS c FROM ski_trip_requests').get().c,
  };
  assert.strictEqual(reopenedCounts.requestors, requestorCount, 'requestors should persist after restart');
  assert.strictEqual(reopenedCounts.requests, requestCount, 'requests should persist after restart');
  const importedRequestor = reopened.getRequestorById(1962792, { includePrivate: true });
  assert(importedRequestor, 'expected imported requestor to exist');
  assert.strictEqual(importedRequestor.Lottery_value, null, 'expected imported lottery value to be null');
  reopened.saveRequestorLotteryValues([
    { Requestor_ID: importedRequestor.Requestor_ID, Lottery_value: 0.123456 },
  ]);
  const updatedRequestor = reopened.getRequestorById(1962792, { includePrivate: true });
  assert.strictEqual(updatedRequestor.Lottery_value, 0.123456, 'expected lottery value update to persist in-memory');
  reopened.close();

  const reopenedAgain = new SqliteStore({ dbPath, importTsv: false });
  const persistedRequestor = reopenedAgain.getRequestorById(1962792, { includePrivate: true });
  assert.strictEqual(persistedRequestor.Lottery_value, 0.123456, 'expected lottery value update to persist after reopen');
  reopenedAgain.close();

  const badDir = makeTempDir();
  const badRequestors = path.join(badDir, 'bad-requestors.tsv');
  const badRequests = path.join(badDir, 'bad-requests.tsv');
  fs.writeFileSync(badRequestors, 'Wrong\tHeader\n1\tbad\n', 'utf8');
  fs.writeFileSync(badRequests, 'Requestor_ID\tBenson\tBradley\tGrubb\tLudlow\tArrival\tDeparture\tChoice_Number\tSpots_ideal\tSpots_min\tHut_granted\tSpots_granted\tStatus\tLottery_value\tConfirmed_How\tCreation_date\tLast_mod_date\thut_count_flexibility\tsaturday_week_number\n1\tTRUE\tFALSE\tFALSE\tFALSE\t2026-01-01\t2026-01-02\t1\t1\t1\t\t0\trequested\t0\t\t\t\t1\t2026-01-01\n', 'utf8');

  let failed = false;
  try {
    // eslint-disable-next-line no-new
    new SqliteStore({ dbPath: path.join(badDir, 'bad.sqlite'), requestorsFile: badRequestors, requestsFile: badRequests });
  } catch (err) {
    failed = /Invalid header row/i.test(err.message);
  }
  assert(failed, 'expected invalid header row to fail import');

  console.log('sqlite migration test passed.');
}

run();
