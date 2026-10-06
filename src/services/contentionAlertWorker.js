const crypto = require('crypto');
const { composeAlert } = require('./contentionAlerts');
const { appPublicOrigin } = require('./auth');
const { createSesTransport, sendAlertMail, mailMode } = require('./mailTransport');

function validateAlertConfiguration(environment) {
  if (!environment.APP_PUBLIC_URL) throw new Error('APP_PUBLIC_URL is required for contention alerts.');
  appPublicOrigin(environment);
  mailMode(environment);
}
async function runContentionAlerts(store, options = {}) {
  const environment = options.environment || process.env;
  const result = { sent: 0, failed: 0, ambiguous: 0, previews: [], skipped: null };
  if (!options.dryRun && environment.CONTENTION_ALERTS_ENABLED !== 'true') return { ...result, skipped: 'disabled' };
  if (store.getApplicationMode() !== 'trip-request') return { ...result, skipped: 'mode' };
  validateAlertConfiguration(environment);
  if (options.dryRun) {
    result.previews = store.alerts.eligible().map((s) => ({ requestorId: s.requestor_id, revision: s.revision,
      message: composeAlert(store.getRequestorById(s.requestor_id).Email, JSON.parse(s.pending), environment) }));
    return result;
  }
  // Fail before claiming any recipient when transport configuration is absent.
  const transport = options.transport || createSesTransport(environment);
  store.alerts.initialize();
  const owner = crypto.randomUUID();
  if (!store.alerts.acquire(owner, options.force)) return { ...result, skipped: 'not-due-or-leased' };
  const heartbeat = setInterval(() => store.alerts.renew(owner), 60000);
  heartbeat.unref();
  try {
    store.refreshContention();
    store.runTransaction(() => store.alerts.sync());
    for (const state of store.alerts.eligible()) {
      if (!store.alerts.renew(owner)) throw new Error('Contention alert worker lease lost.');
      const message = composeAlert(store.getRequestorById(state.requestor_id).Email, JSON.parse(state.pending), environment);
      const attempt = store.alerts.claim(state, message);
      if (!attempt) continue;
      let outcome = 'accepted';
      let deliveryError = null;
      try { await sendAlertMail(transport, message, options.timeoutMs); }
      catch (error) {
        deliveryError = error.message;
        // Unknown network/server errors may occur after acceptance.
        outcome = error.definite ? 'rejected' : 'ambiguous';
      }
      store.alerts.finish(attempt, outcome, deliveryError);
      if (outcome === 'accepted') result.sent += 1;
      else if (outcome === 'rejected') result.failed += 1;
      else result.ambiguous += 1;
    }
    return result;
  } finally { clearInterval(heartbeat); store.alerts.release(owner); }
}
function startContentionAlertScheduler(store, options = {}) {
  const environment = options.environment || process.env;
  if (environment.CONTENTION_ALERTS_ENABLED !== 'true') return () => {};
  validateAlertConfiguration(environment);
  if (!options.transport) createSesTransport(environment);
  store.alerts.initialize();
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const result = await runContentionAlerts(store, options);
      if (!result.skipped) console.info('Contention alert run:', result);
    } catch (error) { console.error('Contention alert run failed:', error.message); }
    finally { running = false; }
  };
  const timer = setInterval(tick, 60000);
  timer.unref();
  tick();
  return () => clearInterval(timer);
}
module.exports = { runContentionAlerts, startContentionAlertScheduler, validateAlertConfiguration };
