// Credit units at public boundaries; exact integer tenths in SQLite.
function parseTenths(value) {
  if ((typeof value !== 'number' && typeof value !== 'string')
    || (typeof value === 'number' && !Number.isFinite(value))) {
    throw new Error('Credits must be a finite decimal number.');
  }
  const text = String(value).trim();
  const match = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(text);
  if (!match || !(match[2] || match[3])) throw new Error('Credits must be a decimal number.');
  const fraction = match[3] || '';
  if (/[1-9]/.test(fraction.slice(1))) throw new Error('Credits must have at most one decimal place.');
  const magnitude = BigInt(match[2] || '0') * 10n + BigInt(fraction[0] || '0');
  const signed = match[1] === '-' ? -magnitude : magnitude;
  if (signed > BigInt(Number.MAX_SAFE_INTEGER) || signed < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new Error('Credits are outside the supported range.');
  }
  return Number(signed) || 0;
}

function creditsToTenths(value) {
  const tenths = parseTenths(value);
  // Public numeric payloads must also round-trip without losing a tenth.
  if (parseTenths(tenths / 10) !== tenths) throw new Error('Credits are outside the supported range.');
  return tenths;
}

function creditsFromTenths(tenths) {
  if (!Number.isSafeInteger(tenths)) throw new Error('Stored credit tenths must be a safe integer.');
  const credits = tenths / 10;
  if (creditsToTenths(credits) !== tenths) throw new Error('Stored credits are outside the supported range.');
  return credits || 0;
}

function normalizeCredits(value) {
  return creditsFromTenths(creditsToTenths(value));
}

module.exports = { creditsToTenths, creditsFromTenths, normalizeCredits };
