const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const { BLANK_WAIVER_FILE, EMAIL_ERROR_LOG } = require('../config');
const { toTsv, REQUESTORS_HEADERS } = require('../data/tsvStore');
const { SqliteStore, boolFromAny } = require('../data/sqliteStore');
const {
  generateLoginCode,
  isOlderThanMinutes,
  isWithinMinutes,
  normalizeEmail,
  sendLoginCodeEmail,
  toFourDigitCode,
} = require('../services/auth');
const { validateRequestSet, summarizeByChoice } = require('../services/requestLogic');
const { assignLotteryValues, runAssignment, efficiencyReport, requestsJoinedReport } = require('../services/assignment');

const upload = multer();
const WAIVER_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
const WAIVER_UPLOAD_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const REQUESTOR_UPLOAD_MAX_BYTES = 2 * 1024 * 1024;
const requestorUpload = multer({ limits: { fileSize: REQUESTOR_UPLOAD_MAX_BYTES } });
const REQUESTOR_SAMPLE_HEADERS = ['Email', 'first_name', 'last_name', 'address', 'city', 'state', 'zip', 'Phone'];
const router = express.Router();
const store = new SqliteStore();
const AUTH_FAILURE_MESSAGE = 'Login failure, please try again later or contact the hut administrator.';
const DEBUG_LOGIN = process.env.DEBUG_LOGIN === '1';

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
  return boolFromAny(v);
}

function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
}

function requireAdmin(req, res, next) {
  const user = store.getRequestorById(req.session?.userId, { includePrivate: true });
  if (!user || !user.Admin) {
    return res.status(403).json({ error: 'Admin privileges required.' });
  }
  return next();
}

function requestorPayload(requestor, options = {}) {
  const payload = {
    ...requestor,
    requests: store.getRequestsByRequestorId(requestor.Requestor_ID),
    workPartyHistory: store.getProfileWorkPartyHistory(requestor.Requestor_ID),
    applicationMode: store.getApplicationMode(),
  };
  if (options.includePrivate) {
    return payload;
  }
  delete payload.private_comments;
  delete payload.liability_waiver_date;
  delete payload.liability_waiver_file;
  delete payload.liability_waiver_submitted_at;
  return payload;
}

function validateWaiverUpload(file) {
  if (!file) return 'Missing file upload.';
  if (!file.buffer?.length) return 'Uploaded waiver file is empty.';
  if (file.size > WAIVER_UPLOAD_MAX_BYTES) return 'Uploaded waiver file is too large.';
  if (!WAIVER_UPLOAD_MIME_TYPES.has(file.mimetype)) return 'Unsupported waiver file type.';
  return null;
}

const REQUESTOR_UPLOAD_COLUMNS = new Map([
  ['email', { key: 'Email' }],
  ['name', { key: 'Name' }],
  ['first_name', { key: 'first_name' }],
  ['last_name', { key: 'last_name' }],
  ['address', { key: 'address' }],
  ['city', { key: 'city' }],
  ['state', { key: 'state' }],
  ['zip', { key: 'zip' }],
  ['phone', { key: 'Phone' }],
  ['comments', { key: 'Comments' }],
  ['credits', { key: 'Credits', type: 'number' }],
  ['admin', { key: 'Admin', type: 'boolean' }],
  ['login_code', { key: 'login_code', type: 'number' }],
  ['code_generated_when', { key: 'code_generated_when' }],
  ['email_code_sent', { key: 'code_generated_when' }],
  ['last_failed_login', { key: 'last_failed_login' }],
  ['years_of_service', { key: 'years_of_service' }],
  ['years of service', { key: 'years_of_service' }],
  ['has_a_chainsaw', { key: 'has_a_chainsaw', type: 'boolean' }],
  ['chainsaw_user', { key: 'chainsaw_user', type: 'boolean' }],
  ['other_skills', { key: 'other_skills' }],
  ['private_comments', { key: 'private_comments' }],
  ['private comments', { key: 'private_comments' }],
  ['liability_waiver_date', { key: 'liability_waiver_date' }],
]);

function normalizedUploadHeader(value) {
  return String(value || '').replace(/^\uFEFF/, '').trim().toLowerCase();
}

function splitUploadedName(value) {
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
  return { first_name: parts.shift() || '', last_name: parts.join(' ') };
}

function parseRequestorUpload(raw) {
  const lines = String(raw || '').replace(/\r?\n$/, '').split(/\r?\n/);
  if (!lines[0]?.trim()) throw new Error('TSV must include a header row.');
  const headers = lines[0].split('\t').map(normalizedUploadHeader);
  const emailIndex = headers.indexOf('email');
  if (emailIndex < 0) throw new Error('TSV must include Email header.');

  const rows = [];
  let skipped = 0;
  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    if (!line.trim()) {
      skipped += 1;
      continue;
    }
    const cells = line.split('\t').map((value) => value.trim());
    const email = cells[emailIndex] || '';
    if (!email) throw new Error(`TSV row ${lineIndex + 1} must include an email.`);
    const partial = { Email: email };

    for (let columnIndex = 0; columnIndex < headers.length; columnIndex += 1) {
      const descriptor = REQUESTOR_UPLOAD_COLUMNS.get(headers[columnIndex]);
      const value = cells[columnIndex] || '';
      if (!descriptor || !value || descriptor.key === 'Email') continue;
      if (descriptor.type === 'number') {
        const number = Number(value);
        if (!Number.isFinite(number)) {
          throw new Error(`TSV row ${lineIndex + 1} has an invalid number for ${headers[columnIndex]}.`);
        }
        partial[descriptor.key] = number;
      } else if (descriptor.type === 'boolean') {
        partial[descriptor.key] = toBoolean(value);
      } else {
        partial[descriptor.key] = value;
      }
    }

    if (partial.Name) {
      const fallback = splitUploadedName(partial.Name);
      if (!partial.first_name && fallback.first_name) partial.first_name = fallback.first_name;
      if (!partial.last_name && fallback.last_name) partial.last_name = fallback.last_name;
      delete partial.Name;
    }
    rows.push(partial);
  }
  if (!rows.length) throw new Error('TSV file has no data rows.');
  return { rows, skipped };
}

function receiveRequestorUpload(req, res, next) {
  requestorUpload.single('file')(req, res, (err) => {
    if (err?.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'TSV file is too large.' });
    }
    if (err) return res.status(400).json({ error: err.message });
    return next();
  });
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
    store.updateRequestorAuthFields(requestor.Requestor_ID, {
      login_code: code,
      code_generated_when: new Date().toISOString(),
    });
    if (DEBUG_LOGIN) {
      console.info(`sendEmail: login code for ${requestor.Email}: ${code}`);
    }

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
      if (DEBUG_LOGIN) {
        console.info('checkLogin: code expired', {
          email,
          storedCode: Number(requestor.login_code),
          codeGeneratedWhen: requestor.code_generated_when,
        });
      }
      return res.status(401).json({ error: AUTH_FAILURE_MESSAGE });
    }

    const storedCode = Number(requestor.login_code);
    if (DEBUG_LOGIN) {
      console.info('checkLogin: compare codes', {
        email,
        providedCode,
        storedCode,
        providedType: typeof providedCode,
        storedType: typeof storedCode,
        codeGeneratedWhen: requestor.code_generated_when,
        lastFailedLogin: requestor.last_failed_login,
      });
    }

    if (providedCode === null || providedCode !== storedCode) {
      store.updateRequestorAuthFields(requestor.Requestor_ID, {
        last_failed_login: new Date().toISOString(),
      });
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
  const requestor = store.getRequestorById(req.session.userId, { includePrivate: true });
  if (!requestor) {
    return res.status(404).json({ error: 'Requestor not found.' });
  }
  return res.json(requestorPayload(requestor, { includePrivate: Boolean(requestor.Admin) }));
});

router.get('/requestor/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const current = store.getRequestorById(req.session.userId, { includePrivate: true });
  if (!current) {
    return res.status(404).json({ error: 'Session user not found.' });
  }
  if (!current.Admin && id !== current.Requestor_ID) {
    return res.status(403).json({ error: 'Forbidden.' });
  }

  const target = store.getRequestorById(id, { includePrivate: current.Admin });
  if (!target) {
    return res.status(404).json({ error: 'Requestor not found.' });
  }

  return res.json(requestorPayload(target, { includePrivate: current.Admin }));
});

router.put('/requestor/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const current = store.getRequestorById(req.session.userId, { includePrivate: true });
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
    has_a_chainsaw: req.body.has_a_chainsaw,
    chainsaw_user: req.body.chainsaw_user,
    other_skills: req.body.other_skills,
  };

  if (current.Admin) {
    if (req.body.Credits !== undefined) updates.Credits = Number(req.body.Credits);
    if (req.body.Admin !== undefined) updates.Admin = toBoolean(req.body.Admin);
    if (req.body.years_of_service !== undefined) updates.years_of_service = req.body.years_of_service;
    if (req.body.private_comments !== undefined) updates.private_comments = req.body.private_comments;
    if (req.body.liability_waiver_date !== undefined) updates.liability_waiver_date = req.body.liability_waiver_date;
  }

  const updated = store.updateRequestorById(id, updates, {
    allowAdminFields: current.Admin,
    includePrivate: current.Admin,
  });
  if (!updated) {
    return res.status(404).json({ error: 'Requestor not found.' });
  }
  return res.json(requestorPayload(updated));
});

router.put('/requestor/:id/requests', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const current = store.getRequestorById(req.session.userId, { includePrivate: true });
  if (!current) {
    return res.status(404).json({ error: 'Session user not found.' });
  }
  if (!current.Admin && id !== current.Requestor_ID) {
    return res.status(403).json({ error: 'Forbidden.' });
  }

  const requests = Array.isArray(req.body.requests) ? req.body.requests : [];
  const error = validateRequestSet(requests);
  if (error) {
    return res.status(400).json({ error });
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

router.get('/mode', requireAuth, (_req, res) => {
  return res.json({ mode: store.getApplicationMode() });
});

router.put('/mode', requireAuth, requireAdmin, (req, res) => {
  try {
    const mode = store.setApplicationMode(String(req.body?.mode || ''));
    return res.json({ mode });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.get('/work-parties', requireAuth, (req, res) => {
  const year = Number(req.query.year || new Date().getFullYear());
  const requestorId = req.query.requestorId ? Number(req.query.requestorId) : Number(req.session.userId);
  const current = store.getRequestorById(req.session.userId, { includePrivate: true });
  if (!current.Admin && requestorId !== current.Requestor_ID) {
    return res.status(403).json({ error: 'Forbidden.' });
  }
  return res.json({ rows: store.listWorkParties(year, requestorId) });
});

router.put('/work-parties', requireAuth, (req, res) => {
  const requestorId = req.body?.requestorId ? Number(req.body.requestorId) : Number(req.session.userId);
  const current = store.getRequestorById(req.session.userId, { includePrivate: true });
  if (!current.Admin && requestorId !== current.Requestor_ID) {
    return res.status(403).json({ error: 'Forbidden.' });
  }
  const interests = Array.isArray(req.body?.interests) ? req.body.interests : [];
  store.saveWorkPartyInterests(requestorId, interests);
  const year = Number(req.body?.year || new Date().getFullYear());
  return res.json({ ok: true, rows: store.listWorkParties(year, requestorId) });
});

router.get('/admin/work-parties', requireAuth, requireAdmin, (req, res) => {
  const year = Number(req.query.year || new Date().getFullYear());
  return res.json(store.adminWorkPartyManagementPayload(year));
});

router.post('/admin/work-parties', requireAuth, requireAdmin, (req, res) => {
  try {
    const row = store.createWorkParty(req.body || {});
    const year = Number(req.body?.year || new Date().getFullYear());
    return res.json({ ok: true, row, payload: store.adminWorkPartyManagementPayload(year) });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.put('/admin/work-parties/:key', requireAuth, requireAdmin, (req, res) => {
  try {
    const row = store.updateWorkParty({ workPartyKey: req.params.key }, req.body || {});
    if (!row) {
      return res.status(404).json({ error: 'Work party not found.' });
    }
    const year = Number(req.body?.year || new Date().getFullYear());
    return res.json({ ok: true, row, payload: store.adminWorkPartyManagementPayload(year) });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.delete('/admin/work-parties/:key', requireAuth, requireAdmin, (req, res) => {
  try {
    const deleted = store.deleteWorkParty({ workPartyKey: req.params.key });
    if (!deleted) {
      return res.status(404).json({ error: 'Work party not found.' });
    }
    const year = Number(req.query.year || new Date().getFullYear());
    return res.json({ ok: true, payload: store.adminWorkPartyManagementPayload(year) });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.get('/liability-waiver/blank', requireAuth, (_req, res) => {
  if (!fs.existsSync(BLANK_WAIVER_FILE)) {
    return res.status(404).json({ error: 'Blank liability waiver file is not configured.' });
  }
  return res.download(BLANK_WAIVER_FILE, 'blank-liability-waiver.txt');
});

router.post('/liability-waiver', requireAuth, upload.single('file'), (req, res) => {
  const error = validateWaiverUpload(req.file);
  if (error) {
    return res.status(400).json({ error });
  }
  try {
    const updated = store.saveLiabilityWaiverFile(Number(req.session.userId), req.file);
    return res.json({
      ok: true,
      message: 'Your waiver will be reviewed manually over the next few days',
      requestor: requestorPayload(updated, { includePrivate: Boolean(updated.Admin) }),
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.get('/admin/upload-requestors/sample', requireAuth, requireAdmin, (_req, res) => {
  res.type('text/tab-separated-values');
  res.setHeader('Content-Disposition', 'attachment; filename="requestors-sample.tsv"');
  return res.send(`${REQUESTOR_SAMPLE_HEADERS.join('\t')}\n`);
});

router.post('/admin/upload-requestors', requireAuth, requireAdmin, receiveRequestorUpload, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Missing file upload.' });
  }
  try {
    const parsed = parseRequestorUpload(req.file.buffer.toString('utf8'));
    const summary = store.bulkUpsertRequestors(parsed.rows, { skipped: parsed.skipped });
    return res.json({ ok: true, ...summary });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.get('/admin/volunteers', requireAuth, requireAdmin, (req, res) => {
  const filters = {
    year: Number(req.query.year || new Date().getFullYear()),
    workPartyKey: String(req.query.workPartyKey || 'all'),
    acceptedStatus: String(req.query.acceptedStatus || 'all'),
    reservationStatus: String(req.query.reservationStatus || 'all'),
    waiverStatus: String(req.query.waiverStatus || 'all'),
  };
  return res.json(store.volunteerManagementPayload(filters));
});

router.get('/admin/liability-waivers', requireAuth, requireAdmin, (req, res) => {
  const year = Number(req.query.year || new Date().getFullYear());
  return res.json({ year, rows: store.listLiabilityWaiverReviewQueue(year) });
});

router.get('/admin/liability-waivers/:id/download', requireAuth, requireAdmin, (req, res) => {
  try {
    const result = store.getLiabilityWaiverPathForRequestor(Number(req.params.id));
    if (!result) {
      return res.status(404).json({ error: 'Requestor not found.' });
    }
    return res.download(result.path, `liability-waiver-${result.requestor.Requestor_ID}${path.extname(result.path)}`);
  } catch (err) {
    return res.status(404).json({ error: err.message });
  }
});

router.post('/admin/liability-waivers/:id/approve', requireAuth, requireAdmin, (req, res) => {
  try {
    const date = req.body?.date || new Date().toISOString().slice(0, 10);
    const updated = store.approveLiabilityWaiver(Number(req.params.id), date);
    if (!updated) {
      return res.status(404).json({ error: 'Requestor not found.' });
    }
    return res.json({ ok: true, requestor: updated });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.put('/admin/volunteers/:id/private-comments', requireAuth, requireAdmin, (req, res) => {
  const updated = store.updatePrivateComments(Number(req.params.id), String(req.body?.private_comments || ''));
  if (!updated) {
    return res.status(404).json({ error: 'Requestor not found.' });
  }
  return res.json({ ok: true, requestor: updated });
});

router.post('/admin/volunteers/:id/approve-waiver', requireAuth, requireAdmin, (req, res) => {
  try {
    const date = req.body?.date || new Date().toISOString().slice(0, 10);
    const updated = store.approveLiabilityWaiver(Number(req.params.id), date);
    if (!updated) {
      return res.status(404).json({ error: 'Requestor not found.' });
    }
    return res.json({ ok: true, requestor: updated });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.put('/admin/volunteers/:id/work-party-accepted-status', requireAuth, requireAdmin, (req, res) => {
  try {
    const updated = store.updateWorkPartyAcceptedStatus(Number(req.params.id), {
      workPartyKey: req.body?.workPartyKey,
      friday_check_in: req.body?.Friday_check_in || req.body?.friday_check_in,
      hut: req.body?.Hut || req.body?.hut,
    }, req.body?.status);
    return res.json({ ok: true, workPartyRequest: updated });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.put('/admin/volunteers/:id/work-party-attendance-status', requireAuth, requireAdmin, (req, res) => {
  try {
    const updated = store.updateWorkPartyAttendanceStatus(Number(req.params.id), {
      workPartyKey: req.body?.workPartyKey,
      friday_check_in: req.body?.Friday_check_in || req.body?.friday_check_in,
      hut: req.body?.Hut || req.body?.hut,
    }, req.body?.status);
    return res.json({ ok: true, workPartyRequest: updated });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.get('/admin/download/requestors', requireAuth, requireAdmin, (req, res) => {
  const filter = String(req.query.filter || 'all');
  const requestors = store.listRequestors({ includePrivate: true });
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

  const headers = [
    ...REQUESTORS_HEADERS,
    'Lottery_value',
    'has_a_chainsaw',
    'chainsaw_user',
    'other_skills',
    'private_comments',
    'liability_waiver_date',
    'Requests_Assigned',
  ];
  res.setHeader('Content-Type', 'text/tab-separated-values; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="requestors.tsv"');
  return res.send(toTsv(headers, withRequests));
});

router.get('/admin/download/requests-joined', requireAuth, requireAdmin, (req, res) => {
  const requestorsById = new Map(store.listRequestors({ includePrivate: true }).map((r) => [r.Requestor_ID, r]));
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
    'has_a_chainsaw',
    'chainsaw_user',
    'other_skills',
    'private_comments',
    'liability_waiver_date',
    'Request_ID',
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
    'Combination_first_request',
  ];

  res.setHeader('Content-Type', 'text/tab-separated-values; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="requests-joined.tsv"');
  return res.send(toTsv(headers, joined));
});

router.post('/admin/run-assignment', requireAuth, requireAdmin, (req, res) => {
  const requestorsById = new Map(store.listRequestors({ includePrivate: true }).map((r) => [r.Requestor_ID, r]));
  const seed = req.body?.seed;
  const regenerateLotteryNumbers = req.body?.regenerateLotteryNumbers !== false;
  const requests = store.listRequests();
  const result = runAssignment(requests, requestorsById, { seed, regenerateLotteryNumbers });
  store.saveRequests(requests);
  if (result?.requestorsToPersist?.length) {
    store.saveRequestorLotteryValues(result.requestorsToPersist);
  }
  return res.json({ ok: true, message: 'Assignment completed.' });
});

router.post('/admin/regenerate-lottery', requireAuth, requireAdmin, (req, res) => {
  const requestorsById = new Map(store.listRequestors({ includePrivate: true }).map((r) => [r.Requestor_ID, r]));
  const changedRequestors = assignLotteryValues(requestorsById, { seed: req.body?.seed, regenerate: true });
  store.saveRequestorLotteryValues(changedRequestors);
  return res.json({ ok: true, message: 'Lottery numbers regenerated.' });
});

router.get('/admin/efficiency-report', requireAuth, requireAdmin, (req, res) => {
  return res.json({ rows: efficiencyReport(store.listRequests()) });
});

module.exports = {
  apiRouter: router,
  store,
};
