## 1. Persistence Foundation

- [x] 1.1 Select and add the SQLite dependency and database configuration paths.
- [x] 1.2 Create schema initialization for requestors, ski trip requests, work parties, work-party requests, and settings.
- [x] 1.3 Add repository modules for requestors, trip requests, work parties, settings, and admin reporting.
- [x] 1.4 Add a TSV import/migration utility for existing requestors and requests data.
- [x] 1.5 Add migration tests covering valid imports, invalid headers, and restart persistence.

## 2. Route Migration

- [x] 2.1 Replace direct `TsvStore` usage in authentication routes with repository calls.
- [x] 2.2 Replace requestor/profile routes with repository-backed reads and writes.
- [x] 2.3 Replace trip request save and summary routes with repository-backed request data.
- [x] 2.4 Replace admin upload, download, assignment, and efficiency routes with repository-backed behavior.
- [x] 2.5 Keep existing endpoint response shapes compatible unless a spec requires new fields.

## 3. Application Mode

- [x] 3.1 Implement settings storage for `work-party`, `trip-request`, and `inactive` application modes.
- [x] 3.2 Add authenticated API reads for current mode and admin-only API writes for changing mode.
- [x] 3.3 Add Admin UI controls for viewing and changing the application mode.
- [x] 3.4 Update frontend tab behavior so Work Party, Trip Request, and Inactive modes enable, disable, and default tabs according to the spec.
- [x] 3.5 Add tests for persisted mode, non-admin rejection, and mode-aware tab data returned to the frontend.

## 4. Requestor Profile

- [x] 4.1 Expand requestor persistence to include chainsaw fields, other skills, private comments, and liability waiver date.
- [x] 4.2 Update requestor upload/import handling for expanded requestor fields where present.
- [x] 4.3 Update profile API response shaping so non-admin users never receive private/admin-only fields.
- [x] 4.4 Update Profile UI to display and save user-editable expanded fields.
- [x] 4.5 Update Admin-facing profile behavior so admins can edit admin-only requestor fields.
- [x] 4.6 Add tests for user edits, admin-only edits, and private field exposure.

## 5. Trip Request Management

- [x] 5.1 Add durable `Request_ID` support and preserve request IDs across edits.
- [x] 5.2 Implement transactional save behavior for replacing and renumbering a user's choices.
- [x] 5.3 Store combination trips as linked segment rows using `Combination_first_request`.
- [x] 5.4 Align backend validation with all current trip request rules, including combination constraints.
- [x] 5.5 Ensure calculated fields update whenever trip requests change.
- [x] 5.6 Update frontend request mapping and save behavior to preserve durable IDs and combination linkage.
- [x] 5.7 Add tests for validation, renumbering, calculated fields, combination trips, and summary math.

## 6. Work Party Signup

- [x] 6.1 Implement work party and work-party request repositories.
- [x] 6.2 Add authenticated work-party API endpoints for current-year listing and interest saves.
- [x] 6.3 Add Work Party tab markup and client logic for chronological cards, interest radios, read-only availability, and user status.
- [x] 6.4 Add save behavior for all visible work-party interest changes.
- [x] 6.5 Add tests for listing, saving interest, missing-record `no thank you` behavior, and end-user read-only fields.

## 7. Admin Operations and Assignment

- [x] 7.1 Update joined request download to include all required requestor and request fields from the database.
- [x] 7.2 Implement all required joined download filters and sorting rules.
- [x] 7.3 Extend assignment to follow the documented preference order as closely as the available data supports.
- [x] 7.4 Mark requests that cannot be fulfilled as `lost-lottery` and lower-priority choices skipped because a higher-priority choice was fulfilled as `not-used`.
- [x] 7.5 Record assignment audit information for each granted request.
- [x] 7.6 Update efficiency report to include first choice, second choice, later choices, and no-choice outcomes for groups and spots.
- [x] 7.7 Add deterministic assignment/reporting tests using seeded data, including `lost-lottery` and `not-used` outcomes.

## 8. Verification and Documentation

- [x] 8.1 Update developer documentation for database setup, migration/import, and rollback.
- [x] 8.2 Update user/admin documentation for application modes, Work Party, Profile, and Admin workflows.
- [x] 8.3 Run the existing request summary test and the new persistence, API, and reporting tests.
- [x] 8.4 Perform a browser smoke test for login, mode switching, trip requests, work-party signup, profile, and admin operations.
