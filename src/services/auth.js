const { EMAIL_FROM, mailMode, createSesTransport } = require('./mailTransport');

const LOGIN_EMAIL_NOTICE = 'By using this code to log in, you agree to our Terms of Use and Privacy Policy. Because these requests are for backcountry huts, logging in constitutes your explicit acceptance of the inherent risks of backcountry lodging, including lack of emergency services, and our volunteer limitation of liability.';

function appPublicOrigin(environment = process.env) {
  const configured = environment.APP_PUBLIC_URL;
  if (!configured && environment.NODE_ENV === 'production') {
    throw new Error('APP_PUBLIC_URL must be configured for production login emails.');
  }
  const value = configured || `http://localhost:${environment.PORT || 3000}`;
  let url;
  try { url = new URL(value); } catch { throw new Error('APP_PUBLIC_URL must be an absolute application origin.'); }
  if (/\s/.test(value) || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      (environment.NODE_ENV === 'production' && url.protocol !== 'https:')) {
    throw new Error('APP_PUBLIC_URL must be an application origin without a path, query, credentials, or fragment, using HTTPS in production.');
  }
  return url.origin;
}

function validateLoginEmailConfiguration(environment = process.env) {
  mailMode(environment);
  if (environment.APP_PUBLIC_URL || environment.NODE_ENV === 'production') {
    appPublicOrigin(environment);
  }
}

function composeLoginCodeEmail(email, code, environment = process.env) {
  const origin = appPublicOrigin(environment);
  const message = {
    to: email,
    from: EMAIL_FROM,
    subject: 'Sierra Club Huts login code',
    text: `Your login code is ${code}. It expires in 10 minutes.\n\n${LOGIN_EMAIL_NOTICE}\n\nTerms of Use: ${origin}/terms-of-use\nPrivacy Policy: ${origin}/privacy-policy`,
  };
  return message;
}

function normalizeEmail(email) {
  return String(email || '').trim().toUpperCase();
}

function generateLoginCode() {
  return 1000 + Math.floor(Math.random() * 9000);
}

function parseTimestamp(value) {
  if (!value) {
    return null;
  }
  const ms = Date.parse(String(value));
  if (Number.isNaN(ms)) {
    return null;
  }
  return ms;
}

function isWithinMinutes(value, minutes) {
  const parsed = parseTimestamp(value);
  if (parsed === null) {
    return false;
  }
  return Date.now() - parsed <= minutes * 60 * 1000;
}

function isOlderThanMinutes(value, minutes) {
  const parsed = parseTimestamp(value);
  if (parsed === null) {
    return true;
  }
  return Date.now() - parsed > minutes * 60 * 1000;
}

function toFourDigitCode(value) {
  const n = Number(value);
  if (!Number.isInteger(n)) {
    return null;
  }
  if (n < 1000 || n > 9999) {
    return null;
  }
  return n;
}

async function sendLoginCodeEmail(email, code, options = {}) {
  const environment = options.environment || process.env;
  const mode = mailMode(environment);

  if (!options.transport && mode === 'console') {
    console.info(`Login code for ${email}: ${code}`);
    return;
  }

  const transport = options.transport || createSesTransport(environment, options);

  const message = composeLoginCodeEmail(email, code, environment);

  const info = await transport.sendMail(message);
  console.info('sendEmail: provider response:', {
    accepted: info.accepted,
    rejected: info.rejected,
    response: info.response,
    envelope: info.envelope,
    messageId: info.messageId,
  });
}

function assertNormalizedEmailLength(email) {
  const normalized = normalizeEmail(email);
  if (normalized.length < 1 || normalized.length > 100) {
    throw new Error('Email text length must be 1-100 characters.');
  }
  return normalized;
}

module.exports = {
  LOGIN_EMAIL_NOTICE,
  appPublicOrigin,
  composeLoginCodeEmail,
  validateLoginEmailConfiguration,
  assertNormalizedEmailLength,
  generateLoginCode,
  isOlderThanMinutes,
  isWithinMinutes,
  normalizeEmail,
  sendLoginCodeEmail,
  toFourDigitCode,
};
