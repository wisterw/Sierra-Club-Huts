const assert = require('assert');
const fs = require('fs');
const path = require('path');

const originalRead = fs.readFileSync;
const originalOrigin = process.env.APP_PUBLIC_URL;
const originalMode = process.env.NODE_ENV;
const expectedPath = path.resolve(__dirname, '..', '.env');
let reads = 0;
// Substitute a fixture without reading or changing the private project .env.
fs.readFileSync = function (file, ...args) {
  if (String(file) === expectedPath) {
    reads++;
    return Buffer.from('NODE_ENV=production\nAPP_PUBLIC_URL=https://tahoe-ski-huts.rsvp\n');
  }
  return originalRead.call(this, file, ...args);
};
try {
  delete process.env.APP_PUBLIC_URL;
  process.env.NODE_ENV = 'test';
  require('../src/loadEnvironment');
  assert.equal(reads, 1);
  assert.equal(process.env.NODE_ENV, 'test', 'explicit process settings take precedence');
  assert.equal(process.env.APP_PUBLIC_URL, 'https://tahoe-ski-huts.rsvp');
  const { composeLoginCodeEmail } = require('../src/services/auth');
  const email = composeLoginCodeEmail('test@example.org', 1234);
  assert(email.text.includes('https://tahoe-ski-huts.rsvp/terms-of-use'));
  assert(email.text.includes('https://tahoe-ski-huts.rsvp/privacy-policy'));
  assert(!email.text.includes('localhost'));
  console.log('Environment loading test passed: project path, file values, process precedence, and public email links.');
} finally {
  fs.readFileSync = originalRead;
  if (originalOrigin === undefined) delete process.env.APP_PUBLIC_URL;
  else process.env.APP_PUBLIC_URL = originalOrigin;
  if (originalMode === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalMode;
}
