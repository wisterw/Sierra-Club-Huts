## 1. Spec Foundation

- [x] 1.1 Add the trip-request-management capability spec to the change.
- [x] 1.2 Confirm the trip-request requirements cover validation, sequential choice renumbering, availability summaries, and combination-trip linkage.

## 2. Request Verification

- [x] 2.1 Implement or align request-save validation for date order, season bounds, trip length, hut selection, spot counts, and combination-trip rules.
- [x] 2.2 Ensure saved choice numbers are renumbered sequentially without changing relative order.
- [x] 2.3 Refresh `hut_count_flexibility` and `saturday_week_number` whenever a request changes.

## 3. Summary And Storage

- [x] 3.1 Verify the availability summary uses higher-priority spots, same-priority spots, and same-priority group counts.
- [x] 3.2 Verify combination trips continue to save as linked rows with contiguous dates.
- [x] 3.3 Update any request-related reporting or UI text that depends on the verification rules.

## 4. Verification

- [x] 4.1 Add tests for request validation failures and choice-number renumbering.
- [x] 4.2 Add tests for availability summary counts and combination-trip persistence.
- [x] 4.3 Run the request-summary and trip-request regression checks after the change.
