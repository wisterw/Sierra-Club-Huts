const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { SqliteStore } = require('../src/data/sqliteStore');

function makeTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sierra-club-huts-work-party-'));
  return path.join(dir, 'huts.sqlite');
}

function run() {
  const dbPath = makeTempDb();
  const store = new SqliteStore({ dbPath, importTsv: false });

  const requestor = store.upsertRequestor({
    Email: 'WORK.PARTY@EXAMPLE.COM',
    Credits: 2,
  });
  const secondRequestor = store.upsertRequestor({
    Email: 'WORK.PARTY.TWO@EXAMPLE.COM',
    Credits: 1,
  });

  store.upsertWorkParty({
    Friday_check_in: '2026-08-14',
    Hut: 'Benson',
    Sunday_check_out: '2026-08-16',
    Leader: 'Leader One',
    Leader_phone: '555-111-2222',
    Capacity: 8,
    Party_comments: 'Trail work',
  });
  store.upsertWorkParty({
    Friday_check_in: '2026-08-21',
    Hut: 'Bradley',
    Sunday_check_out: '2026-08-23',
    Leader: 'Leader Two',
    Leader_phone: '555-333-4444',
    Capacity: 12,
    Party_comments: 'Log hauling',
  });
  store.upsertWorkParty({
    Friday_check_in: '2026-08-28',
    Hut: 'Ludlow',
    Sunday_check_out: '2026-08-30',
    Leader: 'Leader Three',
    Leader_phone: '555-555-6666',
    Capacity: 1,
    Party_comments: 'Wood stacking',
  });

  const rows = store.listWorkParties(2026, requestor.Requestor_ID);
  assert.strictEqual(rows.length, 3);
  assert.strictEqual(rows[0].Interest, 'no thank you');
  assert.strictEqual(rows[0].Availability, 'open');
  assert.strictEqual(rows[0].Leader, 'Leader One');

  store.saveWorkPartyInterests(requestor.Requestor_ID, [
    { Friday_check_in: '2026-08-14', Hut: 'Benson', Interest: 'please consider me' },
    { Friday_check_in: '2026-08-21', Hut: 'Bradley', Interest: 'no thank you' },
  ]);

  const savedRows = store.listWorkParties(2026, requestor.Requestor_ID);
  const benson = savedRows.find((row) => row.Hut === 'Benson');
  const bradley = savedRows.find((row) => row.Hut === 'Bradley');
  assert.strictEqual(benson.Interest, 'please consider me');
  assert.strictEqual(bradley.Interest, 'no thank you');

  const count = store.db.prepare('SELECT COUNT(*) AS c FROM work_party_requests').get().c;
  assert.strictEqual(count, 1, 'no thank you rows should be omitted from persistence');

  store.saveWorkPartyInterests(requestor.Requestor_ID, [
    { Friday_check_in: '2026-08-28', Hut: 'Ludlow', Interest: 'please consider me' },
  ]);
  let ludlow = store.listWorkParties(2026, requestor.Requestor_ID).find((row) => row.Hut === 'Ludlow');
  assert.strictEqual(ludlow.Availability, 'open');
  assert.strictEqual(ludlow.Confirmation_status, 'pending');

  store.saveWorkPartyInterests(secondRequestor.Requestor_ID, [
    { Friday_check_in: '2026-08-28', Hut: 'Ludlow', Interest: 'please consider me' },
  ]);
  ludlow = store.listWorkParties(2026, requestor.Requestor_ID).find((row) => row.Hut === 'Ludlow');
  assert.strictEqual(ludlow.Availability, 'waitlist-only');

  store.saveWorkPartyInterests(secondRequestor.Requestor_ID, [
    { Friday_check_in: '2026-08-28', Hut: 'Ludlow', Interest: 'no thank you' },
  ]);
  ludlow = store.listWorkParties(2026, requestor.Requestor_ID).find((row) => row.Hut === 'Ludlow');
  assert.strictEqual(ludlow.Availability, 'waitlist-only');

  store.upsertWorkParty({
    Friday_check_in: '2026-08-28',
    Hut: 'Ludlow',
    Sunday_check_out: '2026-08-30',
    Leader: 'Leader Three Updated',
    Leader_phone: '555-555-6666',
    Capacity: 4,
    Party_comments: 'Wood stacking and cleanup',
  });
  ludlow = store.listWorkParties(2026, requestor.Requestor_ID).find((row) => row.Hut === 'Ludlow');
  assert.strictEqual(ludlow.Availability, 'waitlist-only');

  store.close();
  console.log('work party signup test passed.');
}

run();
