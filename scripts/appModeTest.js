const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { SqliteStore } = require('../src/data/sqliteStore');

function run() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sierra-club-huts-mode-'));
  const store = new SqliteStore({ dbPath: path.join(tempDir, 'huts.sqlite'), importTsv: false });

  assert.strictEqual(store.getApplicationMode(), 'inactive');
  store.setApplicationMode('trip-request');
  assert.strictEqual(store.getApplicationMode(), 'trip-request');
  store.setApplicationMode('work-party');
  assert.strictEqual(store.getApplicationMode(), 'work-party');

  let failed = false;
  try {
    store.setApplicationMode('invalid-mode');
  } catch {
    failed = true;
  }
  assert(failed, 'expected invalid mode to throw');

  store.close();
  console.log('app mode test passed.');
}

run();
