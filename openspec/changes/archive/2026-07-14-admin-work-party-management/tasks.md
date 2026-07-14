## 1. Data Store

- [x] 1.1 Add validation helpers for work-party identity, availability, dates, hut, and capacity.
- [x] 1.2 Add store methods to list current-year work parties for admin management.
- [x] 1.3 Add store method to create a work party and reject duplicate hut/date identities.
- [x] 1.4 Add store method to update non-key work-party fields while preserving hut and Friday check-in date.
- [x] 1.5 Add store method to delete a work party and rely on cascade removal of work-party requests.
- [x] 1.6 Add store method to return admin users as leader options with display name and contact fields.

## 2. API

- [x] 2.1 Add admin-only endpoint to return work-party management payload with work parties and leader options.
- [x] 2.2 Add admin-only endpoint to create a work party.
- [x] 2.3 Add admin-only endpoint to update an existing work party by immutable hut/date identity.
- [x] 2.4 Add admin-only endpoint to delete an existing work party by immutable hut/date identity.
- [x] 2.5 Return clear validation errors for duplicate, missing, or invalid work-party inputs.

## 3. User Interface

- [x] 3.1 Replace the Set up work parties placeholder with the admin work-party management screen.
- [x] 3.2 Render a current-year work-party list with edit and delete controls.
- [x] 3.3 Add a create/edit form with hut/date identity fields disabled while editing.
- [x] 3.4 Populate the leader selector from admin leader options and derive leader contact values when selected.
- [x] 3.5 Add delete confirmation before calling the delete endpoint.
- [x] 3.6 Refresh the admin list and end-user work-party list after create, update, or delete.

## 4. Verification

- [x] 4.1 Add store tests for create, duplicate rejection, immutable-key update, delete cascade, and leader options.
- [x] 4.2 Add API authorization and validation tests for admin work-party management endpoints.
- [x] 4.3 Add UI smoke coverage for the Set up work parties admin screen.
- [x] 4.4 Run OpenSpec validation for `admin-work-party-management`.
- [x] 4.5 Run relevant Node syntax checks and existing admin/work-party/smoke tests.
