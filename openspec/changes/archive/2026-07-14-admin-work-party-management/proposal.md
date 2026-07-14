## Why

Admins need a real Set up work parties workflow instead of a placeholder so leaders can maintain the current-year work-party schedule without editing the database directly. This completes the admin-side counterpart to the existing volunteer signup and volunteer management workflows.

## What Changes

- Replace the Set up work parties admin placeholder with a current-year work-party management screen.
- Show a read-only list of current-year work parties with hut, Friday check-in date, Sunday check-out date, leader, leader email/phone, capacity, comments, and availability.
- Add an admin form for creating a work party.
- Allow admins to edit existing work-party details while keeping hut and Friday check-in date immutable after creation.
- Allow admins to delete a work party, with a confirmation step before removing the work party and its volunteer applications.
- Populate the leader selector from admin users and derive leader email from the selected admin.
- Preserve the automatic `open` to `waitlist-only` status transition for new volunteer applicants; admin edits may set availability explicitly.

## Capabilities

### New Capabilities
- `admin-work-party-management`: Admin create, edit, list, and delete workflow for work parties.

### Modified Capabilities
- `work-party-signup`: End-user work-party lists reflect admin-created, edited, and deleted work parties.

## Impact

- Backend data store needs list/create/update/delete helpers for work parties and admin leader options.
- API gains admin-only work-party management endpoints.
- Admin UI replaces the Set up work parties placeholder with a list and edit/create form.
- Existing work-party signup UI reads the updated work-party records through the existing list endpoint.
- Tests should cover admin-only access, immutable keys on edit, deletion behavior, leader option population, and signup list consistency.
