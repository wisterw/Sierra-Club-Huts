const assert = require('assert');
const { EMAIL_FROM, mailMode, createSesTransport, sendAlertMail } = require('../src/services/mailTransport');
const { composeLoginCodeEmail, sendLoginCodeEmail, validateLoginEmailConfiguration } = require('../src/services/auth');
const { composeAlert } = require('../src/services/contentionAlerts');
const { runContentionAlerts, startContentionAlertScheduler } = require('../src/services/contentionAlertWorker');

async function main() {
  const env = { NODE_ENV: 'test', MAIL_TRANSPORT: 'ses', APP_PUBLIC_URL: 'https://huts.example.org',
    LOGIN_EMAIL_FROM: 'ignored@example.org', CONTENTION_ALERT_FROM: 'ignored@example.org' };
  assert.equal(mailMode({}), 'console');
  assert.equal(mailMode({ NODE_ENV: 'production' }), 'ses');
  assert.throws(() => mailMode({ MAIL_TRANSPORT: '' }), /must be/);
  assert.throws(() => validateLoginEmailConfiguration({ NODE_ENV: 'production', MAIL_TRANSPORT: 'console' }), /production/);
  assert.throws(() => validateLoginEmailConfiguration({ NODE_ENV: 'production' }), /APP_PUBLIC_URL/);
  const clientPath = require.resolve('../libs/ses.Client');
  delete require.cache[clientPath];
  const logged = [];
  const originalLog = console.info;
  console.info = (...args) => logged.push(args);
  try {
    await sendLoginCodeEmail('test@example.org', 1234, { environment: { MAIL_TRANSPORT: 'console' } });
    assert(logged[0][0].includes('1234'));
    assert.equal(require.cache[clientPath], undefined, 'console mode must not initialize SES');
    const failure = Object.assign(new Error('No credentials'), { name: 'CredentialsProviderError' });
    logged.length = 0;
    await assert.rejects(() => sendLoginCodeEmail('test@example.org', 1234, {
      environment: env, client: { send: async () => { throw failure; } },
    }), /No credentials/);
    assert.equal(logged.length, 0, 'SES failures cannot print codes');
    assert(failure.definite);
  } finally { console.info = originalLog; }

  const login = composeLoginCodeEmail('test@example.org', 1234, env);
  const alert = composeAlert('test@example.org', { variant: 'lottery', choices: [{ choice: 1,
    status: 'at-risk', huts: [['Benson']], arrival: '2026-12-20', departure: '2026-12-22', ideal: 2, minimum: 2 }] }, env);
  for (const message of [login, alert]) {
    assert.equal(message.from, EMAIL_FROM);
    let request;
    const transport = createSesTransport(env, { client: { send: async (command) => { request = command.input; return { MessageId: 'ses-id' }; } } });
    const info = await sendAlertMail(transport, message);
    assert.equal(info.messageId, 'ses-id');
    assert.deepEqual(info.accepted, [message.to]);
    assert.equal(request.Source, EMAIL_FROM);
    assert.deepEqual(request.Destination.ToAddresses, [message.to]);
    assert.equal(request.Message.Subject.Data, message.subject);
    assert.equal(request.Message.Body.Text.Data, message.text);
    assert.equal(request.Message.Body.Html?.Data, message.html);
    assert.equal(request.Message.Body.Text.Charset, 'UTF-8');
  }
  for (const [status, definite] of [[400, true], [403, true], [429, true], [500, false]]) {
    const error = Object.assign(new Error('SES failure'), { $metadata: { httpStatusCode: status } });
    await assert.rejects(() => createSesTransport(env, { client: { send: async () => { throw error; } } }).sendMail(login));
    assert.equal(Boolean(error.definite), definite);
    assert.equal(Boolean(error.ambiguous), !definite);
  }
  for (const response of [{}, undefined]) {
    await assert.rejects(() => createSesTransport(env, { client: { send: async () => response } }).sendMail(login), (e) => e.ambiguous && !e.definite);
  }
  await assert.rejects(() => createSesTransport(env, { client: { send: async () => { throw new Error('socket reset'); } } }).sendMail(login), (e) => e.ambiguous && !e.definite);
  await assert.rejects(() => sendAlertMail({ sendMail: () => new Promise(() => {}) }, login, 5), (e) => e.ambiguous);
  const localEnv = { ...env, MAIL_TRANSPORT: 'console', CONTENTION_ALERTS_ENABLED: 'true' };
  const store = { getApplicationMode: () => 'trip-request', alerts: {
    initialize: () => assert.fail('console mode must fail before initializing or claiming recipients'), eligible: () => [],
  } };
  await assert.rejects(() => runContentionAlerts(store, { environment: localEnv }), /console/);
  assert.throws(() => startContentionAlertScheduler(store, { environment: localEnv }), /console/);
  assert.deepEqual((await runContentionAlerts(store, { environment: localEnv, dryRun: true })).previews, []);
  const { sesClient } = require('../libs/ses.Client');
  assert.equal(await sesClient.config.region(), 'us-east-2');
  assert.equal(await sesClient.config.maxAttempts(), 1);
  sesClient.destroy();
  console.log('SES mail tests passed. No AWS requests or live emails.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
