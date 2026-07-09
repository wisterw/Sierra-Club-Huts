## Why

Trip request validation and request-summary behavior are already implemented in code, but the requirements are not yet captured as a formal spec in the main OpenSpec set. That makes it harder to verify the request save flow, combination-trip behavior, and calculated request fields consistently across UI, API, and persistence.

## What Changes

- Add a trip-request-management capability that formally specifies request validation, sequential choice renumbering, availability summary behavior, and combination-trip linkage.
- Clarify the save-time rules for date order, season bounds, trip length, hut selection, spot counts, and combination-trip constraints.
- Define how `hut_count_flexibility` and `saturday_week_number` must be refreshed when a request changes.
- Define how combined Benson/Bradley traverse trips are represented as linked rows.

## Capabilities

### New Capabilities
- `trip-request-management`: request verification, request-summary calculation, sequential choice renumbering, and combination-trip storage rules.

### Modified Capabilities
- None.

## Impact

Affected areas include the trip-request front end, request save and summary API behavior, request persistence, and the regression tests that cover validation and combination-trip handling.
