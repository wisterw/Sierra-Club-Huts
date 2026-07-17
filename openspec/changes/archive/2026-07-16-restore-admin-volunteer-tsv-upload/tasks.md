## 1. Import Service

- [x] 1.1 Refactor requestor TSV parsing to normalize supported headers case-insensitively, trim surrounding whitespace, preserve internal whitespace, and ignore unknown columns
- [x] 1.2 Validate the Email header and every nonblank data row before persistence, enforce a bounded upload size, and produce sparse requestor updates that preserve blank or omitted existing values
- [x] 1.3 Execute all requestor upserts in one SQLite transaction and return separate created, updated, and skipped counts with useful validation or persistence errors
- [x] 1.4 Add an admin-only endpoint that downloads the basic-fields requestor TSV sample with the specified header order and attachment metadata

## 2. Admin Interface

- [x] 2.1 Add the upload control, sample-file link, and input-semantics guidance above the Manage volunteers/requestors grid
- [x] 2.2 Wire multipart upload submission, display success or error feedback, and refresh the volunteer grid only after a committed import

## 3. Verification

- [x] 3.1 Add API/data tests for authorization, email validation, case-insensitive headers and emails, whitespace handling, optional and extra columns, blank-value preservation, transaction rollback, summary counts, and sample download
- [x] 3.2 Add UI/browser tests for control placement, template download, successful feedback and grid refresh, and rejected-upload behavior
- [x] 3.3 Run the relevant admin volunteer-management and smoke test suites and resolve regressions
