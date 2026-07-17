const HUTS = ['Benson', 'Bradley', 'Grubb', 'Ludlow'];
const COMBO_MODES = ['Benson->Bradley', 'Bradley->Benson'];
const ALL_HUT_MODES = [...HUTS, ...COMBO_MODES];
const HUT_CAPACITY = {
  Benson: 12,
  Bradley: 15,
  Grubb: 15,
  Ludlow: 15,
};

const state = {
  me: null,
  mode: 'inactive',
  adminSection: 'application-settings',
  profileTarget: null,
  volunteerRows: [],
  volunteerMessage: '',
  volunteerFilterOptions: {
    workParties: [],
    acceptedStatuses: ['', 'pending', 'accepted', 'waitlisted'],
    attendanceStatuses: ['', 'full attended', 'partial attended', 'no show', 'cancelled'],
    reservationStatuses: ['all', 'none-submitted', 'submitted', 'none-granted', 'granted'],
    waiverStatuses: ['all', 'approved', 'not-approved'],
  },
  volunteerFilters: {
    acceptedStatus: 'all',
    workPartyKey: 'all',
    reservationStatus: 'all',
    waiverStatus: 'all',
  },
  waiverReviewRows: [],
  waiverReviewYear: new Date().getFullYear(),
  adminWorkPartyRows: [],
  adminWorkPartyLeaderOptions: [],
  adminWorkPartyYear: new Date().getFullYear(),
  editingWorkPartyKey: null,
  choices: [],
  workParties: [],
  selectedChoiceIndex: 0,
  summaryRows: [],
};

const ADMIN_SECTIONS = [
  { id: 'application-settings', label: 'Application settings' },
  { id: 'manage-volunteers', label: 'Manage volunteers/requestors' },
  { id: 'review-waivers', label: 'Review liability waivers' },
  { id: 'download-requests', label: 'Download requests' },
  { id: 'efficiency-report', label: 'Efficiency report' },
  { id: 'setup-work-parties', label: 'Set up work parties' },
];

const el = {
  loginCard: document.getElementById('login-card'),
  loginForm: document.getElementById('login-form'),
  loginEmail: document.getElementById('login-email'),
  sendLoginCode: document.getElementById('send-login-code'),
  loginCode: document.getElementById('login-code'),
  loginError: document.getElementById('login-error'),
  mainApp: document.getElementById('main-app'),
  sessionInfo: document.getElementById('session-info'),
  tabWorkParty: document.getElementById('tab-work-party'),
  tabProfile: document.getElementById('tab-profile'),
  tabRequests: document.getElementById('tab-trip-request'),
  tabAdmin: document.getElementById('tab-admin'),
  adminTabBtn: document.getElementById('admin-tab-btn'),
  workPartyTabBtn: document.getElementById('work-party-tab-btn'),
  tripTabBtn: document.querySelector('.tabs button[data-tab="trip-request"]'),
  requestCardTpl: document.getElementById('request-card-template'),
};

async function api(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const res = await fetch(`/api${path}`, {
    method: options.method || 'GET',
    headers: isFormData
      ? { ...(options.headers || {}) }
      : {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
    body: options.body ? (isFormData ? options.body : JSON.stringify(options.body)) : undefined,
  });

  const isTsv = (res.headers.get('content-type') || '').includes('tab-separated-values');
  const data = isTsv ? await res.text() : await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `${res.status} ${res.statusText}`);
  }
  return data;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function profileHelpControl(id, label, text) {
  return `
    <span class="contextual-help">
      <button type="button" class="info-icon info-trigger" aria-label="Help for ${escapeHtml(label)}" aria-describedby="${id}" aria-controls="${id}" aria-expanded="false">i</button>
      <span class="info-tooltip" id="${id}" role="tooltip" hidden>${escapeHtml(text)}</span>
    </span>
  `;
}

function setContextualHelpOpen(trigger, open, pinned = false) {
  const tooltip = document.getElementById(trigger.getAttribute('aria-controls'));
  if (!tooltip) return;
  trigger.setAttribute('aria-expanded', String(open));
  trigger.dataset.pinned = pinned ? 'true' : 'false';
  tooltip.hidden = !open;
}

function closeUnpinnedContextualHelp(trigger) {
  if (trigger.dataset.pinned === 'true' || document.activeElement === trigger || trigger.matches(':hover')) return;
  setContextualHelpOpen(trigger, false);
}

function wireContextualHelp() {
  document.addEventListener('pointerover', (event) => {
    const trigger = event.target.closest('.info-trigger');
    if (trigger) setContextualHelpOpen(trigger, true, trigger.dataset.pinned === 'true');
  });

  document.addEventListener('pointerout', (event) => {
    const trigger = event.target.closest('.info-trigger');
    if (trigger && !trigger.closest('.contextual-help').contains(event.relatedTarget)) {
      closeUnpinnedContextualHelp(trigger);
    }
  });

  document.addEventListener('focusin', (event) => {
    const trigger = event.target.closest('.info-trigger');
    if (trigger) setContextualHelpOpen(trigger, true, trigger.dataset.pinned === 'true');
  });

  document.addEventListener('focusout', (event) => {
    const trigger = event.target.closest('.info-trigger');
    if (trigger) setTimeout(() => closeUnpinnedContextualHelp(trigger), 0);
  });

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('.info-trigger');
    document.querySelectorAll('.info-trigger[data-pinned="true"]').forEach((other) => {
      if (other !== trigger) setContextualHelpOpen(other, false);
    });
    if (!trigger) return;
    event.preventDefault();
    event.stopPropagation();
    const pinned = trigger.dataset.pinned !== 'true';
    setContextualHelpOpen(trigger, pinned, pinned);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const trigger = event.target.closest('.info-trigger');
    if (!trigger) return;
    setContextualHelpOpen(trigger, false);
    trigger.focus();
  });
}

function currentSeasonDates() {
  const year = new Date().getFullYear();
  const start = new Date(Date.UTC(year, 11, 15));
  const end = new Date(Date.UTC(year + 1, 3, 30));
  const rows = [];
  const cur = new Date(start);
  while (cur <= end) {
    rows.push(new Date(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return rows;
}

function dateIso(d) {
  return d.toISOString().slice(0, 10);
}

function winterSeasonBounds(date) {
  const month = date.getUTCMonth();
  const startYear = month >= 11 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
  return {
    start: new Date(Date.UTC(startYear, 11, 15)),
    end: new Date(Date.UTC(startYear + 1, 3, 30, 23, 59, 59, 999)),
  };
}

function defaultChoice() {
  return {
    hutModes: ['Benson'],
    arrival: '',
    departure: '',
    traverseDate: '',
    requestIds: [],
    choiceNumber: state.choices.length + 1,
    spotsIdeal: 1,
    spotsMin: 1,
    status: 'requested',
  };
}

function normalizeChoice(choice, idx) {
  const modes = Array.isArray(choice.hutModes)
    ? choice.hutModes.filter((m) => ALL_HUT_MODES.includes(m))
    : [];

  return {
    hutModes: modes.length ? modes : ['Benson'],
    arrival: choice.arrival || '',
    departure: choice.departure || '',
    traverseDate: choice.traverseDate || '',
    requestIds: Array.isArray(choice.requestIds) ? choice.requestIds : [],
    choiceNumber: Number(choice.choiceNumber || idx + 1),
    spotsIdeal: Number(choice.spotsIdeal || 1),
    spotsMin: Number(choice.spotsMin || choice.spotsIdeal || 1),
    status: choice.status || 'requested',
  };
}

function mapRequestsToChoices(rawRequests) {
  if (!rawRequests.length) return [defaultChoice()];
  const byChoice = new Map();
  for (const req of rawRequests) {
    const key = Number(req.Choice_Number || 0);
    if (!byChoice.has(key)) byChoice.set(key, []);
    byChoice.get(key).push(req);
  }

  const out = [];
  const sortedChoiceNums = [...byChoice.keys()].sort((a, b) => a - b);
  for (const [idx, choiceNumber] of sortedChoiceNums.entries()) {
    const rows = byChoice.get(choiceNumber).slice().sort((a, b) => a.Arrival.localeCompare(b.Arrival));
    const base = rows[0] || {};
    const used = new Set();
    const comboModes = [];
    let comboArrival = '';
    let comboDeparture = '';
    let comboTraverse = '';

    const isSingleHutRow = (r) => HUTS.filter((h) => Boolean(r[h])).length === 1;
    for (let i = 0; i < rows.length; i += 1) {
      if (used.has(i) || !isSingleHutRow(rows[i])) continue;
      for (let j = 0; j < rows.length; j += 1) {
        if (i === j || used.has(j) || !isSingleHutRow(rows[j])) continue;
        const a = rows[i];
        const b = rows[j];
        const isForward = a.Benson && b.Bradley;
        const isReverse = a.Bradley && b.Benson;
        if (!isForward && !isReverse) continue;
        if (a.Departure !== b.Arrival) continue;
        if (a.Arrival !== base.Arrival || b.Departure !== base.Departure) continue;

        comboModes.push(isForward ? 'Benson->Bradley' : 'Bradley->Benson');
        comboArrival = a.Arrival;
        comboDeparture = b.Departure;
        comboTraverse = a.Departure;
        used.add(i);
        used.add(j);
        break;
      }
    }

    const simpleHuts = new Set();
    for (let i = 0; i < rows.length; i += 1) {
      if (used.has(i)) continue;
      for (const hut of HUTS) {
        if (rows[i][hut]) {
          simpleHuts.add(hut);
        }
      }
    }
    const hutModes = [...simpleHuts, ...comboModes];
    out.push(
      normalizeChoice(
        {
          hutModes: hutModes.length ? hutModes : ['Benson'],
          arrival: comboArrival || base.Arrival,
          departure: comboDeparture || base.Departure,
          traverseDate: comboTraverse || '',
          requestIds: rows.map((r) => r.Request_ID).filter(Boolean),
          choiceNumber,
          spotsIdeal: base.Spots_ideal,
          spotsMin: base.Spots_min,
          status: base.Status,
        },
        idx
      )
    );
  }

  return out;
}

function expandChoice(choice) {
  const selectedModes = Array.isArray(choice.hutModes) ? choice.hutModes : [];
  const comboModes = selectedModes.filter((m) => COMBO_MODES.includes(m));
  const simpleHuts = selectedModes.filter((m) => HUTS.includes(m));

  if (!selectedModes.length) {
    throw new Error('At least one hut option is required.');
  }

  const shared = {
    Choice_Number: Number(choice.choiceNumber),
    Spots_ideal: Number(choice.spotsIdeal),
    Spots_min: Number(choice.spotsMin || choice.spotsIdeal),
    Status: choice.status || 'requested',
    Hut_granted: '',
    Spots_granted: 0,
    Confirmed_How: '',
  };

  const out = [];
  if (comboModes.length > 0) {
    if (!choice.traverseDate) {
      throw new Error('Traverse date is required for combination huts.');
    }
    for (const comboMode of comboModes) {
      const [first, second] = comboMode.split('->');
      const [firstId, secondId] = Array.isArray(choice.requestIds) ? choice.requestIds : [];
      out.push(
        {
          ...shared,
          Request_ID: firstId || undefined,
          Client_combo_group: `${choice.choiceNumber}:${comboMode}`,
          Benson: first === 'Benson',
          Bradley: first === 'Bradley',
          Grubb: false,
          Ludlow: false,
          Arrival: choice.arrival,
          Departure: choice.traverseDate,
        },
        {
          ...shared,
          Request_ID: secondId || undefined,
          Client_combo_group: `${choice.choiceNumber}:${comboMode}`,
          Benson: second === 'Benson',
          Bradley: second === 'Bradley',
          Grubb: false,
          Ludlow: false,
          Arrival: choice.traverseDate,
          Departure: choice.departure,
        }
      );
    }
  }

  if (simpleHuts.length > 0) {
    const [onlyId] = Array.isArray(choice.requestIds) ? choice.requestIds : [];
    out.push({
      ...shared,
      Request_ID: onlyId || undefined,
      Benson: simpleHuts.includes('Benson'),
      Bradley: simpleHuts.includes('Bradley'),
      Grubb: simpleHuts.includes('Grubb'),
      Ludlow: simpleHuts.includes('Ludlow'),
      Arrival: choice.arrival,
      Departure: choice.departure,
    });
  }

  return out;
}

function normalizeChoicesForSave() {
  const normalized = state.choices.map((choice, idx) => normalizeChoice(choice, idx));
  return normalized.map((choice, idx) => ({
    ...choice,
    choiceNumber: idx + 1,
  }));
}

function validateChoiceForSave(choice) {
  if (!choice.arrival || !choice.departure) {
    throw new Error('Arrival and departure are required and departure must be after arrival.');
  }
  const arrival = new Date(choice.arrival);
  const departure = new Date(choice.departure);
  if (Number.isNaN(arrival.getTime()) || Number.isNaN(departure.getTime()) || departure <= arrival) {
    throw new Error('Arrival and departure are required and departure must be after arrival.');
  }

  const maxTripMs = 1000 * 60 * 60 * 24 * 5;
  if (departure.getTime() - arrival.getTime() > maxTripMs) {
    throw new Error('Trip length must be 5 days or fewer.');
  }

  const season = winterSeasonBounds(arrival);
  if (arrival < season.start || departure > season.end) {
    throw new Error('Arrival and departure must be between Dec 15 and Apr 30 of the current season.');
  }

  if (Number(choice.spotsMin || choice.spotsIdeal) > Number(choice.spotsIdeal)) {
    throw new Error('Minimum spots must be between 1 and ideal spots.');
  }

  const comboSelected = (choice.hutModes || []).some((m) => COMBO_MODES.includes(m));
  if (comboSelected) {
    if (!choice.traverseDate) {
      throw new Error('Traverse date is required for combination huts.');
    }
    const traverse = new Date(choice.traverseDate);
    if (Number.isNaN(traverse.getTime()) || traverse <= arrival || traverse >= departure) {
      throw new Error('Traverse date must be after arrival and before departure.');
    }
  }
}

function serializeChoices(choices = state.choices) {
  return choices
    .map((choice) => {
      validateChoiceForSave(choice);
      return expandChoice(choice);
    })
    .flat();
}

function setTab(tabName) {
  for (const btn of document.querySelectorAll('.tabs button')) {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  }
  el.tabWorkParty.classList.toggle('hidden', tabName !== 'work-party');
  el.tabProfile.classList.toggle('hidden', tabName !== 'profile');
  el.tabRequests.classList.toggle('hidden', tabName !== 'trip-request');
  el.tabAdmin.classList.toggle('hidden', tabName !== 'admin');
}

function wireTabs() {
  for (const btn of document.querySelectorAll('.tabs button')) {
    btn.addEventListener('click', () => setTab(btn.dataset.tab));
  }
}

function applyModeUi() {
  const tripDisabled = state.mode === 'work-party' || state.mode === 'inactive';
  const workDisabled = state.mode === 'trip-request' || state.mode === 'inactive';
  el.workPartyTabBtn.disabled = workDisabled;
  el.workPartyTabBtn.title = workDisabled
    ? 'Work party selection has not opened or is already completed'
    : '';
  if (el.tripTabBtn) {
    el.tripTabBtn.disabled = tripDisabled;
    el.tripTabBtn.title = tripDisabled
      ? 'Ski hut trip request has not opened or is already completed'
      : '';
  }
  if (state.mode === 'work-party') {
    setTab('work-party');
  } else if (state.mode === 'trip-request') {
    setTab('trip-request');
  } else {
    setTab('profile');
  }
}

function renderSession() {
  if (!state.me) return;
  const displayName = [state.me.first_name, state.me.last_name].filter(Boolean).join(' ').trim();
  el.sessionInfo.innerHTML = `<div><strong>${displayName || state.me.Email}</strong><br/><small>${state.me.Email}</small></div><button id="logout-btn">Logout</button>`;
  document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
      await api('/logout', { method: 'POST' });
    } catch {
      // Ignore logout failures; client should still return to signed-out state.
    } finally {
      state.me = null;
      location.href = '/';
    }
  });
}

function renderProfileWorkPartyHistory(rows = []) {
  if (!rows.length) {
    return '<p class="profile-history-empty">No past or pending work parties.</p>';
  }
  return `
    <div class="profile-history-table-wrap">
      <table class="profile-history-table">
        <thead><tr><th scope="col">Work party</th><th scope="col">Interest</th><th scope="col">Accepted</th><th scope="col">Attendance</th><th scope="col">Leader</th></tr></thead>
        <tbody>${rows.map((row) => `
          <tr>
            <td><strong>${escapeHtml(row.Hut || '')}</strong><br/><span>${escapeHtml(row.Friday_check_in || '')}${row.Sunday_check_out ? ` to ${escapeHtml(row.Sunday_check_out)}` : ''}</span></td>
            <td>${escapeHtml(row.Interest || '—')}</td>
            <td>${escapeHtml(row.Accepted_status || 'pending')}</td>
            <td>${escapeHtml(row.Attendance_status || '—')}</td>
            <td>${escapeHtml(row.Leader || '—')}</td>
          </tr>`).join('')}</tbody>
      </table>
    </div>`;
}

function renderProfileTripRequests(requests = []) {
  if (!requests.length) {
    return '<p class="profile-history-empty">No current ski trip reservation requests.</p>';
  }
  const ordered = [...requests].sort((a, b) => Number(a.Choice_Number) - Number(b.Choice_Number));
  return `
    <div class="profile-history-table-wrap">
      <table class="profile-history-table profile-trip-request-table">
        <thead><tr><th scope="col">Choice</th><th scope="col">Hut(s)</th><th scope="col">Dates</th><th scope="col">Spots (min / ideal)</th><th scope="col">Status</th></tr></thead>
        <tbody>${ordered.map((request) => {
          const huts = HUTS.filter((hut) => request[hut]).join(', ');
          return `
          <tr>
            <td>${escapeHtml(request.Choice_Number || '')}</td>
            <td>${escapeHtml(huts || '—')}</td>
            <td>${escapeHtml(request.Arrival || '—')} to ${escapeHtml(request.Departure || '—')}</td>
            <td>${escapeHtml(request.Spots_min ?? '—')} / ${escapeHtml(request.Spots_ideal ?? '—')}</td>
            <td>${escapeHtml(request.Status || 'requested')}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>`;
}

function renderProfile() {
  if (!state.me) return;
  const isAdmin = Boolean(state.me.Admin);
  const profile = state.profileTarget || state.me;
  const editingOther = Boolean(state.profileTarget && state.profileTarget.Requestor_ID !== state.me.Requestor_ID);
  el.tabProfile.innerHTML = `
    <h2>Profile${editingOther ? ` - ${escapeHtml(profile.first_name || profile.Email)}` : ''}</h2>
    ${editingOther ? '<button type="button" id="return-own-profile">Return to my profile</button>' : ''}
    <form id="profile-form">
      <label>Email<input disabled value="${escapeHtml(profile.Email)}" /></label>
      <label>First name<input name="first_name" value="${escapeHtml(profile.first_name || '')}" /></label>
      <label>Last name<input name="last_name" value="${escapeHtml(profile.last_name || '')}" /></label>
      <label>Address<input name="address" value="${escapeHtml(profile.address || '')}" /></label>
      <label>City<input name="city" value="${escapeHtml(profile.city || '')}" /></label>
      <label>State<input name="state" value="${escapeHtml(profile.state || '')}" /></label>
      <label>ZIP<input name="zip" value="${escapeHtml(profile.zip || '')}" /></label>
      <label>Phone<input name="Phone" value="${escapeHtml(profile.Phone || '')}" /></label>
      <div class="checkbox-help-row">
        <label class="checkbox-option"><input type="checkbox" name="has_a_chainsaw" ${profile.has_a_chainsaw ? 'checked' : ''} /> <span>I am an experienced chainsaw user</span></label>
        ${profileHelpControl('experienced-chainsaw-help', 'experienced chainsaw user', 'Can execute a directional fell without binding')}
      </div>
      <div class="checkbox-help-row">
        <label class="checkbox-option"><input type="checkbox" name="chainsaw_user" ${profile.chainsaw_user ? 'checked' : ''} /> <span>I own a chainsaw and know how to tune it</span></label>
        ${profileHelpControl('chainsaw-owner-help', 'chainsaw owner and tuner', 'tension, sharpen, lube, adjust carb')}
      </div>
      <label>Other skills<textarea name="other_skills">${escapeHtml(profile.other_skills || '')}</textarea></label>
      <label>Admin
        <select name="Admin" ${isAdmin ? '' : 'disabled'}>
          <option value="false" ${profile.Admin ? '' : 'selected'}>False</option>
          <option value="true" ${profile.Admin ? 'selected' : ''}>True</option>
        </select>
      </label>
      <label>Credits<input type="number" name="Credits" ${isAdmin ? '' : 'disabled'} value="${profile.Credits}" /></label>
      ${isAdmin ? `
        <div class="field-help-row">
          <label>Admin-only comments<textarea name="private_comments">${escapeHtml(profile.private_comments || '')}</textarea></label>
          ${profileHelpControl(
            'admin-only-comments-help',
            'admin-only comments',
            'Comments added here should be matter-of-fact basic but are only visible by other hut leaders and admins. Include here anything that other leaders would find useful regarding this volunteer for future work parties'
          )}
        </div>
      ` : ''}
      <label>Liability waiver date<input type="date" name="liability_waiver_date" ${isAdmin ? '' : 'disabled'} value="${escapeHtml(profile.liability_waiver_date || '')}" /></label>
      <div class="waiver-profile-actions">
        <a href="/api/liability-waiver/blank" target="_blank" rel="noopener">download blank</a>
        <button type="button" class="link-button" id="submit-waiver-btn">submit</button>
        <input class="hidden" type="file" id="waiver-file-input" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" />
      </div>
      <button type="submit">Save Profile</button>
      <div id="profile-msg"></div>
    </form>
    <section class="profile-history-section" aria-labelledby="profile-work-party-history-heading">
      <h3 id="profile-work-party-history-heading">Work party history</h3>
      ${renderProfileWorkPartyHistory(profile.workPartyHistory || [])}
    </section>
    <section class="profile-history-section" aria-labelledby="profile-ski-trip-requests-heading">
      <h3 id="profile-ski-trip-requests-heading">Current ski trip reservation requests</h3>
      ${renderProfileTripRequests(profile.requests || [])}
    </section>
  `;

  const returnBtn = document.getElementById('return-own-profile');
  if (returnBtn) returnBtn.addEventListener('click', () => {
    state.profileTarget = null;
    renderProfile();
  });

  const waiverBtn = document.getElementById('submit-waiver-btn');
  const waiverInput = document.getElementById('waiver-file-input');
  if (waiverBtn && waiverInput && !editingOther) {
    waiverBtn.addEventListener('click', () => waiverInput.click());
    waiverInput.addEventListener('change', async () => {
      const file = waiverInput.files?.[0];
      if (!file) return;
      const fd = new FormData();
      fd.append('file', file);
      const msg = document.getElementById('profile-msg');
      try {
        const response = await api('/liability-waiver', { method: 'POST', body: fd });
        msg.textContent = response.message || 'Your waiver will be reviewed manually over the next few days';
        if (response.requestor) {
          state.me = response.requestor;
        }
      } catch (err) {
        msg.textContent = err.message;
      } finally {
        waiverInput.value = '';
      }
    });
  } else if (waiverBtn) {
    waiverBtn.disabled = true;
  }

  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      first_name: fd.get('first_name'),
      last_name: fd.get('last_name'),
      address: fd.get('address'),
      city: fd.get('city'),
      state: fd.get('state'),
      zip: fd.get('zip'),
      Phone: fd.get('Phone'),
      has_a_chainsaw: fd.get('has_a_chainsaw') === 'on',
      chainsaw_user: fd.get('chainsaw_user') === 'on',
      other_skills: fd.get('other_skills'),
    };
    if (isAdmin) {
      payload.Admin = fd.get('Admin') === 'true';
      payload.Credits = Number(fd.get('Credits'));
      payload.private_comments = fd.get('private_comments');
      payload.liability_waiver_date = fd.get('liability_waiver_date');
    }

    const updated = await api(`/requestor/${profile.Requestor_ID}`, { method: 'PUT', body: payload });
    if (profile.Requestor_ID === state.me.Requestor_ID) {
      state.me = updated;
    } else {
      state.profileTarget = updated;
    }
    document.getElementById('profile-msg').textContent = 'Saved.';
    renderSession();
  });
}

function requestSummaryText(choice) {
  return `Choice ${choice.choiceNumber}: ${choice.hutModes.join(', ')}, ${choice.arrival || '?'} to ${choice.departure || '?'}, ideal ${choice.spotsIdeal}`;
}

function maxSpotsForModes(hutModes) {
  if ((hutModes || []).includes('Benson') || (hutModes || []).some((m) => COMBO_MODES.includes(m))) {
    return 12;
  }
  return 15;
}

function infoIcon(text) {
  return `<span class="info-icon" title="${text}">i</span>`;
}

function renderRequestCard(choice, idx, activeIndex, container) {
  const node = el.requestCardTpl.content.firstElementChild.cloneNode(true);
  const active = idx === activeIndex;
  node.classList.toggle('active', active);

  const summary = node.querySelector('.request-summary');
  summary.textContent = requestSummaryText(choice);

  const toggle = node.querySelector('.expand-toggle');
  toggle.textContent = active ? '-' : '+';
  toggle.addEventListener('click', () => {
    state.selectedChoiceIndex = idx;
    renderRequests();
  });

  const details = node.querySelector('.request-details');
  details.classList.toggle('hidden', !active);
  if (active) {
    const maxSpots = maxSpotsForModes(choice.hutModes);
    const comboSelected = choice.hutModes.some((m) => COMBO_MODES.includes(m));
    details.innerHTML = `
      <label>Choice Number
        <div class="choice-number-wrap">
          <input data-k="choiceNumber" type="number" min="1" value="${choice.choiceNumber}" />
          ${infoIcon('Add your requests in priority order. Check the availability preview on the right to reduce overlap.')}
        </div>
      </label>
      <fieldset>
        <legend>Hut Choices (multi-select checkboxes) ${infoIcon('Including more huts helps your odds, but you may end up with any hut. Use extra choices for lower priorities.')}</legend>
        <div class="checkbox-grid">
          ${ALL_HUT_MODES.map((m) => `<label class="checkbox-option"><input type="checkbox" data-mode="${m}" ${choice.hutModes.includes(m) ? 'checked' : ''} /><span>${m}</span></label>`).join('')}
        </div>
        <small>Select one or more huts. You can select both combination trip options.</small>
      </fieldset>
      <label>Arrival<input data-k="arrival" type="date" value="${choice.arrival}" /></label>
      <label>Departure<input data-k="departure" type="date" value="${choice.departure}" /></label>
      <label class="traverse-wrap ${comboSelected ? '' : 'hidden'}">Traverse Date
        <input data-k="traverseDate" type="date" value="${choice.traverseDate || ''}" />
      </label>
      <label>Ideal Spots (1-${maxSpots})<input data-k="spotsIdeal" type="number" min="1" max="${maxSpots}" value="${choice.spotsIdeal}" /></label>
      <label>Minimum Spots<input data-k="spotsMin" type="number" min="1" max="${choice.spotsIdeal}" value="${choice.spotsMin}" /></label>
      <div class="inline-actions">
        <button type="button" data-action="save">Save</button>
        <button type="button" data-action="delete">Delete Request</button>
      </div>
      <div class="request-msg"></div>
    `;

    for (const input of details.querySelectorAll('[data-k]')) {
      input.addEventListener('input', (e) => {
        const key = e.target.dataset.k;
        state.choices[idx][key] = e.target.type === 'number' ? Number(e.target.value || 0) : e.target.value;
      });
      input.addEventListener('change', () => {
        const maxSpotsNow = maxSpotsForModes(state.choices[idx].hutModes || []);
        if (state.choices[idx].spotsIdeal > maxSpotsNow) {
          state.choices[idx].spotsIdeal = maxSpotsNow;
        }
        if (state.choices[idx].spotsMin > state.choices[idx].spotsIdeal) {
          state.choices[idx].spotsMin = state.choices[idx].spotsIdeal;
        }
      });
    }
    for (const cb of details.querySelectorAll('[data-mode]')) {
      cb.addEventListener('change', () => {
        const nextModes = [...details.querySelectorAll('[data-mode]:checked')].map((x) => x.dataset.mode);
        state.choices[idx].hutModes = nextModes;
        if (!nextModes.some((m) => COMBO_MODES.includes(m))) {
          state.choices[idx].traverseDate = '';
        }
        renderRequests();
      });
    }

    details.querySelector('[data-action="save"]').addEventListener('click', async () => {
      await saveRequests();
      details.querySelector('.request-msg').textContent = 'Saved.';
    });

    details.querySelector('[data-action="delete"]').addEventListener('click', () => {
      state.choices.splice(idx, 1);
      if (!state.choices.length) state.choices.push(defaultChoice());
      state.selectedChoiceIndex = Math.max(0, state.selectedChoiceIndex - 1);
      renderRequests();
    });
  }

  container.appendChild(node);
}

function choiceCoverage(choice) {
  const out = [];
  const pushRange = (hut, start, end) => {
    if (!start || !end) return;
    const a = new Date(start);
    const d = new Date(end);
    while (a < d) {
      out.push({ hut, date: dateIso(a), arrival: start, departure: end });
      a.setUTCDate(a.getUTCDate() + 1);
    }
  };

  const modes = Array.isArray(choice.hutModes) ? choice.hutModes : [];
  const combo = modes.find((m) => COMBO_MODES.includes(m));
  if (combo) {
    const [first, second] = combo.split('->');
    pushRange(first, choice.arrival, choice.traverseDate);
    pushRange(second, choice.traverseDate, choice.departure);
  } else {
    for (const hut of modes.filter((m) => HUTS.includes(m))) {
      pushRange(hut, choice.arrival, choice.departure);
    }
  }

  return out;
}

function buildSummaryMap(rows) {
  const m = new Map();
  for (const row of rows) {
    m.set(`${row.date}|${row.hut}`, row);
  }
  return m;
}

function renderAvailability(container, choice) {
  const rows = currentSeasonDates();
  const summaryMap = buildSummaryMap(state.summaryRows);
  const coverage = choiceCoverage(choice);
  const coverageMap = new Map(coverage.map((c) => [`${c.date}|${c.hut}`, c]));
  const selectedMin = Number(choice.spotsMin || choice.spotsIdeal || 1);
  const oneDecimal = (value) => Number(value || 0).toFixed(1);
  const tbl = document.createElement('table');
  tbl.className = 'availability';
  tbl.innerHTML = `<thead><tr><th>Month</th><th>Day</th>${HUTS.map((h) => `<th>${h}</th>`).join('')}</tr></thead>`;
  const body = document.createElement('tbody');

  let lastMonth = '';
  for (const d of rows) {
    const tr = document.createElement('tr');
    const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    const monthYear = d.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
    const dayName = d.toLocaleString('en-US', { weekday: 'short', timeZone: 'UTC' });
    const dayNum = d.getUTCDate();
    const dayKey = dateIso(d);
    tr.dataset.date = dayKey;

    const monthTd = document.createElement('td');
    monthTd.textContent = month !== lastMonth ? monthYear : '';
    tr.appendChild(monthTd);

    const dayTd = document.createElement('td');
    dayTd.textContent = `${dayName} ${dayNum}`;
    if (dayName === 'Sat' || dayName === 'Sun') dayTd.classList.add('weekend');
    tr.appendChild(dayTd);

    for (const hut of HUTS) {
      const td = document.createElement('td');
      const stats = summaryMap.get(`${dayKey}|${hut}`) || {
        capacity: HUT_CAPACITY[hut],
        higherPrioritySpots: 0,
        samePrioritySpots: 0,
        samePriorityGroups: 0,
      };

      const remAfterHigher = stats.capacity - stats.higherPrioritySpots;
      const remAfterSame = remAfterHigher - stats.samePrioritySpots;
      if (selectedMin > remAfterHigher) {
        td.classList.add('status-risk');
      } else if (selectedMin > remAfterSame) {
        td.classList.add('status-lottery');
      }

      const hit = coverageMap.get(`${dayKey}|${hut}`);
      if (hit) {
        td.classList.add('user-cell');
      }

      td.title = `Capacity: ${stats.capacity}\nHigher-pri spots req.: ${oneDecimal(stats.higherPrioritySpots)}\nSame-pri spots req.: ${oneDecimal(stats.samePrioritySpots)}\nSame-priority groups: ${stats.samePriorityGroups}`;
      td.textContent = oneDecimal(remAfterSame);
      tr.appendChild(td);
    }

    body.appendChild(tr);
    lastMonth = month;
  }

  tbl.appendChild(body);
  container.innerHTML = '';
  container.appendChild(tbl);

  if (!choice.arrival) {
    container.scrollTop = 0;
    return;
  }

  const target = new Date(choice.arrival);
  if (Number.isNaN(target.getTime())) {
    container.scrollTop = 0;
    return;
  }

  target.setUTCDate(target.getUTCDate() - 3);
  const targetIso = dateIso(target);
  const targetRow = body.querySelector(`tr[data-date="${targetIso}"]`) || body.querySelector(`tr[data-date="${choice.arrival}"]`);
  if (targetRow) {
    container.scrollTop = Math.max(0, targetRow.offsetTop - 24);
  } else {
    container.scrollTop = 0;
  }
}

async function loadSummary() {
  const choice = state.choices[state.selectedChoiceIndex] || state.choices[0];
  if (!choice) {
    state.summaryRows = [];
    return;
  }
  const data = await api(`/request-summary?choiceNumber=${choice.choiceNumber}&excludeRequestorId=${state.me.Requestor_ID}`);
  state.summaryRows = data.rows || [];
}

async function saveRequests() {
  const normalizedChoices = normalizeChoicesForSave();
  state.choices = normalizedChoices;
  const payload = { requests: serializeChoices(normalizedChoices) };
  await api(`/requestor/${state.me.Requestor_ID}/requests`, { method: 'PUT', body: payload });
  const me = await api('/me');
  state.me = me;
}

async function loadWorkParties() {
  const year = new Date().getFullYear();
  const data = await api(`/work-parties?year=${year}&requestorId=${state.me.Requestor_ID}`);
  state.workParties = data.rows || [];
}

function renderWorkParty() {
  if (!state.me) return;
  const cards = state.workParties.map((row, idx) => {
    const interest = row.Interest || 'no thank you';
    return `
      <article class="request-card ${idx === 0 ? 'active' : ''}">
        <div class="request-summary">
          ${row.Friday_check_in || ''} ${row.Hut || ''} · ${row.Leader || ''}
        </div>
        <div class="request-details">
          <div>${row.Party_comments || ''}</div>
          <div>Status: ${row.Availability || 'open'} · ${row.Confirmation_status || 'not coming'}</div>
          <fieldset>
            <legend>Interest</legend>
            <label class="checkbox-option"><input type="radio" name="interest-${idx}" value="no thank you" ${interest === 'no thank you' ? 'checked' : ''} /> <span>No thank you</span></label>
            <label class="checkbox-option"><input type="radio" name="interest-${idx}" value="only if you need me" ${interest === 'only if you need me' ? 'checked' : ''} /> <span>Only if you need me</span></label>
            <label class="checkbox-option"><input type="radio" name="interest-${idx}" value="please consider me" ${interest === 'please consider me' ? 'checked' : ''} /> <span>Please consider me</span></label>
          </fieldset>
        </div>
      </article>
    `;
  }).join('');

  el.tabWorkParty.innerHTML = `
    <h2>Work Party</h2>
    <div class="inline-actions">
      <button id="save-work-parties">Save</button>
    </div>
    <div id="work-party-msg"></div>
    <div class="request-list">${cards || '<p>No work parties found for the current year.</p>'}</div>
  `;

  document.getElementById('save-work-parties').addEventListener('click', async () => {
    const interests = state.workParties.map((row, idx) => {
      const checked = el.tabWorkParty.querySelector(`input[name="interest-${idx}"]:checked`);
      return {
        Friday_check_in: row.Friday_check_in,
        Hut: row.Hut,
        Interest: checked ? checked.value : 'no thank you',
      };
    });
    const data = await api('/work-parties', {
      method: 'PUT',
      body: { requestorId: state.me.Requestor_ID, year: new Date().getFullYear(), interests },
    });
    state.workParties = data.rows || [];
    document.getElementById('work-party-msg').textContent = 'Saved.';
    renderWorkParty();
  });
}

async function renderRequests() {
  if (!state.me) return;
  const choice = state.choices[state.selectedChoiceIndex] || state.choices[0];
  if (choice) {
    await loadSummary();
  }

  el.tabRequests.innerHTML = `
    <h2>Trip Request</h2>
    <div class="inline-actions">
      <button id="add-choice">Add Choice</button>
      <button id="save-all">Save All</button>
    </div>
    <div id="requests-msg"></div>
    <div class="requests-layout">
      <div class="request-list" id="request-list"></div>
      <div>
        <div class="availability-legend" aria-label="Availability legend">
          <div class="legend-item">
            <span class="legend-swatch legend-current"></span>
            <span>Current choice</span>
          </div>
          <div class="legend-item">
            <span class="legend-swatch legend-lottery"></span>
            <span>Other groups also have this as the same choice # -- may be subject to lottery</span>
          </div>
          <div class="legend-item">
            <span class="legend-swatch legend-risk"></span>
            <span>Groups with more credits or a higher-priority choice have requested this -- may be unavailable</span>
          </div>
        </div>
        <div class="availability-wrap" id="availability-wrap"></div>
      </div>
    </div>
  `;

  const list = document.getElementById('request-list');
  state.choices.forEach((c, i) => renderRequestCard(c, i, state.selectedChoiceIndex, list));

  document.getElementById('add-choice').addEventListener('click', () => {
    state.choices.push(defaultChoice());
    state.selectedChoiceIndex = state.choices.length - 1;
    renderRequests();
  });

  document.getElementById('save-all').addEventListener('click', async () => {
    try {
      await saveRequests();
      document.getElementById('requests-msg').textContent = 'All requests saved.';
    } catch (err) {
      document.getElementById('requests-msg').textContent = err.message;
    }
  });

  const availWrap = document.getElementById('availability-wrap');
  if (choice) {
    renderAvailability(availWrap, choice);
  }
}

async function loadMode() {
  const data = await api('/mode');
  state.mode = data.mode || 'inactive';
  applyModeUi();
}

function download(url) {
  window.open(url, '_blank', 'noopener');
}

function renderAdminPlaceholder(title, body) {
  return `
    <div class="admin-placeholder">
      <h3>${title}</h3>
      <p>${body}</p>
    </div>
  `;
}

function volunteerFilterQuery() {
  const params = new URLSearchParams({
    acceptedStatus: state.volunteerFilters.acceptedStatus || 'all',
    workPartyKey: state.volunteerFilters.workPartyKey || 'all',
    reservationStatus: state.volunteerFilters.reservationStatus || 'all',
    waiverStatus: state.volunteerFilters.waiverStatus || 'all',
  });
  return params.toString();
}

async function loadVolunteerManagement() {
  const data = await api(`/admin/volunteers?${volunteerFilterQuery()}`);
  state.volunteerRows = data.rows || [];
  state.volunteerFilterOptions = data.filters || state.volunteerFilterOptions;
}

function renderVolunteerManagement() {
  const selectedWorkParty = state.volunteerFilters.workPartyKey && state.volunteerFilters.workPartyKey !== 'all';
  const rows = state.volunteerRows.map((row) => `
    <tr>
      <td><button type="button" class="link-button" data-profile-id="${row.Requestor_ID}">${escapeHtml(row.Name || row.Email)}</button></td>
      <td>${escapeHtml(row.Phone || '')}</td>
      <td>${escapeHtml(row.city || '')}</td>
      <td>${escapeHtml(row.Email || '')}</td>
      <td>${escapeHtml(row.work_parties_applied_for || '')}</td>
      <td>${escapeHtml(row.private_comments || '')}</td>
      <td>${escapeHtml(row.years_of_service || '')}</td>
      <td>${row.has_a_chainsaw ? 'Yes' : 'No'}</td>
      <td>${row.chainsaw_user ? 'Yes' : 'No'}</td>
      <td>${escapeHtml(row.waiver_status || '')}</td>
      <td>${Number(row.hut_trip_request_count || 0)}</td>
      <td>
        <div class="row-actions">
          <button type="button" data-volunteer-action="comments" data-requestor-id="${row.Requestor_ID}">Comments</button>
          <button type="button" data-volunteer-action="waiver" data-requestor-id="${row.Requestor_ID}">Approve waiver</button>
          <button type="button" data-volunteer-action="accepted" data-status="accepted" data-requestor-id="${row.Requestor_ID}" ${selectedWorkParty ? '' : 'disabled'}>Accepted</button>
          <button type="button" data-volunteer-action="accepted" data-status="waitlisted" data-requestor-id="${row.Requestor_ID}" ${selectedWorkParty ? '' : 'disabled'}>Waitlisted</button>
          <button type="button" data-volunteer-action="attendance" data-status="full attended" data-requestor-id="${row.Requestor_ID}" ${selectedWorkParty ? '' : 'disabled'}>Full attended</button>
          <button type="button" data-volunteer-action="attendance" data-status="partial attended" data-requestor-id="${row.Requestor_ID}" ${selectedWorkParty ? '' : 'disabled'}>Partial attended</button>
          <button type="button" data-volunteer-action="attendance" data-status="no show" data-requestor-id="${row.Requestor_ID}" ${selectedWorkParty ? '' : 'disabled'}>No show</button>
          <button type="button" data-volunteer-action="attendance" data-status="cancelled" data-requestor-id="${row.Requestor_ID}" ${selectedWorkParty ? '' : 'disabled'}>Cancelled</button>
        </div>
      </td>
    </tr>
  `).join('');

  return `
    <div class="volunteer-management">
      <form id="volunteer-upload-form" class="volunteer-upload-form">
        <div>
          <strong>Bulk add/update volunteers</strong>
          <p>Email is required; all other fields are optional. Blank cells preserve existing values.</p>
          <a href="/api/admin/upload-requestors/sample">Download sample TSV</a>
        </div>
        <label>Volunteer TSV file<input id="volunteer-upload-file" type="file" name="file" accept=".tsv,text/tab-separated-values" required /></label>
        <button type="submit">Upload volunteers</button>
      </form>
      <div class="admin-filters">
        <label>Work party accepted status
          <select id="volunteer-accepted-filter">
            <option value="all" ${state.volunteerFilters.acceptedStatus === 'all' ? 'selected' : ''}>Show all</option>
            <option value="pending" ${state.volunteerFilters.acceptedStatus === 'pending' ? 'selected' : ''}>pending</option>
            <option value="accepted" ${state.volunteerFilters.acceptedStatus === 'accepted' ? 'selected' : ''}>accepted</option>
            <option value="waitlisted" ${state.volunteerFilters.acceptedStatus === 'waitlisted' ? 'selected' : ''}>waitlisted</option>
          </select>
        </label>
        <label>Work party
          <select id="volunteer-work-party-filter">
            <option value="all" ${state.volunteerFilters.workPartyKey === 'all' ? 'selected' : ''}>Show all</option>
            ${(state.volunteerFilterOptions.workParties || []).map((wp) => `<option value="${escapeHtml(wp.key)}" ${state.volunteerFilters.workPartyKey === wp.key ? 'selected' : ''}>${escapeHtml(wp.label)}</option>`).join('')}
          </select>
        </label>
        <label>Reservation status
          <select id="volunteer-reservation-filter">
            <option value="all" ${state.volunteerFilters.reservationStatus === 'all' ? 'selected' : ''}>Show all</option>
            <option value="none-submitted" ${state.volunteerFilters.reservationStatus === 'none-submitted' ? 'selected' : ''}>no requests submitted for next year</option>
            <option value="submitted" ${state.volunteerFilters.reservationStatus === 'submitted' ? 'selected' : ''}>requests submitted for next year</option>
            <option value="none-granted" ${state.volunteerFilters.reservationStatus === 'none-granted' ? 'selected' : ''}>requests but none granted</option>
            <option value="granted" ${state.volunteerFilters.reservationStatus === 'granted' ? 'selected' : ''}>requests granted</option>
          </select>
        </label>
        <label>Liability waiver
          <select id="volunteer-waiver-filter">
            <option value="all" ${state.volunteerFilters.waiverStatus === 'all' ? 'selected' : ''}>Show all</option>
            <option value="approved" ${state.volunteerFilters.waiverStatus === 'approved' ? 'selected' : ''}>waiver approved for this year</option>
            <option value="not-approved" ${state.volunteerFilters.waiverStatus === 'not-approved' ? 'selected' : ''}>no waiver approved for this year</option>
          </select>
        </label>
      </div>
      <div id="volunteer-msg" role="status">${escapeHtml(state.volunteerMessage)}</div>
      <div class="volunteer-table-wrap">
        <table class="volunteer-table">
          <thead>
            <tr>
              <th>Name</th><th>Phone</th><th>City</th><th>Email</th><th>Work parties applied for</th>
              <th>Admin comments</th><th>Years</th><th>Chainsaw skills</th><th>Chainsaw</th>
              <th>Waiver</th><th>Trip requests</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="12">No volunteers match the selected filters.</td></tr>'}</tbody>
        </table>
      </div>
    </div>
  `;
}

function wireVolunteerManagement() {
  const uploadForm = document.getElementById('volunteer-upload-form');
  if (uploadForm) uploadForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const msg = document.getElementById('volunteer-msg');
    const submit = uploadForm.querySelector('button[type="submit"]');
    const formData = new FormData(uploadForm);
    submit.disabled = true;
    state.volunteerMessage = '';
    msg.textContent = 'Uploading…';
    try {
      const result = await api('/admin/upload-requestors', { method: 'POST', body: formData });
      state.volunteerMessage = `Upload complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped.`;
      await loadVolunteerManagement();
      renderAdmin();
    } catch (err) {
      state.volunteerMessage = err.message;
      msg.textContent = err.message;
      submit.disabled = false;
    }
  });

  const filterMap = [
    ['volunteer-accepted-filter', 'acceptedStatus'],
    ['volunteer-work-party-filter', 'workPartyKey'],
    ['volunteer-reservation-filter', 'reservationStatus'],
    ['volunteer-waiver-filter', 'waiverStatus'],
  ];
  for (const [id, key] of filterMap) {
    const input = document.getElementById(id);
    if (!input) continue;
    input.addEventListener('change', async () => {
      state.volunteerFilters[key] = input.value;
      await loadVolunteerManagement();
      renderAdmin();
    });
  }

  for (const btn of el.tabAdmin.querySelectorAll('[data-profile-id]')) {
    btn.addEventListener('click', async () => {
      state.profileTarget = await api(`/requestor/${btn.dataset.profileId}`);
      renderProfile();
      setTab('profile');
    });
  }

  for (const btn of el.tabAdmin.querySelectorAll('[data-volunteer-action]')) {
    btn.addEventListener('click', async () => {
      const requestorId = btn.dataset.requestorId;
      const action = btn.dataset.volunteerAction;
      const msg = document.getElementById('volunteer-msg');
      try {
        if (action === 'comments') {
          const row = state.volunteerRows.find((r) => String(r.Requestor_ID) === String(requestorId));
          const next = window.prompt('Private admin comments', row?.private_comments || '');
          if (next === null) return;
          await api(`/admin/volunteers/${requestorId}/private-comments`, {
            method: 'PUT',
            body: { private_comments: next },
          });
          msg.textContent = 'Comments saved.';
        } else if (action === 'waiver') {
          await api(`/admin/volunteers/${requestorId}/approve-waiver`, { method: 'POST', body: {} });
          msg.textContent = 'Waiver approved.';
        } else if (action === 'accepted') {
          await api(`/admin/volunteers/${requestorId}/work-party-accepted-status`, {
            method: 'PUT',
            body: { workPartyKey: state.volunteerFilters.workPartyKey, status: btn.dataset.status },
          });
          msg.textContent = 'Work-party accepted status saved.';
        } else if (action === 'attendance') {
          await api(`/admin/volunteers/${requestorId}/work-party-attendance-status`, {
            method: 'PUT',
            body: { workPartyKey: state.volunteerFilters.workPartyKey, status: btn.dataset.status },
          });
          msg.textContent = 'Work-party attendance status saved.';
        }
        await loadVolunteerManagement();
        renderAdmin();
      } catch (err) {
        msg.textContent = err.message;
      }
    });
  }
}

async function loadWaiverReview() {
  const data = await api(`/admin/liability-waivers?year=${encodeURIComponent(state.waiverReviewYear)}`);
  state.waiverReviewRows = data.rows || [];
}

function renderWaiverReview() {
  const rows = state.waiverReviewRows.map((row) => `
    <tr>
      <td><button type="button" class="link-button" data-profile-id="${row.Requestor_ID}">${escapeHtml(row.Name || row.Email)}</button></td>
      <td>${escapeHtml(row.Email || '')}</td>
      <td>${escapeHtml(row.Phone || '')}</td>
      <td>${escapeHtml(row.city || '')}</td>
      <td>${escapeHtml(row.liability_waiver_submitted_at || '')}</td>
      <td>
        <div class="row-actions">
          <button type="button" data-waiver-action="download" data-requestor-id="${row.Requestor_ID}">Download</button>
          <button type="button" data-waiver-action="approve" data-requestor-id="${row.Requestor_ID}">Approve</button>
        </div>
      </td>
    </tr>
  `).join('');

  return `
    <div class="waiver-review">
      <div class="admin-filters">
        <label>Year<input id="waiver-review-year" type="number" min="2020" max="2100" value="${Number(state.waiverReviewYear)}" /></label>
      </div>
      <div id="waiver-review-msg"></div>
      <div class="volunteer-table-wrap">
        <table class="volunteer-table waiver-table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Phone</th><th>City</th><th>Submitted</th><th>Actions</th></tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="6">No liability waivers are pending review.</td></tr>'}</tbody>
        </table>
      </div>
    </div>
  `;
}

function wireWaiverReview() {
  const yearInput = document.getElementById('waiver-review-year');
  if (yearInput) yearInput.addEventListener('change', async () => {
    state.waiverReviewYear = Number(yearInput.value || new Date().getFullYear());
    await loadWaiverReview();
    renderAdmin();
  });

  for (const btn of el.tabAdmin.querySelectorAll('[data-profile-id]')) {
    btn.addEventListener('click', async () => {
      state.profileTarget = await api(`/requestor/${btn.dataset.profileId}`);
      renderProfile();
      setTab('profile');
    });
  }

  for (const btn of el.tabAdmin.querySelectorAll('[data-waiver-action]')) {
    btn.addEventListener('click', async () => {
      const requestorId = btn.dataset.requestorId;
      const action = btn.dataset.waiverAction;
      const msg = document.getElementById('waiver-review-msg');
      try {
        if (action === 'download') {
          download(`/api/admin/liability-waivers/${requestorId}/download`);
        } else if (action === 'approve') {
          await api(`/admin/liability-waivers/${requestorId}/approve`, { method: 'POST', body: {} });
          msg.textContent = 'Waiver approved.';
          await loadWaiverReview();
          renderAdmin();
        }
      } catch (err) {
        msg.textContent = err.message;
      }
    });
  }
}

async function loadAdminWorkParties() {
  const data = await api(`/admin/work-parties?year=${encodeURIComponent(state.adminWorkPartyYear)}`);
  state.adminWorkPartyRows = data.rows || [];
  state.adminWorkPartyLeaderOptions = data.leaderOptions || [];
}

function currentEditingWorkParty() {
  return state.adminWorkPartyRows.find((row) => row.key === state.editingWorkPartyKey) || null;
}

function renderAdminWorkPartyManagement() {
  const editing = currentEditingWorkParty();
  const formTitle = editing ? 'Edit work party' : 'Add work party';
  const rows = state.adminWorkPartyRows.map((row) => `
    <tr>
      <td>${escapeHtml(row.Friday_check_in || '')}</td>
      <td>${escapeHtml(row.Hut || '')}</td>
      <td>${escapeHtml(row.Sunday_check_out || '')}</td>
      <td>${escapeHtml(row.Leader || '')}</td>
      <td>${escapeHtml(row.Leader_contact || row.Leader_phone || '')}</td>
      <td>${Number(row.Capacity || 0)}</td>
      <td>${escapeHtml(row.Availability || 'open')}</td>
      <td>${escapeHtml(row.Party_comments || '')}</td>
      <td>
        <div class="row-actions">
          <button type="button" data-work-party-action="edit" data-work-party-key="${escapeHtml(row.key)}">Edit</button>
          <button type="button" data-work-party-action="delete" data-work-party-key="${escapeHtml(row.key)}">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
  const leaderOptions = state.adminWorkPartyLeaderOptions.map((leader) => `
    <option value="${leader.Requestor_ID}"
      data-name="${escapeHtml(leader.Name || '')}"
      data-contact="${escapeHtml(leader.contact || '')}"
      ${editing && (editing.Leader === leader.Name || editing.Leader_contact === leader.contact) ? 'selected' : ''}>
      ${escapeHtml(leader.label || leader.Email)}
    </option>
  `).join('');

  return `
    <div class="work-party-management">
      <div class="admin-filters">
        <label>Year<input id="admin-work-party-year" type="number" min="2020" max="2100" value="${Number(state.adminWorkPartyYear)}" /></label>
      </div>
      <div id="admin-work-party-msg"></div>
      <div class="volunteer-table-wrap">
        <table class="volunteer-table work-party-admin-table">
          <thead>
            <tr>
              <th>Friday</th><th>Hut</th><th>Sunday</th><th>Leader</th><th>Contact</th>
              <th>Capacity</th><th>Availability</th><th>Comments</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="9">No work parties are set up for this year.</td></tr>'}</tbody>
        </table>
      </div>
      <form id="admin-work-party-form" class="admin-work-party-form">
        <h3>${formTitle}</h3>
        <div class="form-grid">
          <label>Friday check-in<input type="date" name="Friday_check_in" ${editing ? 'disabled' : ''} value="${escapeHtml(editing?.Friday_check_in || '')}" required /></label>
          <label>Hut
            <select name="Hut" ${editing ? 'disabled' : ''} required>
              ${HUTS.map((hut) => `<option value="${hut}" ${editing?.Hut === hut ? 'selected' : ''}>${hut}</option>`).join('')}
            </select>
          </label>
          <label>Sunday check-out<input type="date" name="Sunday_check_out" value="${escapeHtml(editing?.Sunday_check_out || '')}" /></label>
          <label>Leader
            <select id="admin-work-party-leader" name="leaderOption">
              <option value="">Manual entry</option>
              ${leaderOptions}
            </select>
          </label>
          <label>Leader name<input name="Leader" value="${escapeHtml(editing?.Leader || '')}" /></label>
          <label>Leader contact<input name="Leader_contact" value="${escapeHtml(editing?.Leader_contact || editing?.Leader_phone || '')}" /></label>
          <label>Capacity<input type="number" min="0" step="1" name="Capacity" value="${Number(editing?.Capacity ?? 0)}" /></label>
          <label>Availability
            <select name="Availability">
              ${['open', 'waitlist-only', 'closed'].map((value) => `<option value="${value}" ${(editing?.Availability || 'open') === value ? 'selected' : ''}>${value}</option>`).join('')}
            </select>
          </label>
          <label class="full-span">Comments<textarea name="Party_comments">${escapeHtml(editing?.Party_comments || '')}</textarea></label>
        </div>
        <div class="inline-actions">
          <button type="submit">${editing ? 'Save changes' : 'Create work party'}</button>
          ${editing ? '<button type="button" id="cancel-work-party-edit">Cancel edit</button>' : ''}
        </div>
      </form>
    </div>
  `;
}

function workPartyFormPayload(form) {
  const fd = new FormData(form);
  return {
    year: Number(state.adminWorkPartyYear),
    Friday_check_in: fd.get('Friday_check_in'),
    Hut: fd.get('Hut'),
    Sunday_check_out: fd.get('Sunday_check_out'),
    Leader: fd.get('Leader'),
    Leader_contact: fd.get('Leader_contact'),
    Capacity: Number(fd.get('Capacity') || 0),
    Availability: fd.get('Availability'),
    Party_comments: fd.get('Party_comments'),
  };
}

function wireAdminWorkPartyManagement() {
  const yearInput = document.getElementById('admin-work-party-year');
  if (yearInput) yearInput.addEventListener('change', async () => {
    state.adminWorkPartyYear = Number(yearInput.value || new Date().getFullYear());
    state.editingWorkPartyKey = null;
    await loadAdminWorkParties();
    renderAdmin();
  });

  const leaderSelect = document.getElementById('admin-work-party-leader');
  if (leaderSelect) leaderSelect.addEventListener('change', () => {
    const selected = leaderSelect.selectedOptions[0];
    if (!selected || !selected.value) return;
    const form = document.getElementById('admin-work-party-form');
    form.elements.Leader.value = selected.dataset.name || '';
    form.elements.Leader_contact.value = selected.dataset.contact || '';
  });

  const cancelBtn = document.getElementById('cancel-work-party-edit');
  if (cancelBtn) cancelBtn.addEventListener('click', () => {
    state.editingWorkPartyKey = null;
    renderAdmin();
  });

  const form = document.getElementById('admin-work-party-form');
  if (form) form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('admin-work-party-msg');
    try {
      const body = workPartyFormPayload(form);
      if (state.editingWorkPartyKey) {
        await api(`/admin/work-parties/${encodeURIComponent(state.editingWorkPartyKey)}`, {
          method: 'PUT',
          body,
        });
        msg.textContent = 'Work party saved.';
      } else {
        await api('/admin/work-parties', { method: 'POST', body });
        msg.textContent = 'Work party created.';
      }
      state.editingWorkPartyKey = null;
      await loadAdminWorkParties();
      await loadWorkParties().catch(() => { state.workParties = []; });
      renderWorkParty();
      renderAdmin();
    } catch (err) {
      msg.textContent = err.message;
    }
  });

  for (const btn of el.tabAdmin.querySelectorAll('[data-work-party-action]')) {
    btn.addEventListener('click', async () => {
      const key = btn.dataset.workPartyKey;
      const action = btn.dataset.workPartyAction;
      const msg = document.getElementById('admin-work-party-msg');
      if (action === 'edit') {
        state.editingWorkPartyKey = key;
        renderAdmin();
        return;
      }
      if (action === 'delete') {
        const row = state.adminWorkPartyRows.find((x) => x.key === key);
        const ok = window.confirm(`Delete ${row?.Hut || ''} ${row?.Friday_check_in || ''}? Volunteer applications for this work party will also be removed.`);
        if (!ok) return;
        try {
          await api(`/admin/work-parties/${encodeURIComponent(key)}?year=${encodeURIComponent(state.adminWorkPartyYear)}`, {
            method: 'DELETE',
          });
          msg.textContent = 'Work party deleted.';
          state.editingWorkPartyKey = null;
          await loadAdminWorkParties();
          await loadWorkParties().catch(() => { state.workParties = []; });
          renderWorkParty();
          renderAdmin();
        } catch (err) {
          msg.textContent = err.message;
        }
      }
    });
  }
}

async function renderAdmin() {
  if (!state.me?.Admin) {
    el.tabAdmin.innerHTML = '<h2>Admin</h2><p>Admin access required.</p>';
    return;
  }

  if (!ADMIN_SECTIONS.some((section) => section.id === state.adminSection)) {
    state.adminSection = 'application-settings';
  }

  if (state.adminSection === 'manage-volunteers') {
    await loadVolunteerManagement().catch(() => {
      state.volunteerRows = [];
    });
  }
  if (state.adminSection === 'review-waivers') {
    await loadWaiverReview().catch(() => {
      state.waiverReviewRows = [];
    });
  }
  if (state.adminSection === 'setup-work-parties') {
    await loadAdminWorkParties().catch(() => {
      state.adminWorkPartyRows = [];
      state.adminWorkPartyLeaderOptions = [];
    });
  }

  el.tabAdmin.innerHTML = `
    <h2>Admin</h2>
    <div class="admin-console">
      <nav class="admin-nav" aria-label="Admin sections">
        ${ADMIN_SECTIONS.map((section) => `
          <button type="button" class="${state.adminSection === section.id ? 'active' : ''}" data-admin-section="${section.id}">
            ${section.label}
          </button>
        `).join('')}
      </nav>
      <div class="admin-section ${state.adminSection === 'application-settings' ? '' : 'hidden'}" data-admin-panel="application-settings">
        <div class="kpi-grid">
          <div class="kpi-card">
            <h3>Season Mode</h3>
            <label>Mode
              <select id="app-mode">
                <option value="work-party" ${state.mode === 'work-party' ? 'selected' : ''}>Work Party mode</option>
                <option value="trip-request" ${state.mode === 'trip-request' ? 'selected' : ''}>Trip Request mode</option>
                <option value="inactive" ${state.mode === 'inactive' ? 'selected' : ''}>Inactive mode</option>
              </select>
            </label>
            <div class="inline-actions">
              <button id="save-mode">Save mode</button>
            </div>
            <div id="mode-msg"></div>
          </div>
          <div class="kpi-card">
            <h3>Run Assignment Lottery</h3>
            <label class="checkbox-option"><input id="regenerate-lottery" type="checkbox" checked /> <span>Regenerate lottery numbers</span></label>
            <div class="inline-actions">
              <button id="run-assignment">Run lottery</button>
              <button id="regenerate-lottery-btn">Regenerate lottery numbers</button>
            </div>
            <div id="assign-msg"></div>
            <div id="lottery-msg"></div>
          </div>
        </div>
      </div>
      <div class="admin-section ${state.adminSection === 'manage-volunteers' ? '' : 'hidden'}" data-admin-panel="manage-volunteers">
        ${state.adminSection === 'manage-volunteers' ? renderVolunteerManagement() : ''}
      </div>
      <div class="admin-section ${state.adminSection === 'review-waivers' ? '' : 'hidden'}" data-admin-panel="review-waivers">
        ${state.adminSection === 'review-waivers' ? renderWaiverReview() : ''}
      </div>
      <div class="admin-section ${state.adminSection === 'download-requests' ? '' : 'hidden'}" data-admin-panel="download-requests">
        <div class="kpi-card">
          <h3>Download Requests</h3>
          <div class="download-switch">
            <label><input type="radio" name="download-filter" value="all" checked /> All requests</label>
            <label><input type="radio" name="download-filter" value="granted" /> Granted requests only</label>
            <label><input type="radio" name="download-filter" value="none" /> Requestors with no requests</label>
          </div>
          <div class="inline-actions">
            <button id="download-joined">Download joined requests</button>
          </div>
        </div>
      </div>
      <div class="admin-section ${state.adminSection === 'efficiency-report' ? '' : 'hidden'}" data-admin-panel="efficiency-report">
        <div class="kpi-card">
          <h3>Efficiency Report</h3>
          <div class="inline-actions">
            <button id="load-efficiency">Load efficiency report</button>
          </div>
          <div id="eff-table"></div>
        </div>
      </div>
      <div class="admin-section ${state.adminSection === 'setup-work-parties' ? '' : 'hidden'}" data-admin-panel="setup-work-parties">
        ${state.adminSection === 'setup-work-parties' ? renderAdminWorkPartyManagement() : ''}
      </div>
    </div>
  `;

  for (const btn of el.tabAdmin.querySelectorAll('[data-admin-section]')) {
    btn.addEventListener('click', () => {
      state.adminSection = btn.dataset.adminSection;
      renderAdmin();
    });
  }

  if (state.adminSection === 'manage-volunteers') {
    wireVolunteerManagement();
  }
  if (state.adminSection === 'review-waivers') {
    wireWaiverReview();
  }
  if (state.adminSection === 'setup-work-parties') {
    wireAdminWorkPartyManagement();
  }

  const saveModeBtn = document.getElementById('save-mode');
  if (saveModeBtn) saveModeBtn.addEventListener('click', async () => {
    const mode = document.getElementById('app-mode').value;
    const data = await api('/mode', { method: 'PUT', body: { mode } });
    state.mode = data.mode;
    document.getElementById('mode-msg').textContent = 'Saved.';
    applyModeUi();
  });

  const downloadJoinedBtn = document.getElementById('download-joined');
  if (downloadJoinedBtn) downloadJoinedBtn.addEventListener('click', () => {
    const selected = el.tabAdmin.querySelector('input[name="download-filter"]:checked');
    const filter = selected ? selected.value : 'all';
    download(`/api/admin/download/requests-joined?filter=${filter}`);
  });

  const regenerateLottery = document.getElementById('regenerate-lottery');
  const runAssignmentBtn = document.getElementById('run-assignment');
  if (runAssignmentBtn) runAssignmentBtn.addEventListener('click', async () => {
    const data = await api('/admin/run-assignment', {
      method: 'POST',
      body: { regenerateLotteryNumbers: regenerateLottery.checked },
    });
    document.getElementById('assign-msg').textContent = data.message;
  });

  const regenerateLotteryBtn = document.getElementById('regenerate-lottery-btn');
  if (regenerateLotteryBtn) regenerateLotteryBtn.addEventListener('click', async () => {
    const data = await api('/admin/regenerate-lottery', { method: 'POST', body: {} });
    document.getElementById('lottery-msg').textContent = data.message;
  });

  const loadEfficiencyBtn = document.getElementById('load-efficiency');
  if (loadEfficiencyBtn) loadEfficiencyBtn.addEventListener('click', async () => {
    const data = await api('/admin/efficiency-report');
    const rows = data.rows || [];
    document.getElementById('eff-table').innerHTML = rows.length
      ? `<table class="availability"><thead><tr><th>Outcome</th><th>% Groups</th><th>% Spots</th></tr></thead><tbody>${rows
          .map((r) => `<tr><td>${r.outcome || r.choice}</td><td>${r.groupsPercent}</td><td>${r.spotsPercent}</td></tr>`)
          .join('')}</tbody></table>`
      : '<p>No granted assignments yet.</p>';
  });

}

async function loadMeAndRender() {
  const me = await api('/me');
  state.me = me;
  state.choices = mapRequestsToChoices(me.requests || []);
  state.selectedChoiceIndex = 0;

  el.loginCard.classList.add('hidden');
  el.mainApp.classList.remove('hidden');
  el.adminTabBtn.classList.toggle('hidden', !me.Admin);

  renderSession();
  await loadMode();
  await loadWorkParties().catch(() => { state.workParties = []; });
  renderWorkParty();
  await renderRequests();
  renderProfile();
  await renderAdmin();
}

async function tryAutoLoginFromUrl() {
  const params = new URLSearchParams(location.search);
  const email = params.get('email');
  const code = params.get('code') || params.get('hash');
  if (!email || !code) return false;

  el.loginEmail.value = email;
  el.loginCode.value = code;
  await api('/check-login', { method: 'POST', body: { email, code: Number(code) } });
  await loadMeAndRender();
  return true;
}

function wireLogin() {
  el.sendLoginCode.addEventListener('click', async () => {
    el.loginError.textContent = '';
    try {
      await api('/send-email', {
        method: 'POST',
        body: { email: el.loginEmail.value },
      });
      el.loginError.textContent = 'If we have the email on file, a code has been sent. Please note that it can take up to 1 minute for the email to come through.';
    } catch (err) {
      el.loginError.textContent = err.message;
    }
  });

  el.loginCode.addEventListener('input', () => {
    el.loginCode.value = String(el.loginCode.value || '').replace(/\D/g, '').slice(0, 4);
  });

  el.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    el.loginError.textContent = '';
    try {
      const cleaned = String(el.loginCode.value || '').replace(/\D/g, '');
      await api('/check-login', {
        method: 'POST',
        body: { email: el.loginEmail.value, code: Number(cleaned) },
      });
      await loadMeAndRender();
    } catch (err) {
      el.loginError.textContent = err.message;
    }
  });
}

async function init() {
  wireTabs();
  wireLogin();
  wireContextualHelp();

  try {
    await loadMeAndRender();
    return;
  } catch {
    // no active session
  }

  try {
    await tryAutoLoginFromUrl();
  } catch (err) {
    el.loginError.textContent = err.message;
  }
}

init();
