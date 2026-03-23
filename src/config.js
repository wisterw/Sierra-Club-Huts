const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const REQUESTORS_FILE = path.join(DATA_DIR, 'requestors.tsv');
const REQUESTS_FILE = path.join(DATA_DIR, 'requests.tsv');
const EMAIL_ERROR_LOG = path.join(DATA_DIR, 'email_errors.log');

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
  REQUESTORS_FILE,
  REQUESTS_FILE,
  EMAIL_ERROR_LOG,
  HUTS,
  HUT_CAPACITY,
};
