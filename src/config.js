const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const REQUESTORS_FILE = path.join(DATA_DIR, 'requestors.tsv');
const REQUESTS_FILE = path.join(DATA_DIR, 'requests.tsv');
const DATABASE_FILE = process.env.DATABASE_FILE || path.join(DATA_DIR, 'huts.sqlite');
const EMAIL_ERROR_LOG = path.join(DATA_DIR, 'email_errors.log');
const WAIVER_STORAGE_DIR = process.env.WAIVER_STORAGE_DIR || path.join(DATA_DIR, 'liability-waivers');
const BLANK_WAIVER_FILE = process.env.BLANK_WAIVER_FILE || path.join(DATA_DIR, 'blank-liability-waiver.txt');

const HUTS = ['Benson', 'Bradley', 'Grubb', 'Ludlow'];
const HUT_CAPACITY = {
  Benson: 12,
  Bradley: 15,
  Grubb: 15,
  Ludlow: 15,
};

module.exports = {
  PROJECT_ROOT,
  DATA_DIR,
  DATABASE_FILE,
  REQUESTORS_FILE,
  REQUESTS_FILE,
  EMAIL_ERROR_LOG,
  WAIVER_STORAGE_DIR,
  BLANK_WAIVER_FILE,
  HUTS,
  HUT_CAPACITY,
};
