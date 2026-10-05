## Why

Volunteers who are away from the app cannot see when another volunteer's requests put their leading remaining choice at risk. Send focused, delayed alerts that follow their remaining choices while avoiding emails to the editor and repeated notifications about the same condition.

## What Changes

- Evaluate contention alerts every two hours, with a one-hour quiet period for changes affecting each recipient's alert.
- Track the authenticated actor and before/after choice state during relevant mutations, and persist recipient notification/awareness history.
- Follow the highest-ranking remaining choice, advancing after previously communicated losses; combine multiple newly losing choices into one email.
- Notify impacted volunteers rather than the volunteer making the change; one change can queue independent alerts for several other groups.
- Provide lottery, bumped-with-remaining-choice, and bumped-with-no-remaining-choice emails containing full inline trip details and an edit link.
- Suppress duplicates, update successful-send timestamps only on confirmed relay acceptance, and retain eligible failures for a later run.
- Use current contention estimates without presenting competing preferences as finalized reservations.

## Capabilities

### New Capabilities

- `contention-alert-notifications`: Impact attribution, choice progression, quiet-period batching, email content, persistent deduplication, scheduling, and delivery handling.

### Modified Capabilities

None. This capability builds on the completed `track-trip-request-contention` change and its internal successful-send recording boundary. Existing contention classification and assignment rules remain unchanged.

## Impact

- SQLite notification/awareness records, mutation actor context, and contention-refresh impact capture.
- Request save and credit upload/update routes, including admin edits on another volunteer's behalf.
- A scheduled alert worker and shared mail relay support, canonical app links, deployment enable/disable configuration, and dry-run tooling.
- Deterministic tests for multiple recipients, sequential/combined losses, self-edit suppression, races, failures, and duplicate prevention. Test transports capture messages; no live emails are needed for validation.
