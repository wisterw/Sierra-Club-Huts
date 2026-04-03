const fs = require('fs');
const express = require('express');
const multer = require('multer');
const { EMAIL_ERROR_LOG } = require('../config');
const { TsvStore, toTsv, REQUESTORS_HEADERS } = require('../data/tsvStore');
const {
  generateLoginCode,
  isOlderThanMinutes,
  isWithinMinutes,
  normalizeEmail,
  sendLoginCodeEmail,
  toFourDigitCode,
} = require('../services/auth');
const { validateRequest, summarizeByChoice } = require('../services/requestLogic');
const { runAssignment, efficiencyReport, requestsJoinedReport } = require('../services/assignment');

const upload = multer();
const router = express.Router();
const store = new TsvStore();
const AUTH_FAILURE_MESSAGE = 'Login failure, please try again later or contact the hut administrator.';

function appendEmailErrorLog(email, err) {
  try {
    const line = [
      new Date().toISOString(),
      email || '',
      err?.message || 'unknown error',
    ].join('\t');
    fs.appendFileSync(EMAIL_ERROR_LOG, `${line}\n`, 'utf8');
  } catch (logErr) {
    console.error('sendEmail: failed to write email error log:', logErr.message);
  }
}

function toBoolean(v) {
  return v === true || v === 'true' || v === 'TRUE' || v === 1 || v === '1';
}

function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
}

function requireAdmin(req, res, next) {
  const user = store.getRequestorById(req.session?.userId);
  if (!user || !user.Admin) {
    return res.status(403).json({ error: 'Admin privileges required.' });
  }
  return next();
}

function requestorPayload(requestor) {
  return {
    ...requestor,
    requests: store.getRequestsByRequestorId(requestor.Requestor_ID),
  };
}

router.post('/send-email', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const requestor = store.getRequestorByEmail(email);
    if (!requestor) {
      console.error(`sendEmail: unknown email: ${email}`);
      return res.json({ ok: true, message: 'code sent' });
    }

    const code = generateLoginCode();
    requestor.login_code = code;
    requestor.code_generated_when = new Date().toISOString();
    requestor.Last_mod_date = new Date().toISOString();
    store.markDirty();
    console.info(`sendEmail: login code for ${requestor.Email}: ${code}`);

    try {
      await sendLoginCodeEmail(requestor.Email, code);
    } catch (err) {
      appendEmailErrorLog(requestor.Email, err);
      console.error(
        `sendEmail: sendmail failed for ${requestor.Email}:`,
        err && {
          message: err.message,
          code: err.code,
          command: err.command,
          response: err.response,
          responseCode: err.responseCode,
          stack: err.stack,
        }
      );
    }

    return res.json({ ok: true, message: 'code sent' });
  } catch (err) {
    console.error('sendEmail: unexpected error:', err.message);
    return res.json({ ok: true, message: 'code sent' });
  }
});

router.post('/check-login', (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const providedCode = toFourDigitCode(req.body?.code);
    const requestor = store.getRequestorByEmail(email);

    if (!requestor) {
      console.error(`checkLogin: unknown email: ${email}`);
      return res.status(401).json({ error: AUTH_FAILURE_MESSAGE });
    }

    if (isWithinMinutes(requestor.last_failed_login, 1)) {
      return res.status(401).json({ error: AUTH_FAILURE_MESSAGE });
    }

    if (isOlderThanMinutes(requestor.code_generated_when, 10)) {
      return res.status(401).json({ error: AUTH_FAILURE_MESSAGE });
    }

    if (providedCode === null || providedCode !== requestor.login_code) {
      requestor.last_failed_login = new Date().toISOString();
      requestor.Last_mod_date = new Date().toISOString();
      store.markDirty();
      return res.status(401).json({ error: AUTH_FAILURE_MESSAGE });
    }

    req.session.userId = requestor.Requestor_ID;
    req.session.save(() => {
      res.json({ userId: requestor.Requestor_ID, isAdmin: requestor.Admin });
    });
  } catch (err) {
    console.error('checkLogin: unexpected error:', err.message);
    res.status(401).json({ error: AUTH_FAILURE_MESSAGE });
  }
});

router.post('/logout', (req, res) => {
  const finalize = () => {
    res.clearCookie('huts.sid');
    return res.json({ ok: true });
  };

  if (!req.session) {
    return finalize();
  }

  return req.session.destroy(() => finalize());
});

router.get('/me', requireAuth, (req, res) => {
  const requestor = store.getRequestorById(req.session.userId);
  if (!requestor) {
    return res.status(404).json({ error: 'Requestor not found.' });
  }
  return res.json(requestorPayload(requestor));
});

router.get('/requestor/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const current = store.getRequestorById(req.session.userId);
  if (!current) {
    return res.status(404).json({ error: 'Session user not found.' });
  }
  if (!current.Admin && id !== current.Requestor_ID) {
    return res.status(403).json({ error: 'Forbidden.' });
  }

  const target = store.getRequestorById(id);
  if (!target) {
    return res.status(404).json({ error: 'Requestor not found.' });
  }

  return res.json(requestorPayload(target));
});

router.put('/requestor/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const current = store.getRequestorById(req.session.userId);
  if (!current) {
    return res.status(404).json({ error: 'Session user not found.' });
  }
  if (!current.Admin && id !== current.Requestor_ID) {
    return res.status(403).json({ error: 'Forbidden.' });
  }

  const updates = {
    first_name: req.body.first_name,
    last_name: req.body.last_name,
    address: req.body.address,
    city: req.body.city,
    state: req.body.state,
    zip: req.body.zip,
    Phone: req.body.Phone,
    Comments: req.body.Comments,
  };

  if (current.Admin) {
    if (req.body.Credits !== undefined) updates.Credits = Number(req.body.Credits);
    if (req.body.Admin !== undefined) updates.Admin = toBoolean(req.body.Admin);
  }

  const updated = store.updateRequestorById(id, updates);
  if (!updated) {
    return res.status(404).json({ error: 'Requestor not found.' });
  }
  return res.json(requestorPayload(updated));
});

router.put('/requestor/:id/requests', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const current = store.getRequestorById(req.session.userId);
  if (!current) {
    return res.status(404).json({ error: 'Session user not found.' });
  }
  if (!current.Admin && id !== current.Requestor_ID) {
    return res.status(403).json({ error: 'Forbidden.' });
  }

  const requests = Array.isArray(req.body.requests) ? req.body.requests : [];
  for (const request of requests) {
    const error = validateRequest(request);
    if (error) {
      return res.status(400).json({ error });
    }
  }

  store.replaceRequestsForRequestor(id, requests);
  return res.json({ ok: true, requests: store.getRequestsByRequestorId(id) });
});

router.get('/request-summary', requireAuth, (req, res) => {
  const choiceNumber = Number(req.query.choiceNumber || 1);
  const excludeRequestorId = req.query.excludeRequestorId ? Number(req.query.excludeRequestorId) : null;
  const requestorsById = new Map(store.listRequestors().map((r) => [r.Requestor_ID, r]));
  const summary = summarizeByChoice(store.listRequests(), choiceNumber, excludeRequestorId, requestorsById);
  return res.json({ rows: summary });
});

router.post('/admin/upload-requestors', requireAuth, requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Missing file upload.' });
  }

  const raw = req.file.buffer.toString('utf8');
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) {
    return res.status(400).json({ error: 'TSV file has no data rows.' });
  }

  const headers = lines[0].split('\t');
  const idx = (h) => headers.findIndex((x) => x === h);
  const cell = (cells, header) => {
    const i = idx(header);
    return i >= 0 ? cells[i] : '';
  };
  const splitName = (name) => {
    const cleaned = String(name || '').trim();
    if (!cleaned) return { first: '', last: '' };
    const parts = cleaned.split(/\s+/, 2);
    return { first: parts[0] || '', last: parts[1] || '' };
  };
  const iEmail = idx('Email');
  if (iEmail < 0) {
    return res.status(400).json({ error: 'TSV must include Email header.' });
  }

  let createdOrUpdated = 0;
  for (const line of lines.slice(1)) {
    const cells = line.split('\t');
    const email = cells[iEmail];
    if (!email) continue;
    const fallbackName = splitName(cell(cells, 'Name'));

    store.upsertRequestor({
      Email: email,
      first_name: cell(cells, 'first_name') || fallbackName.first,
      last_name: cell(cells, 'last_name') || fallbackName.last,
      address: cell(cells, 'address'),
      city: cell(cells, 'city'),
      state: cell(cells, 'state'),
      zip: cell(cells, 'zip'),
      Phone: cell(cells, 'Phone'),
      Comments: cell(cells, 'Comments'),
      Credits: Number(cell(cells, 'Credits') || 0),
      Admin: toBoolean(cell(cells, 'Admin')),
      login_code: cell(cells, 'login_code'),
      code_generated_when: cell(cells, 'code_generated_when') || cell(cells, 'Email_code_sent'),
      last_failed_login: cell(cells, 'last_failed_login'),
    });
    createdOrUpdated += 1;
  }

  return res.json({ ok: true, createdOrUpdated });
});

router.get('/admin/download/requestors', requireAuth, requireAdmin, (req, res) => {
  const filter = String(req.query.filter || 'all');
  const requestors = store.listRequestors();
  const requests = store.listRequests();

  const rows = requestors.filter((r) => {
    const mine = requests.filter((x) => x.Requestor_ID === r.Requestor_ID);
    if (filter === 'no-pending-requests') {
      return mine.every((x) => !['pending', 'requested'].includes(x.Status));
    }
    if (filter === 'no-likely-requests') {
      return mine.every((x) => !['pending', 'requested', 'confirmed', 'granted'].includes(x.Status));
    }
    if (filter === 'no-assigned-requests') {
      return mine.every((x) => !['confirmed', 'granted'].includes(x.Status));
    }
    return true;
  });

  const withRequests = rows.map((r) => ({
    ...r,
    Requests_Assigned: requests.some((x) => x.Requestor_ID === r.Requestor_ID && ['confirmed', 'granted'].includes(x.Status)) ? 'TRUE' : 'FALSE',
  }));

  const headers = [...REQUESTORS_HEADERS, 'Requests_Assigned'];
  res.setHeader('Content-Type', 'text/tab-separated-values; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="requestors.tsv"');
  return res.send(toTsv(headers, withRequests));
});

router.get('/admin/download/requests-joined', requireAuth, requireAdmin, (req, res) => {
  const requestorsById = new Map(store.listRequestors().map((r) => [r.Requestor_ID, r]));
  const filter = String(req.query.filter || 'all');
  const joined = requestsJoinedReport(store.listRequests(), requestorsById, { filter });
  const headers = [
    'Requestor_ID',
    'Email',
    'first_name',
    'last_name',
    'address',
    'city',
    'state',
    'zip',
    'Phone',
    'Comments',
    'Credits',
    'code_generated_when',
    'Admin',
    'Creation_date',
    'Last_mod_date',
    'last_failed_login',
    'years_of_service',
    'Benson',
    'Bradley',
    'Grubb',
    'Ludlow',
    'Arrival',
    'Departure',
    'Choice_Number',
    'Spots_ideal',
    'Spots_min',
    'Hut_granted',
    'Spots_granted',
    'Status',
    'Lottery_value',
    'Request_Creation_date',
    'Request_Last_mod_date',
    'hut_count_flexibility',
    'saturday_week_number',
  ];

  res.setHeader('Content-Type', 'text/tab-separated-values; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="requests-joined.tsv"');
  return res.send(toTsv(headers, joined));
});

router.post('/admin/run-assignment', requireAuth, requireAdmin, (req, res) => {
  const requestorsById = new Map(store.listRequestors().map((r) => [r.Requestor_ID, r]));
  runAssignment(store.requests, requestorsById);
  store.markDirty();
  return res.json({ ok: true, message: 'Assignment completed.' });
});

router.get('/admin/efficiency-report', requireAuth, requireAdmin, (req, res) => {
  return res.json({ rows: efficiencyReport(store.listRequests()) });
});

module.exports = {
  apiRouter: router,
  store,
};
