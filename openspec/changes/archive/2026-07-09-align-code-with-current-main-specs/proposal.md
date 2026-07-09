## Why

The main OpenSpec documents now describe a broader application than the current implementation: relational persistence, application modes, work-party signup, expanded profile data, and richer trip-request administration. The code should be brought back into alignment so future changes build on the documented product rather than the older TSV-only trip-request workflow.

## What Changes

- Add a lightweight relational persistence layer for requestors, ski trip requests, work parties, work-party requests, and application settings while preserving a practical migration path from existing TSV data.
- Add persisted application modes for Work Party, Trip Request, and Inactive states, with admin controls and mode-aware tab behavior.
- Add Work Party user and API workflows for viewing current-year work parties and saving volunteer interest.
- Expand requestor profile support for chainsaw skills, other skills, private/admin comments, and liability waiver tracking.
- Align ski trip request storage and APIs with the current schema, including durable request IDs and combination-trip linkage.
- Reconcile admin reporting and assignment behavior with the current requirements, including full joined downloads, filters, efficiency reporting, and richer assignment audit details.

## Capabilities

### New Capabilities

- `relational-persistence`: Database-backed storage and migration for requestors, trip requests, work parties, work-party requests, and application settings.
- `application-mode`: Persisted app mode selection, admin mode management, and mode-aware user navigation.
- `work-party-signup`: End-user work-party listing, interest selection, status display, and persistence.
- `requestor-profile`: Requestor profile read/write behavior for the expanded requestor schema and admin-only fields.
- `trip-request-management`: Durable ski trip request management, validation, summary calculations, and combination-trip representation.
- `admin-operations`: Admin upload, download, assignment, efficiency report, and audit-oriented operational workflows.

### Modified Capabilities

- None. Existing OpenSpec files are broad source documents rather than capability-level specs, so this change introduces capability specs that encode the current requirements for implementation.

## Impact

- Backend storage moves from TSV-only persistence toward a lightweight relational database and data access boundary.
- API routes will expand to include app mode and work-party endpoints and will adjust trip/profile/admin behavior to match the new schema.
- Frontend navigation and forms will gain mode-aware tabs, Work Party views, expanded Profile fields, and updated Admin controls.
- Existing TSV fixtures and scripts may need migration utilities or compatibility import paths.
- Tests should expand from the current request-summary harness to cover persistence, validation, mode behavior, work-party flows, and assignment/reporting logic.
