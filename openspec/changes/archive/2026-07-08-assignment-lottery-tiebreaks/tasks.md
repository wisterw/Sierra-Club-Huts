## 1. Data Model

- [x] 1.1 Add `lottery_value` to requestor persistence and migration/backfill paths.
- [x] 1.2 Ensure import logic preserves existing requestor data while allowing nullable lottery values.
- [x] 1.3 Add tests covering requestor lottery value persistence and null initial state.

## 2. Assignment Logic

- [x] 2.1 Update assignment ordering to use lottery number as the final tiebreak instead of email.
- [x] 2.2 Add a code path that regenerates lottery numbers before assignment when requested.
- [x] 2.3 Preserve existing lottery values when the regeneration flag is false.
- [x] 2.4 Update assignment tests to cover deterministic lottery ordering and no-regeneration runs.

## 3. Admin Surface

- [x] 3.1 Add API support for the assignment regeneration flag and separate lottery regeneration action.
- [x] 3.2 Add an admin UI control for regenerating lottery numbers, defaulted on.
- [x] 3.3 Update any admin download or reporting behavior that should expose lottery values for audit/debugging.

## 4. Verification

- [x] 4.1 Add a focused test for the assignTrips lottery flag default behavior.
- [x] 4.2 Run the existing request summary and assignment regression checks after the algorithm change.
- [x] 4.3 Perform a smoke test of the admin assignment workflow with both regeneration-on and regeneration-off paths.
