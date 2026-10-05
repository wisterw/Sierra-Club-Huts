const crypto = require('crypto');
const { HUT_CAPACITY, HUTS } = require('../config');
const { POLICY_VERSION } = require('../services/allocationModel');

function initAllocationSchema(store) {
  store.db.exec(`CREATE TABLE IF NOT EXISTS allocation_runs (
    run_id INTEGER PRIMARY KEY AUTOINCREMENT, season INTEGER NOT NULL,
    summary TEXT NOT NULL, fingerprint TEXT NOT NULL, created_at TEXT NOT NULL
  )`);
}
function captureAllocation(store, year = new Date().getFullYear(), capacities = HUT_CAPACITY) {
  // A short transaction makes the input set coherent; no lock during solving.
  return store.runTransaction(() => {
    const requests = store.listRequests().filter((r) => r.Arrival >= `${year}-12-15` && r.Arrival <= `${year + 1}-04-30`);
    const ids = new Set(requests.map((r) => r.Requestor_ID));
    const people = store.listRequestors({ includePrivate: true }).filter((p) => ids.has(p.Requestor_ID)).sort((a, b) => a.Requestor_ID - b.Requestor_ID);
    const requestFields = ['Request_ID', 'Requestor_ID', ...HUTS, 'Arrival', 'Departure', 'Choice_Number', 'Spots_ideal', 'Spots_min', 'Combination_first_request', 'Creation_date',
      'Status', 'Hut_granted', 'Spots_granted', 'Lottery_value', 'Last_mod_date', 'Assignment_audit'];
    const personFields = ['Requestor_ID', 'Credits', 'years_of_service', 'Lottery_value', 'Is_placeholder', 'Reservation_reference'];
    const latestRunId = store.db.prepare('SELECT COALESCE(MAX(run_id), 0) n FROM allocation_runs').get().n;
    const mode = store.getApplicationMode();
    const identities = store.db.prepare('SELECT request_id, notification_identity FROM ski_trip_requests ORDER BY request_id').all().filter((r) => requests.some((q) => q.Request_ID === Number(r.request_id)));
    const input = { year, mode, capacities, latestRunId, identities,
      requests: requests.slice().sort((a, b) => a.Request_ID - b.Request_ID).map((r) => requestFields.map((key) => r[key])),
      people: people.map((p) => personFields.map((key) => p[key])) };
    return { year, mode, requests, requestors: people, capacities: { ...capacities },
      fingerprint: crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex') };
  });
}
function commitAllocation(store, snapshot, requests, result) {
  return store.runTransaction(() => {
    const current = captureAllocation(store, snapshot.year);
    if (current.mode !== 'trip-request' || current.fingerprint !== snapshot.fingerprint) throw Object.assign(new Error('Allocation inputs changed while solving. Run assignment again.'), { statusCode: 409 });
    store.saveRequests(requests);
    store.saveRequestorLotteryValues(result.requestorsToPersist);
    const { requestorsToPersist, allocation, ...summary } = result;
    summary.season = snapshot.year;
    const id = Number(store.db.prepare('INSERT INTO allocation_runs(season, summary, fingerprint, created_at) VALUES (?, ?, ?, ?)')
      .run(snapshot.year, JSON.stringify(summary), '', new Date().toISOString()).lastInsertRowid);
    const fingerprint = captureAllocation(store, snapshot.year).fingerprint;
    store.db.prepare('UPDATE allocation_runs SET fingerprint = ? WHERE run_id = ?').run(fingerprint, id);
    return { ...summary, runId: id, stale: false };
  });
}
function latestAllocation(store) {
  const row = store.db.prepare('SELECT * FROM allocation_runs ORDER BY run_id DESC LIMIT 1').get();
  if (!row) return null;
  const summary = JSON.parse(row.summary);
  return { ...summary, runId: Number(row.run_id), stale: summary.policyVersion !== POLICY_VERSION || captureAllocation(store, Number(row.season)).fingerprint !== row.fingerprint };
}
module.exports = { initAllocationSchema, captureAllocation, commitAllocation, latestAllocation };
