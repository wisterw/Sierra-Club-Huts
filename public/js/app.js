const HUTS = ['Benson', 'Bradley', 'Grubb', 'Ludlow'];
const HUT_MODES = ['Benson', 'Bradley', 'Grubb', 'Ludlow', 'Benson->Bradley', 'Bradley->Benson'];

const state = {
  me: null,
  choices: [],
  selectedChoiceIndex: 0,
  summaryRows: [],
};

const el = {
  loginCard: document.getElementById('login-card'),
  loginForm: document.getElementById('login-form'),
  loginEmail: document.getElementById('login-email'),
  loginHash: document.getElementById('login-hash'),
  loginError: document.getElementById('login-error'),
  mainApp: document.getElementById('main-app'),
  sessionInfo: document.getElementById('session-info'),
  tabProfile: document.getElementById('tab-profile'),
  tabRequests: document.getElementById('tab-requests'),
  tabAdmin: document.getElementById('tab-admin'),
  adminTabBtn: document.getElementById('admin-tab-btn'),
  requestCardTpl: document.getElementById('request-card-template'),
};

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const isTsv = (res.headers.get('content-type') || '').includes('tab-separated-values');
  const data = isTsv ? await res.text() : await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `${res.status} ${res.statusText}`);
  }
  return data;
}

function currentSeasonDates() {
  const year = new Date().getFullYear();
  const start = new Date(Date.UTC(year, 11, 1));
  const end = new Date(Date.UTC(year + 1, 4, 31));
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

function defaultChoice() {
  return {
    hutMode: 'Benson',
    arrival: '',
    departure: '',
    traverseDate: '',
    choiceNumber: state.choices.length + 1,
    spotsIdeal: 1,
    spotsMin: 1,
    status: 'pending',
  };
}

function normalizeChoice(choice, idx) {
  return {
    hutMode: HUT_MODES.includes(choice.hutMode) ? choice.hutMode : 'Benson',
    arrival: choice.arrival || '',
    departure: choice.departure || '',
    traverseDate: choice.traverseDate || '',
    choiceNumber: Number(choice.choiceNumber || idx + 1),
    spotsIdeal: Number(choice.spotsIdeal || 1),
    spotsMin: Number(choice.spotsMin || choice.spotsIdeal || 1),
    status: choice.status || 'pending',
  };
}

function mapRequestsToChoices(rawRequests) {
  if (!rawRequests.length) return [defaultChoice()];
  const out = rawRequests.map((r, i) => {
    const hut = HUTS.find((h) => r[h]) || 'Benson';
    return normalizeChoice(
      {
        hutMode: hut,
        arrival: r.Arrival,
        departure: r.Departure,
        choiceNumber: r.Choice_Number,
        spotsIdeal: r.Spots_ideal,
        spotsMin: r.Spots_min,
        status: r.Status,
      },
      i
    );
  });

  return out.sort((a, b) => a.choiceNumber - b.choiceNumber);
}

function expandChoice(choice) {
  const shared = {
    Choice_Number: Number(choice.choiceNumber),
    Spots_ideal: Number(choice.spotsIdeal),
    Spots_min: Number(choice.spotsMin || choice.spotsIdeal),
    Status: choice.status || 'pending',
    Hut_granted: '',
    Spots_granted: 0,
    Confirmed_How: '',
  };

  if (choice.hutMode === 'Benson->Bradley' || choice.hutMode === 'Bradley->Benson') {
    const [first, second] = choice.hutMode.split('->');
    if (!choice.traverseDate) {
      throw new Error('Traverse date is required for combination huts.');
    }
    return [
      {
        ...shared,
        Benson: first === 'Benson',
        Bradley: first === 'Bradley',
        Grubb: false,
        Ludlow: false,
        Arrival: choice.arrival,
        Departure: choice.traverseDate,
      },
      {
        ...shared,
        Benson: second === 'Benson',
        Bradley: second === 'Bradley',
        Grubb: false,
        Ludlow: false,
        Arrival: choice.traverseDate,
        Departure: choice.departure,
      },
    ];
  }

  return [
    {
      ...shared,
      Benson: choice.hutMode === 'Benson',
      Bradley: choice.hutMode === 'Bradley',
      Grubb: choice.hutMode === 'Grubb',
      Ludlow: choice.hutMode === 'Ludlow',
      Arrival: choice.arrival,
      Departure: choice.departure,
    },
  ];
}

function serializeChoices() {
  return state.choices
    .map((choice, idx) => normalizeChoice(choice, idx))
    .flatMap((choice) => expandChoice(choice));
}

function setTab(tabName) {
  for (const btn of document.querySelectorAll('.tabs button')) {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  }
  el.tabProfile.classList.toggle('hidden', tabName !== 'profile');
  el.tabRequests.classList.toggle('hidden', tabName !== 'requests');
  el.tabAdmin.classList.toggle('hidden', tabName !== 'admin');
}

function wireTabs() {
  for (const btn of document.querySelectorAll('.tabs button')) {
    btn.addEventListener('click', () => setTab(btn.dataset.tab));
  }
}

function renderSession() {
  if (!state.me) return;
  el.sessionInfo.innerHTML = `<div><strong>${state.me.Name || state.me.Email}</strong><br/><small>${state.me.Email}</small></div><button id="logout-btn">Logout</button>`;
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await api('/logout', { method: 'POST' });
    location.href = '/';
  });
}

function renderProfile() {
  if (!state.me) return;
  const isAdmin = Boolean(state.me.Admin);
  el.tabProfile.innerHTML = `
    <h2>Profile</h2>
    <form id="profile-form">
      <label>Email<input disabled value="${state.me.Email}" /></label>
      <label>Name<input name="Name" value="${state.me.Name || ''}" /></label>
      <label>Phone<input name="Phone" value="${state.me.Phone || ''}" /></label>
      <label>Comments<textarea name="Comments">${state.me.Comments || ''}</textarea></label>
      <label>Admin
        <select name="Admin" ${isAdmin ? '' : 'disabled'}>
          <option value="false" ${state.me.Admin ? '' : 'selected'}>False</option>
          <option value="true" ${state.me.Admin ? 'selected' : ''}>True</option>
        </select>
      </label>
      <label>Credits<input type="number" name="Credits" ${isAdmin ? '' : 'disabled'} value="${state.me.Credits}" /></label>
      <button type="submit">Save Profile</button>
      <div id="profile-msg"></div>
    </form>
  `;

  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      Name: fd.get('Name'),
      Phone: fd.get('Phone'),
      Comments: fd.get('Comments'),
    };
    if (isAdmin) {
      payload.Admin = fd.get('Admin') === 'true';
      payload.Credits = Number(fd.get('Credits'));
    }

    const updated = await api(`/requestor/${state.me.Requestor_ID}`, { method: 'PUT', body: payload });
    state.me = updated;
    document.getElementById('profile-msg').textContent = 'Saved.';
    renderSession();
  });
}

function requestSummaryText(choice) {
  return `Choice ${choice.choiceNumber}: ${choice.hutMode}, ${choice.arrival || '?'} to ${choice.departure || '?'}, ideal ${choice.spotsIdeal}`;
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
    details.innerHTML = `
      <label>Choice Number<input data-k="choiceNumber" type="number" min="1" value="${choice.choiceNumber}" /></label>
      <label>Hut Choice
        <select data-k="hutMode">
          ${HUT_MODES.map((m) => `<option ${m === choice.hutMode ? 'selected' : ''}>${m}</option>`).join('')}
        </select>
      </label>
      <label>Arrival<input data-k="arrival" type="date" value="${choice.arrival}" /></label>
      <label>Departure<input data-k="departure" type="date" value="${choice.departure}" /></label>
      <label class="traverse-wrap ${choice.hutMode.includes('->') ? '' : 'hidden'}">Traverse Date
        <input data-k="traverseDate" type="date" value="${choice.traverseDate || ''}" />
      </label>
      <label>Ideal Spots (1-15)<input data-k="spotsIdeal" type="number" min="1" max="15" value="${choice.spotsIdeal}" /></label>
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
        if (key === 'hutMode') {
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

  if (choice.hutMode.includes('->')) {
    const [first, second] = choice.hutMode.split('->');
    pushRange(first, choice.arrival, choice.traverseDate);
    pushRange(second, choice.traverseDate, choice.departure);
  } else {
    pushRange(choice.hutMode, choice.arrival, choice.departure);
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

  const tbl = document.createElement('table');
  tbl.className = 'availability';
  tbl.innerHTML = `<thead><tr><th>Month</th><th>Day</th>${HUTS.map((h) => `<th>${h}</th>`).join('')}</tr></thead>`;
  const body = document.createElement('tbody');

  let lastMonth = '';
  for (const d of rows) {
    const tr = document.createElement('tr');
    const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    const dayName = d.toLocaleString('en-US', { weekday: 'short', timeZone: 'UTC' });
    const dayNum = d.getUTCDate();
    const dayKey = dateIso(d);

    const monthTd = document.createElement('td');
    monthTd.textContent = month !== lastMonth ? month : '';
    tr.appendChild(monthTd);

    const dayTd = document.createElement('td');
    dayTd.textContent = `${dayName} ${dayNum}`;
    if (dayName === 'Sat' || dayName === 'Sun') dayTd.classList.add('weekend');
    tr.appendChild(dayTd);

    for (const hut of HUTS) {
      const td = document.createElement('td');
      const stats = summaryMap.get(`${dayKey}|${hut}`) || {
        capacity: hut === 'Benson' || hut === 'Bradley' ? 12 : 15,
        higherPrioritySpots: 0,
        samePrioritySpots: 0,
        samePriorityGroups: 0,
      };

      const remAfterHigher = stats.capacity - stats.higherPrioritySpots;
      const remAfterSame = remAfterHigher - stats.samePrioritySpots;
      if (selectedMin < remAfterSame) {
        td.classList.add('status-lottery');
      } else if (selectedMin < remAfterHigher) {
        td.classList.add('status-risk');
      }

      const hit = coverageMap.get(`${dayKey}|${hut}`);
      if (hit) {
        td.classList.add('user-cell');
        if (dayKey === hit.arrival) td.classList.add('user-in');
        else if (dayKey === hit.departure) td.classList.add('user-out');
        else td.classList.add('user-mid');
      }

      td.title = `Capacity: ${stats.capacity}\nHigher-priority spots: ${stats.higherPrioritySpots}\nSame-priority spots: ${stats.samePrioritySpots}\nSame-priority groups: ${stats.samePriorityGroups}`;
      td.textContent = `${stats.higherPrioritySpots}/${stats.samePrioritySpots}`;
      tr.appendChild(td);
    }

    body.appendChild(tr);
    lastMonth = month;
  }

  tbl.appendChild(body);
  container.innerHTML = '';
  container.appendChild(tbl);
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
  const payload = { requests: serializeChoices() };
  await api(`/requestor/${state.me.Requestor_ID}/requests`, { method: 'PUT', body: payload });
  const me = await api('/me');
  state.me = me;
}

async function renderRequests() {
  if (!state.me) return;
  const choice = state.choices[state.selectedChoiceIndex] || state.choices[0];
  if (choice) {
    await loadSummary();
  }

  el.tabRequests.innerHTML = `
    <h2>Requests</h2>
    <div class="inline-actions">
      <button id="add-choice">Add Choice</button>
      <button id="save-all">Save All</button>
    </div>
    <div id="requests-msg"></div>
    <div class="requests-layout">
      <div class="request-list" id="request-list"></div>
      <div class="availability-wrap" id="availability-wrap"></div>
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

function download(url) {
  window.open(url, '_blank', 'noopener');
}

async function renderAdmin() {
  if (!state.me?.Admin) {
    el.tabAdmin.innerHTML = '<h2>Admin</h2><p>Admin access required.</p>';
    return;
  }

  el.tabAdmin.innerHTML = `
    <h2>Admin</h2>
    <div class="kpi-grid">
      <div class="kpi-card">
        <h3>Upload Requestors TSV</h3>
        <form id="upload-form">
          <input type="file" name="file" accept=".tsv,text/tab-separated-values" required />
          <button type="submit">Upload</button>
        </form>
        <div id="upload-msg"></div>
      </div>
      <div class="kpi-card">
        <h3>Downloads</h3>
        <div class="inline-actions">
          <button data-dl="all">All requestors</button>
          <button data-dl="no-pending-requests">No pending</button>
          <button data-dl="no-likely-requests">No likely</button>
          <button data-dl="no-assigned-requests">No assigned</button>
        </div>
        <div class="inline-actions" style="margin-top:.5rem;">
          <button id="download-joined">Requests joined report</button>
        </div>
      </div>
      <div class="kpi-card">
        <h3>Assignment + Efficiency</h3>
        <div class="inline-actions">
          <button id="run-assignment">Run assignment</button>
          <button id="load-efficiency">Load efficiency report</button>
        </div>
        <div id="assign-msg"></div>
        <div id="eff-table"></div>
      </div>
      <div class="kpi-card">
        <h3>Requestor Login Codes</h3>
        <button id="load-codes">Load requestor codes</button>
        <div id="codes-table"></div>
      </div>
    </div>
  `;

  document.getElementById('upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const res = await fetch('/api/admin/upload-requestors', { method: 'POST', body: formData });
    const data = await res.json();
    document.getElementById('upload-msg').textContent = res.ok ? `Upserted ${data.createdOrUpdated} records.` : data.error;
  });

  for (const btn of el.tabAdmin.querySelectorAll('[data-dl]')) {
    btn.addEventListener('click', () => download(`/api/admin/download/requestors?filter=${btn.dataset.dl}`));
  }

  document.getElementById('download-joined').addEventListener('click', () => {
    download('/api/admin/download/requests-joined');
  });

  document.getElementById('run-assignment').addEventListener('click', async () => {
    const data = await api('/admin/run-assignment', { method: 'POST', body: {} });
    document.getElementById('assign-msg').textContent = data.message;
  });

  document.getElementById('load-efficiency').addEventListener('click', async () => {
    const data = await api('/admin/efficiency-report');
    const rows = data.rows || [];
    document.getElementById('eff-table').innerHTML = rows.length
      ? `<table class="availability"><thead><tr><th>Choice</th><th>% Groups</th><th>% Spots</th></tr></thead><tbody>${rows
          .map((r) => `<tr><td>${r.choice}</td><td>${r.groupsPercent}</td><td>${r.spotsPercent}</td></tr>`)
          .join('')}</tbody></table>`
      : '<p>No confirmed assignments yet.</p>';
  });

  document.getElementById('load-codes').addEventListener('click', async () => {
    const data = await api('/admin/requestors');
    const rows = data.rows || [];
    document.getElementById('codes-table').innerHTML = `<table class="availability"><thead><tr><th>Email</th><th>Name</th><th>Code</th></tr></thead><tbody>${rows
      .map((r) => `<tr><td>${r.Email}</td><td>${r.Name || ''}</td><td>${r.Login_Code}</td></tr>`)
      .join('')}</tbody></table>`;
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
  renderProfile();
  await renderRequests();
  await renderAdmin();
}

async function tryAutoLoginFromUrl() {
  const params = new URLSearchParams(location.search);
  const email = params.get('email');
  const hash = params.get('hash');
  if (!email || !hash) return false;

  el.loginEmail.value = email;
  el.loginHash.value = hash;
  await api('/check-login', { method: 'POST', body: { email, hash: Number(hash) } });
  await loadMeAndRender();
  return true;
}

function wireLogin() {
  el.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    el.loginError.textContent = '';
    try {
      await api('/check-login', {
        method: 'POST',
        body: { email: el.loginEmail.value, hash: Number(el.loginHash.value) },
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
