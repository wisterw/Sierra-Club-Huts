const { HUTS } = require('../config');
const { closestSaturdayWeekKey } = require('./dates');
const STATUS_GRANTED = new Set(['granted', 'confirmed']);

function stringToSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h >>> 0);
}

function mulberry32(a) {
  return () => {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createRng(seed) {
  if (seed === undefined || seed === null || seed === '') {
    return Math.random;
  }
  const normalized = typeof seed === 'number' ? String(seed) : String(seed);
  return mulberry32(stringToSeed(normalized));
}

function coerceLotteryValue(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function assignLotteryValues(requestorsById, options = {}) {
  const rng = createRng(options.seed);
  const regenerate = options.regenerate !== false;
  const changed = [];

  for (const requestor of requestorsById.values()) {
    if (requestor.Is_placeholder) { requestor.Lottery_value = 0; requestor.lottery_value = 0; continue; }
    const current = coerceLotteryValue(requestor.Lottery_value ?? requestor.lottery_value);
    if (regenerate || current === null) {
      const next = rng();
      requestor.Lottery_value = next;
      requestor.lottery_value = next;
      changed.push(requestor);
    } else {
      requestor.Lottery_value = current;
      requestor.lottery_value = current;
    }
  }

  return changed;
}

function isGranted(req) {
  return STATUS_GRANTED.has(req.Status);
}

const { runAssignment } = require('./optimizedAssignment');

function efficiencyReport(requests) {
  const byRequestor = new Map();
  for (const req of requests) {
    if (!byRequestor.has(req.Requestor_ID)) {
      byRequestor.set(req.Requestor_ID, []);
    }
    byRequestor.get(req.Requestor_ID).push(req);
  }

  const groups = byRequestor.size || 1;
  const totalSpots = requests.reduce((sum, r) => sum + Number(r.Spots_ideal || 0), 0) || 1;

  const byChoice = new Map();
  const grantedGroups = new Set();
  const requestorIdealSpots = new Map();
  for (const req of requests) {
    const id = Number(req.Requestor_ID);
    requestorIdealSpots.set(id, (requestorIdealSpots.get(id) || 0) + Number(req.Spots_ideal || 0));
  }
  for (const req of requests) {
    if (!isGranted(req)) continue;
    const c = Number(req.Choice_Number);
    if (!byChoice.has(c)) byChoice.set(c, { groups: new Set(), spots: 0 });
    byChoice.get(c).groups.add(req.Requestor_ID);
    grantedGroups.add(Number(req.Requestor_ID));
    byChoice.get(c).spots += Number(req.Spots_granted || 0);
  }

  const rows = [...byChoice.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([choice, v]) => ({
      choice,
      outcome: choice === 1 ? 'first choice' : choice === 2 ? 'second choice' : 'later choice',
      groupsPercent: Number(((v.groups.size / groups) * 100).toFixed(2)),
      spotsPercent: Number(((v.spots / totalSpots) * 100).toFixed(2)),
    }));

  const noChoiceGroups = [...byRequestor.keys()].filter((id) => !grantedGroups.has(Number(id)));
  const noChoiceSpots = noChoiceGroups.reduce((sum, id) => sum + Number(requestorIdealSpots.get(Number(id)) || 0), 0);
  rows.push({
    choice: 'none',
    outcome: 'no choice',
    groupsPercent: Number(((noChoiceGroups.length / groups) * 100).toFixed(2)),
    spotsPercent: Number(((noChoiceSpots / totalSpots) * 100).toFixed(2)),
  });

  return rows;
}

function requestsJoinedReport(requests, requestorsById, options = {}) {
  const filter = options.filter || 'all';
  const byRequestor = new Map();
  for (const req of requests) {
    const id = Number(req.Requestor_ID);
    if (!byRequestor.has(id)) byRequestor.set(id, []);
    byRequestor.get(id).push(req);
  }

  const out = [];
  for (const requestor of requestorsById.values()) {
    const reqs = byRequestor.get(Number(requestor.Requestor_ID)) || [];
    const hasRequests = reqs.length > 0;
    if (filter === 'none' && hasRequests) {
      continue;
    }

    if (!reqs.length) {
      out.push({
        Is_placeholder: !!requestor.Is_placeholder,
        Reservation_reference: requestor.Reservation_reference || '',
        Requestor_ID: requestor.Requestor_ID,
        Email: requestor.Email || '',
        first_name: requestor.first_name || '',
        last_name: requestor.last_name || '',
        address: requestor.address || '',
        city: requestor.city || '',
        state: requestor.state || '',
        zip: requestor.zip || '',
        Phone: requestor.Phone || '',
        Comments: requestor.Comments || '',
        Credits: Number(requestor.Credits || 0),
        code_generated_when: requestor.code_generated_when || '',
        Admin: requestor.Admin ? 'TRUE' : 'FALSE',
        Creation_date: requestor.Creation_date || '',
        Last_mod_date: requestor.Last_mod_date || '',
        last_failed_login: requestor.last_failed_login || '',
        years_of_service: requestor.years_of_service || '',
        has_a_chainsaw: requestor.has_a_chainsaw ? 'TRUE' : 'FALSE',
        chainsaw_user: requestor.chainsaw_user ? 'TRUE' : 'FALSE',
        other_skills: requestor.other_skills || '',
        private_comments: requestor.private_comments || '',
        liability_waiver_date: requestor.liability_waiver_date || '',
        Request_ID: '',
        Benson: '',
        Bradley: '',
        Grubb: '',
        Ludlow: '',
        Arrival: '',
        Departure: '',
        Choice_Number: '',
        Spots_ideal: '',
        Spots_min: '',
        Hut_granted: '',
        Spots_granted: '',
        Status: '',
        Lottery_value: '',
        Request_Creation_date: '',
        Request_Last_mod_date: '',
        contention_status: '',
        contention_status_changed_at: '',
        contention_email_sent_at: '',
        hut_count_flexibility: '',
        saturday_week_number: '',
        Combination_first_request: '',
      });
      continue;
    }

    const filteredReqs = filter === 'granted'
      ? reqs.filter((r) => r.Status === 'granted')
      : reqs;

    if (filter === 'granted' && !filteredReqs.length) {
      continue;
    }

    for (const req of filteredReqs) {
      const hutsCount = HUTS.filter((h) => req[h]).length;
      out.push({
        Is_placeholder: !!requestor.Is_placeholder,
        Reservation_reference: requestor.Reservation_reference || '',
        Requestor_ID: requestor.Requestor_ID,
        Email: requestor.Email || '',
        first_name: requestor.first_name || '',
        last_name: requestor.last_name || '',
        address: requestor.address || '',
        city: requestor.city || '',
        state: requestor.state || '',
        zip: requestor.zip || '',
        Phone: requestor.Phone || '',
        Comments: requestor.Comments || '',
        Credits: Number(requestor.Credits || 0),
        code_generated_when: requestor.code_generated_when || '',
        Admin: requestor.Admin ? 'TRUE' : 'FALSE',
        Creation_date: requestor.Creation_date || '',
        Last_mod_date: requestor.Last_mod_date || '',
        last_failed_login: requestor.last_failed_login || '',
        years_of_service: requestor.years_of_service || '',
        has_a_chainsaw: requestor.has_a_chainsaw ? 'TRUE' : 'FALSE',
        chainsaw_user: requestor.chainsaw_user ? 'TRUE' : 'FALSE',
        other_skills: requestor.other_skills || '',
        private_comments: requestor.private_comments || '',
        liability_waiver_date: requestor.liability_waiver_date || '',
        Request_ID: Number(req.Request_ID || 0),
        Benson: req.Benson ? 'TRUE' : 'FALSE',
        Bradley: req.Bradley ? 'TRUE' : 'FALSE',
        Grubb: req.Grubb ? 'TRUE' : 'FALSE',
        Ludlow: req.Ludlow ? 'TRUE' : 'FALSE',
        Arrival: req.Arrival || '',
        Departure: req.Departure || '',
        Choice_Number: Number(req.Choice_Number || 0),
        Spots_ideal: Number(req.Spots_ideal || 0),
        Spots_min: Number(req.Spots_min || 0),
        Hut_granted: req.Hut_granted || '',
        Spots_granted: Number(req.Spots_granted || 0),
        Status: req.Status || '',
        Lottery_value: Number(req.Lottery_value || 0),
        Request_Creation_date: req.Creation_date || '',
        Request_Last_mod_date: req.Last_mod_date || '',
        contention_status: req.contention_status ?? '',
        contention_status_changed_at: req.contention_status_changed_at ?? '',
        contention_email_sent_at: req.contention_email_sent_at ?? '',
        hut_count_flexibility: Number(req.hut_count_flexibility || hutsCount || 0),
        saturday_week_number: req.saturday_week_number || closestSaturdayWeekKey(req.Arrival, req.Departure),
        Combination_first_request: req.Combination_first_request || '',
      });
    }
  }

  out.sort((a, b) => {
    const weekA = String(a.saturday_week_number || '').padStart(4, '0');
    const weekB = String(b.saturday_week_number || '').padStart(4, '0');
    if (weekA !== weekB) return weekA.localeCompare(weekB);
    if (Number(a.Credits || 0) !== Number(b.Credits || 0)) return Number(b.Credits || 0) - Number(a.Credits || 0);
    if (Number(a.Choice_Number || 0) !== Number(b.Choice_Number || 0)) return Number(a.Choice_Number || 0) - Number(b.Choice_Number || 0);
    if (Number(a.hut_count_flexibility || 0) !== Number(b.hut_count_flexibility || 0)) return Number(a.hut_count_flexibility || 0) - Number(b.hut_count_flexibility || 0);
    if (Number(a.Lottery_value || 0) !== Number(b.Lottery_value || 0)) return Number(a.Lottery_value || 0) - Number(b.Lottery_value || 0);
    return Number(a.Requestor_ID || 0) - Number(b.Requestor_ID || 0);
  });

  return out;
}

module.exports = {
  runAssignment,
  assignLotteryValues,
  efficiencyReport,
  requestsJoinedReport,
};
