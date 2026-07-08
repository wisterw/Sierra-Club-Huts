## Why

The assignment spec now says lottery numbers, not email address, should be the final tiebreak. It also separates lottery-number generation from the assignment run itself, which means the code and admin surface need to match the updated wording before more work depends on the old behavior.

## What Changes

- **BREAKING** Replace email-address ordering as the final assignment tiebreak with the lowest lottery number.
- Add a separate admin-controlled action to regenerate requestor lottery numbers before running assignment.
- Make the assignment endpoint support an optional flag for lottery regeneration, defaulting to true.
- Persist `lottery_value` on requestors so assignment can use stable, repeatable tie-breaking data.
- Update admin UI, API behavior, and reporting so lottery generation is explicit rather than implied by assignment execution.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `admin-operations`: Assignment must use lottery number as the final tiebreak, and admins need a separate lottery-regeneration action plus an assignment flag that controls whether numbers are refreshed.
- `relational-persistence`: Requestors now persist `lottery_value` so assignment can use stored lottery numbers across runs and test data.

## Impact

- Assignment algorithm ordering changes in the backend.
- Admin endpoints and admin UI need a lottery-regeneration control separate from assignment.
- Requestor persistence/schema must include `lottery_value`.
- Assignment tests and any seed data that assumed email ordering will need updates.
