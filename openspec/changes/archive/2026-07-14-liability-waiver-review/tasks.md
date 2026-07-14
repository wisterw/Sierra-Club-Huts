## 1. Data and File Storage

- [x] 1.1 Add requestor fields for the current liability waiver file pointer and submitted timestamp.
- [x] 1.2 Add startup migration logic for the new waiver pointer fields.
- [x] 1.3 Add a dedicated waiver storage directory initializer.
- [x] 1.4 Implement helpers to write uploaded waiver files using safe generated filenames.
- [x] 1.5 Implement helpers to resolve stored waiver file pointers only within the waiver storage directory.

## 2. API

- [x] 2.1 Add an authenticated blank liability waiver download endpoint.
- [x] 2.2 Add an authenticated current-user waiver upload endpoint with file type and size validation.
- [x] 2.3 Add admin-only waiver review queue and submitted-waiver download endpoints.
- [x] 2.4 Update admin waiver approval to require a current submitted waiver file before setting the liability waiver date.
- [x] 2.5 Keep submitted waiver pointers and filesystem paths out of non-admin profile responses.

## 3. User Interface

- [x] 3.1 Add blank waiver download and submit controls next to the profile liability waiver date.
- [x] 3.2 Show the user a confirmation message after a successful waiver submission.
- [x] 3.3 Replace the admin Review liability waivers placeholder with a current-year review queue.
- [x] 3.4 Add admin actions to download/open a submitted waiver and approve it.
- [x] 3.5 Refresh the waiver review queue after approval.

## 4. Verification

- [x] 4.1 Add service tests for waiver pointer migration, upload storage, replacement uploads, and safe file resolution.
- [x] 4.2 Add API tests for upload validation, admin-only file access, non-admin privacy, and approval requirements.
- [x] 4.3 Add UI smoke coverage for profile waiver controls and the admin review queue.
- [x] 4.4 Run OpenSpec validation for `liability-waiver-review`.
- [x] 4.5 Run relevant Node syntax checks and existing smoke/profile/admin tests.
