const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { SqliteStore } = require('../src/data/sqliteStore');

function makeTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sierra-club-huts-profile-'));
  return path.join(dir, 'huts.sqlite');
}

function run() {
  const appSource = fs.readFileSync(path.resolve(__dirname, '../public/js/app.js'), 'utf8');
  const stylesSource = fs.readFileSync(path.resolve(__dirname, '../public/css/styles.css'), 'utf8');
  assert(appSource.includes('Can execute a directional fell without binding'));
  assert(appSource.includes('tension, sharpen, lube, adjust carb'));
  assert(appSource.includes('<label>Admin-only comments<textarea name="private_comments">'));
  assert(!appSource.includes('<label>Private comments<textarea'), 'old private-comments label must not render');
  assert(appSource.includes("${isAdmin ? `"), 'admin-only comments fragment must be conditional');
  assert(appSource.includes("'admin-only-comments-help'"));
  assert(appSource.includes("'admin-only comments'"));
  assert(appSource.includes('Comments added here should be matter-of-fact basic but are only visible by other hut leaders and admins. Include here anything that other leaders would find useful regarding this volunteer for future work parties'));
  assert(appSource.includes("` : ''}"), 'non-admin branch must omit the comments fragment');
  assert(!appSource.includes('<label>Comments<textarea name="Comments">'), 'legacy Comments field must not render on Profile');
  assert(appSource.includes('aria-describedby="${id}"'));
  assert(appSource.includes('aria-controls="${id}"'));
  assert(appSource.includes('aria-expanded="false"'));
  assert(appSource.includes("event.key !== 'Escape'"));
  assert(appSource.includes("document.addEventListener('pointerover'"));
  assert(appSource.includes("document.addEventListener('focusin'"));
  assert(appSource.includes("document.addEventListener('click'"));
  assert(appSource.includes("if (isAdmin) {\n      payload.Admin"));
  assert(appSource.includes("payload.private_comments = fd.get('private_comments');"));
  assert(stylesSource.includes('.info-tooltip[hidden]'));
  assert(stylesSource.includes('.field-help-row'));
  assert(appSource.includes('Work party history'));
  assert(appSource.includes('Current ski trip reservation requests'));
  assert(appSource.includes('No past or pending work parties.'));
  assert(appSource.includes('No current ski trip reservation requests.'));
  assert(appSource.includes('renderProfileWorkPartyHistory(profile.workPartyHistory || [])'));
  assert(appSource.includes('renderProfileTripRequests(profile.requests || [])'));
  assert(stylesSource.includes('.profile-history-table-wrap'));

  const dbPath = makeTempDb();
  const store = new SqliteStore({ dbPath, importTsv: false });

  const requestor = store.upsertRequestor({
    Email: 'PROFILE.TEST@EXAMPLE.COM',
    first_name: 'Pat',
    last_name: 'Example',
    Credits: 4,
    has_a_chainsaw: true,
    chainsaw_user: false,
    private_comments: 'keep private',
    liability_waiver_date: '2026-01-02',
    liability_waiver_file: 'private-waiver.pdf',
    liability_waiver_submitted_at: '2026-01-01T00:00:00.000Z',
  });

  const noHistoryRequestor = store.upsertRequestor({ Email: 'NO.HISTORY@EXAMPLE.COM' });
  for (const workParty of [
    { Friday_check_in: '2025-08-22', Hut: 'Benson', Sunday_check_out: '2025-08-24', Leader: 'Past Leader' },
    { Friday_check_in: '2025-06-13', Hut: 'Grubb', Sunday_check_out: '2025-06-15', Leader: 'Older Leader' },
    { Friday_check_in: '2027-07-09', Hut: 'Bradley', Sunday_check_out: '2027-07-11', Leader: 'Pending Leader' },
    { Friday_check_in: '2027-08-06', Hut: 'Ludlow', Sunday_check_out: '2027-08-08', Leader: 'Accepted Leader' },
  ]) {
    store.upsertWorkParty({ ...workParty, Capacity: 8 });
  }
  store.saveWorkPartyInterests(requestor.Requestor_ID, [
    { Friday_check_in: '2025-08-22', Hut: 'Benson', Interest: 'please consider me', Confirmation_status: 'accepted', Attendance_status: 'full attended' },
    { Friday_check_in: '2025-06-13', Hut: 'Grubb', Interest: 'only if you need me', Confirmation_status: 'waitlisted', Attendance_status: 'cancelled' },
    { Friday_check_in: '2027-07-09', Hut: 'Bradley', Interest: 'please consider me', Confirmation_status: 'pending' },
    { Friday_check_in: '2027-08-06', Hut: 'Ludlow', Interest: 'please consider me', Confirmation_status: 'accepted' },
  ]);
  const workPartyHistory = store.getProfileWorkPartyHistory(requestor.Requestor_ID, '2026-07-16');
  assert.deepStrictEqual(
    workPartyHistory.map((row) => row.Hut),
    ['Bradley', 'Benson', 'Grubb'],
    'pending future work should be chronological, followed by newest past history'
  );
  assert.strictEqual(workPartyHistory[0].Accepted_status, 'pending');
  assert.strictEqual(workPartyHistory[1].Attendance_status, 'full attended');
  assert(!workPartyHistory.some((row) => row.Hut === 'Ludlow'), 'accepted future work should not appear');
  assert.deepStrictEqual(store.getProfileWorkPartyHistory(noHistoryRequestor.Requestor_ID, '2026-07-16'), []);

  store.updateRequestorById(requestor.Requestor_ID, {
    first_name: 'Updated',
    has_a_chainsaw: false,
    chainsaw_user: true,
    Credits: 99,
    Admin: true,
    private_comments: 'should stay hidden',
    liability_waiver_date: '2026-12-31',
  }, { allowAdminFields: false });

  const publicView = store.getRequestorById(requestor.Requestor_ID);
  assert.strictEqual(publicView.first_name, 'Updated');
  assert.strictEqual(publicView.has_a_chainsaw, false, 'experienced-user checkbox should persist independently');
  assert.strictEqual(publicView.chainsaw_user, true, 'owner/tuner checkbox should persist independently');
  const commentsIgnored = store.updateRequestorById(requestor.Requestor_ID, { Comments: 'legacy update' });
  assert.notStrictEqual(commentsIgnored.Comments, 'legacy update', 'legacy Comments field must not be user-editable');
  assert.strictEqual(publicView.Credits, 4, 'non-admin update must not change credits');
  assert.strictEqual(publicView.Admin, false, 'non-admin update must not change admin flag');
  assert(!Object.prototype.hasOwnProperty.call(publicView, 'private_comments'), 'private comments must be omitted');
  assert(!Object.prototype.hasOwnProperty.call(publicView, 'liability_waiver_date'), 'waiver date must be omitted');
  assert(!Object.prototype.hasOwnProperty.call(publicView, 'liability_waiver_file'), 'waiver file pointer must be omitted');
  assert(!Object.prototype.hasOwnProperty.call(publicView, 'liability_waiver_submitted_at'), 'waiver submitted timestamp must be omitted');

  const adminUpdated = store.updateRequestorById(requestor.Requestor_ID, {
    Credits: 7,
    Admin: true,
    private_comments: 'admin note',
    liability_waiver_date: '2026-12-31',
  }, { allowAdminFields: true, includePrivate: true });

  assert.strictEqual(adminUpdated.Credits, 7, 'admin update should persist credits');
  assert.strictEqual(adminUpdated.Admin, true, 'admin update should persist admin flag');
  assert.strictEqual(adminUpdated.private_comments, 'admin note');
  assert.strictEqual(adminUpdated.liability_waiver_date, '2026-12-31');

  const privateView = store.getRequestorById(requestor.Requestor_ID, { includePrivate: true });
  assert.strictEqual(privateView.private_comments, 'admin note');
  assert.strictEqual(privateView.liability_waiver_date, '2026-12-31');
  assert.strictEqual(privateView.liability_waiver_file, 'private-waiver.pdf');
  assert.strictEqual(privateView.liability_waiver_submitted_at, '2026-01-01T00:00:00.000Z');

  store.close();
  console.log('profile access test passed.');
}

run();
