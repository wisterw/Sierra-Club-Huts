const fs = require('fs');

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
  const msmtpPath = process.env.MSMTP_PATH || '/usr/bin/msmtp';
  const msmtpConfig = process.env.MSMTP_CONFIG || '/etc/msmtprc';
  const msmtpAccount = process.env.MSMTP_ACCOUNT || 'mail_relay_credentials';
  const from = process.env.LOGIN_EMAIL_FROM || '';

  if (!fs.existsSync(msmtpPath)) {
    console.info(`Login code for ${email}: ${code}`);
    return;
  }

  let nodemailer;
  try {
    // Optional dependency so development can still run without local msmtp wiring.
    // eslint-disable-next-line global-require
    nodemailer = require('nodemailer');
  } catch (err) {
    console.error('sendEmail: nodemailer is required for msmtp relay.');
    throw err;
  }

  const transport = nodemailer.createTransport({
    sendmail: true,
    newline: 'unix',
    path: msmtpPath,
    // Use msmtp's native options for account + config file.
    args: ['-i', '-a', msmtpAccount, '-C', msmtpConfig],
  });

  const message = {
    to: email,
    subject: 'Sierra Club Huts login code',
    text: `Your login code is ${code}. It expires in 10 minutes.`,
  };
  if (from) {
    message.from = from;
  }

  await transport.sendMail(message);
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
