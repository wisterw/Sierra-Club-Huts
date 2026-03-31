const express = require('express');
const path = require('path');
const session = require('express-session');
const { apiRouter, store } = require('./routes/api');

const app = express();
const port = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';
const trustProxy = process.env.TRUST_PROXY === '1';
const sessionSecret = process.env.SESSION_SECRET || (isProduction ? '' : 'dev-only-change-me');

if (isProduction && !sessionSecret) {
  throw new Error('SESSION_SECRET must be set when NODE_ENV=production.');
}

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.set('trust proxy', trustProxy);

app.use(
  session({
    name: 'huts.sid',
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.SESSION_SECURE === 'true',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

app.use('/api', apiRouter);
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

process.on('SIGINT', () => {
  store.flush(true);
  process.exit(0);
});
process.on('SIGTERM', () => {
  store.flush(true);
  process.exit(0);
});

app.listen(port, () => {
  const displayHost = process.env.PUBLIC_HOST || 'localhost';
  const scheme = process.env.PUBLIC_SCHEME || 'http';
  // eslint-disable-next-line no-console
  console.log(`Sierra Club Huts app running on ${scheme}://${displayHost}:${port}`);
});
