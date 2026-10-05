## 1. Placeholder persistence and access

- [x] 1.1 Add default-false placeholder flag and unique reservation-reference associations; preserve existing people/requests and expose identifiable admin exports.
- [x] 1.2 Restrict flag management to reservation operations and generate unique non-deliverable placeholder identities with one linked logical first-choice request each (including traverse legs).
- [x] 1.3 Exclude placeholders from code generation, mail/debug delivery, code/hash login and protected sessions; cover old credentials and forged profile/import fields.
- [x] 1.4 Exclude placeholders from all contention send paths while retaining their competitive demand and real-volunteer impacts.

## 2. Reservation import and administration

- [x] 2.1 Implement shared TSV parser for upload/paste and sample download with required reference/name/hut/dates/guests, optional traverse date and private notes, bounded payloads and row-specific validation errors.
- [x] 2.2 Implement transactional create/update by stable reference, fixed minimum/ideal counts, duplicate-reference detection and final combined hut-night capacity checks; refresh contention once and roll back failures.
- [x] 2.3 Add admin reservation listing and atomic removal with ownership checks, preserving omitted reservations and unrelated volunteer records.
- [x] 2.4 Add Admin Existing reservations UI for upload, paste, sample, list, result counts, errors and removal; keep placeholders separate from volunteer management.

## 3. Demand and allocation integration

- [x] 3.1 Implement shared effective placeholder priority above ordinary credits for availability, contention, alert snapshots and allocation, with safe-integer checks and later-credit-increase coverage.
- [x] 3.2 Validate placeholder feasibility before solving, preserve one-award behavior and deterministic placeholder lottery values, and verify all feasible fixed bookings precede ordinary awards.
- [x] 3.3 Advance allocation policy to v3 and include placeholder flag/reference changes in fingerprints; preserve history and reject results invalidated by concurrent imports/removals.
- [x] 3.4 Label existing reservation occupancy in volunteer availability without private identities/notes; separate placeholder metrics from volunteer fairness statistics and retain total occupied person-nights.

## 4. Verification and documentation

- [x] 4.1 Verify migration/restart, upload/paste parity, repeat import identity preservation, named ordinary/traverse bookings, partial/full bookings, checkout boundaries, conflict rollback and deletion using isolated databases.
- [x] 4.2 Verify authentication/email exclusions with fake relays, pending alerts, and normal login/alert regressions; confirm real recipients retain quiet-period behavior.
- [x] 4.3 Extend allocation oracle/persistence tests for fixed placeholder priority, ordinary credit changes, invalid legacy bookings, stale versions, unchanged history and concurrent reservation edits.
- [x] 4.4 Run browser/admin/import and allocation/contention regressions; benchmark representative allocations including placeholders and confirm no optimizer runs on edits/import.
- [x] 4.5 Document sample format, stable reference semantics, season/stay limits, warning-based overlap behavior, operational priority, metric changes and rollback precautions.
