const crypto = require('crypto');

function normalizeEmail(email) {
  return String(email || '').trim().toUpperCase();
}

function hashEmail(email) {
  const normalized = normalizeEmail(email);
  if (normalized.length < 1 || normalized.length > 100) {
    throw new Error('Email text length must be 1-100 characters.');
  }
  const salt = process.env.EMAIL_HASH_SALT;
  if (!salt) {
    throw new Error('EMAIL_HASH_SALT is required.');
  }

  const digest = crypto
    .createHash('sha256')
    .update(`${salt}:${normalized}`)
    .digest('hex');

  const num = parseInt(digest.slice(0, 8), 16);
  return 1000 + (num % 9000);
}

module.exports = {
  normalizeEmail,
  hashEmail,
};
