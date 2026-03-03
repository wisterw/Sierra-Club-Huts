const express = require('express');
const multer = require('multer');
const { TsvStore, toTsv, REQUESTORS_HEADERS } = require('../data/tsvStore');
const { normalizeEmail, hashEmail } = require('../services/auth');
const { validateRequest, summarizeByChoice } = require('../services/requestLogic');
const { runAssignment, efficiencyReport, requestsJoinedReport } = require('../services/assignment');

const upload = multer();
const router = express.Router();
const store = new TsvStore();

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

router.post('/check-login', (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const providedHash = Number(req.body.hash);
    const requestor = store.getRequestorByEmail(email);

    if (!requestor) {
      return res.status(404).json({ error: 'Requestor not found.' });
    }

    const expected = hashEmail(email);
    if (providedHash !== expected) {
      return res.status(401).json({ error: 'Invalid login code.' });
    }

    req.session.userId = requestor.Requestor_ID;
    req.session.save(() => {
      res.json({ userId: requestor.Requestor_ID, isAdmin: requestor.Admin });
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/logout', requireAuth, (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
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
    Name: req.body.Name,
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
  const summary = summarizeByChoice(store.listRequests(), choiceNumber, excludeRequestorId);
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
  const iEmail = idx('Email');
  if (iEmail < 0) {
    return res.status(400).json({ error: 'TSV must include Email header.' });
  }

  let createdOrUpdated = 0;
  for (const line of lines.slice(1)) {
    const cells = line.split('\t');
    const email = cells[iEmail];
    if (!email) continue;

    store.upsertRequestor({
      Email: email,
      Name: cells[idx('Name')] || '',
      Phone: cells[idx('Phone')] || '',
      Comments: cells[idx('Comments')] || '',
      Credits: Number(cells[idx('Credits')] || 0),
      Admin: toBoolean(cells[idx('Admin')]),
      Email_code_sent: cells[idx('Email_code_sent')] || '',
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
      return mine.every((x) => x.Status !== 'pending');
    }
    if (filter === 'no-likely-requests') {
      return mine.every((x) => x.Status !== 'pending' && x.Status !== 'confirmed');
    }
    if (filter === 'no-assigned-requests') {
      return mine.every((x) => x.Status !== 'confirmed');
    }
    return true;
  });

  const withRequests = rows.map((r) => ({
    ...r,
    Requests_Assigned: requests.some((x) => x.Requestor_ID === r.Requestor_ID && x.Status === 'confirmed') ? 'TRUE' : 'FALSE',
  }));

  const headers = [...REQUESTORS_HEADERS, 'Requests_Assigned'];
  res.setHeader('Content-Type', 'text/tab-separated-values; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="requestors.tsv"');
  return res.send(toTsv(headers, withRequests));
});

router.get('/admin/download/requests-joined', requireAuth, requireAdmin, (req, res) => {
  const requestorsById = new Map(store.listRequestors().map((r) => [r.Requestor_ID, r]));
  const joined = requestsJoinedReport(store.listRequests(), requestorsById);
  const headers = [
    'Requestor_ID', 'Email', 'Name', 'Credits', 'Choice_Number', 'Week_Key', 'Nights', 'Spots_ideal',
    'Huts_Marked', 'Benson', 'Bradley', 'Grubb', 'Ludlow', 'Arrival', 'Departure', 'Status', 'Hut_granted',
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

router.get('/admin/requestors', requireAuth, requireAdmin, (req, res) => {
  const rows = store.listRequestors().map((r) => ({
    ...r,
    Login_Code: (() => {
      try {
        return hashEmail(r.Email);
      } catch {
        return '';
      }
    })(),
  }));
  return res.json({ rows });
});

module.exports = {
  apiRouter: router,
  store,
};
