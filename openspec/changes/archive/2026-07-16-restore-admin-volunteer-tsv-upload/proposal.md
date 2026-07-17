## Why

The backend still supports bulk TSV requestor imports, but administrators no longer have a UI for it and the legacy import semantics can unintentionally erase existing data. Restoring a safe, discoverable workflow will make bulk volunteer onboarding practical again.

## What Changes

- Add an admin-only bulk volunteer TSV upload control under Manage volunteers/requestors.
- Add a link beside the upload control that downloads a sample TSV containing the basic header row: email, first name, last name, address, city, state, ZIP, and phone.
- Require an email column and a nonblank email for each imported row; make all other fields optional and allow unrecognized additional columns.
- Match supported headers case-insensitively and trim leading and trailing whitespace from headers and field values while preserving internal spaces.
- Create requestors for new emails and update existing requestors by case-insensitive email.
- Preserve an existing value when its corresponding TSV cell is blank or its column is omitted.
- Process imports atomically and return a useful created, updated, and skipped/error summary to the administrator.
- Refresh the Manage volunteers/requestors grid after a successful upload.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `admin-operations`: Define the safe TSV parsing, template download, validation, update-preservation, atomicity, and import-result behavior.
- `admin-volunteer-management`: Expose the bulk upload and sample-file controls within the Manage volunteers/requestors section and refresh the grid after import.

## Impact

- Admin API upload and sample-download routes in `src/routes/api.js`.
- Requestor upsert/import behavior in the SQLite data layer and TSV parsing utilities.
- Manage volunteers/requestors rendering, event wiring, and feedback in `public/js/app.js`.
- Admin volunteer-management and browser/API tests.
- No database schema change or new dependency is expected.
