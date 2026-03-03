const express = require('express');
const path = require('path');
const session = require('express-session');
const { apiRouter, store } = require('./routes/api');

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    name: 'huts.sid',
    secret: process.env.SESSION_SECRET || 'dev-only-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 14,
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
  // eslint-disable-next-line no-console
  console.log(`Sierra Club Huts app running on http://localhost:${port}`);
});
