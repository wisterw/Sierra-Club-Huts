require('../src/loadEnvironment');
const { SqliteStore } = require('../src/data/sqliteStore');
const { runContentionAlerts } = require('../src/services/contentionAlertWorker');

async function main() {
  const store = new SqliteStore();
  try {
    const args = process.argv.slice(2);
    if (args[0] === '--attempts') {
      console.log(JSON.stringify(store.db.prepare("SELECT attempt_id, requestor_id, season, revision, started_at, outcome, error FROM contention_alert_attempts WHERE outcome IN ('sending', 'ambiguous')").all(), null, 2));
    } else if (args[0] === '--reconcile') {
      const [, id, outcome] = args;
      if (!id || !['accepted', 'rejected'].includes(outcome)) throw new Error('Usage: --reconcile ATTEMPT_ID accepted|rejected');
      store.alerts.finish(id, outcome, 'Operator reconciled provider outcome');
      console.log('Reconciled attempt', id, outcome);
    } else {
      console.log(JSON.stringify(await runContentionAlerts(store, { dryRun: args.includes('--dry-run'), force: args.includes('--force') }), null, 2));
    }
  } finally { store.close(); }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
