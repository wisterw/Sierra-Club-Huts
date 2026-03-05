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

async function sendLoginCodeEmail(email, code) {
  const sendmailEndpoint = process.env.LOCAL_SENDMAIL_ENDPOINT;
  if (!sendmailEndpoint) {
    console.info(`Login code for ${email}: ${code}`);
    return;
  }

  await fetch(sendmailEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: email,
      subject: 'Sierra Club Huts login code',
      text: `Your login code is ${code}. It expires in 10 minutes.`,
    }),
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
  assertNormalizedEmailLength,
  generateLoginCode,
  isOlderThanMinutes,
  isWithinMinutes,
  normalizeEmail,
  sendLoginCodeEmail,
  toFourDigitCode,
};
