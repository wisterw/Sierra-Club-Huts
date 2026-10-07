const path = require('path');

// Resolve from this project, independent of PM2's working directory.
// Explicit process/PM2 variables take precedence over the file.
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });
