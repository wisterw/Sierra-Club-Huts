const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { SqliteStore } = require('../src/data/sqliteStore');

function makeTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sierra-club-huts-profile-'));
  return path.join(dir, 'huts.sqlite');
}

function run() {
  const dbPath = makeTempDb();
  const store = new SqliteStore({ dbPath, importTsv: false });

  const requestor = store.upsertRequestor({
    Email: 'PROFILE.TEST@EXAMPLE.COM',
    first_name: 'Pat',
    last_name: 'Example',
    Credits: 4,
    has_a_chainsaw: true,
    chainsaw_user: false,
    private_comments: 'keep private',
    liability_waiver_date: '2026-01-02',
  });

  store.updateRequestorById(requestor.Requestor_ID, {
    first_name: 'Updated',
    Credits: 99,
    Admin: true,
    private_comments: 'should stay hidden',
    liability_waiver_date: '2026-12-31',
  }, { allowAdminFields: false });

  const publicView = store.getRequestorById(requestor.Requestor_ID);
  assert.strictEqual(publicView.first_name, 'Updated');
  assert.strictEqual(publicView.Credits, 4, 'non-admin update must not change credits');
  assert.strictEqual(publicView.Admin, false, 'non-admin update must not change admin flag');
  assert(!Object.prototype.hasOwnProperty.call(publicView, 'private_comments'), 'private comments must be omitted');
  assert(!Object.prototype.hasOwnProperty.call(publicView, 'liability_waiver_date'), 'waiver date must be omitted');

  const adminUpdated = store.updateRequestorById(requestor.Requestor_ID, {
    Credits: 7,
    Admin: true,
    private_comments: 'admin note',
    liability_waiver_date: '2026-12-31',
  }, { allowAdminFields: true, includePrivate: true });

  assert.strictEqual(adminUpdated.Credits, 7, 'admin update should persist credits');
  assert.strictEqual(adminUpdated.Admin, true, 'admin update should persist admin flag');
  assert.strictEqual(adminUpdated.private_comments, 'admin note');
  assert.strictEqual(adminUpdated.liability_waiver_date, '2026-12-31');

  const privateView = store.getRequestorById(requestor.Requestor_ID, { includePrivate: true });
  assert.strictEqual(privateView.private_comments, 'admin note');
  assert.strictEqual(privateView.liability_waiver_date, '2026-12-31');

  store.close();
  console.log('profile access test passed.');
}

run();
