## Why

Liability waiver handling is currently split between profile fields and an admin placeholder, so volunteers can be tracked as approved but there is no complete submit, store, review, and approval workflow. This change closes that gap for the current work-party year while keeping prior-year waiver files as retained filesystem artifacts rather than managed records.

## What Changes

- Add volunteer-facing blank waiver download and waiver submission actions from the requestor profile.
- Persist submitted waiver files in a dedicated server-side waiver storage location.
- Store the current-year waiver file pointer for each requestor and expose it only to admins.
- Add an admin liability waiver review queue showing current-year submitted waivers that need review.
- Allow admins to open/download a submitted waiver and mark it approved, updating the requestor liability waiver date.
- Keep existing `approved` waiver status language and year-based approval filtering.
- Do not add prior-year waiver management or deletion UI.

## Capabilities

### New Capabilities
- `liability-waiver-review`: Volunteer waiver submission, server-side waiver storage, admin review queue, and approval workflow.

### Modified Capabilities
- `requestor-profile`: Add waiver file submission/download behavior and expose the stored current-year waiver pointer only to admins.

## Impact

- Backend data store gains a current-year liability waiver file pointer for requestors.
- API gains endpoints for blank waiver download, waiver upload, submitted waiver download, and admin review/approval.
- Admin UI replaces the liability waiver placeholder with a functional review queue.
- Requestor profile UI gains download and submit links next to the waiver date.
- Tests should cover upload validation, admin-only access to submitted files, approval date updates, and non-admin privacy.
