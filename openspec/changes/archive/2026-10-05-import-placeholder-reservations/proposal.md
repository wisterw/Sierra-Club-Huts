## Why

Existing hut reservations need to consume capacity before volunteers submit and receive new trips. Admins currently cannot import these reservations, and manually creating ordinary volunteer accounts risks login and contention emails reaching artificial accounts.

## What Changes

- Add a persistent requestor placeholder flag, defaulting to false for existing volunteers. Placeholders cannot log in or receive login or contention emails.
- Add an admin reservation TSV upload, sample download, and paste option. Each reservation automatically receives its own placeholder requestor and one first-choice request for a specific hut (or, in the case of a combination trip, huts) with fixed guest counts, check-in date, traverse date (in the case of a combination trip), and check-out date.
 - we will want to be able to include the name under which the base reservation is made so that later we can remember what it was for.  Support this name field in the TSV upload and store it in the name of the placeholder requestor.
- Give placeholder reservations precedence over ordinary volunteer allocation while retaining one awarded trip per requestor. Reject conflicting placeholder reservations rather than silently losing a booking.
- Use imported requests in existing availability and contention calculations; label their demand as existing reservations. Importing does not run assignment or send invitations.
- Support stable reservation references so reimporting updates existing records without duplicates; provide admin listing and removal.

## Capabilities

### New Capabilities

- `placeholder-reservations`: Placeholder identity, email and login exclusion, admin reservation import and lifecycle, and integration with demand and allocation.

### Modified Capabilities

None. The new capability adds requirements at the existing integration points without replacing ordinary volunteer workflows.

## Impact

SQLite requestor migration and serializers; admin UI and import APIs; authentication/session checks; contention alert eligibility; availability summaries; allocation normalization, policy identity, fingerprints, and reports. Depends on the completed allocation optimization and fairness changes; sync/archive those before this change. No external service or new dependency is expected. General admin editing of another ordinary volunteer's requests and hard prohibition of overlapping volunteer submissions are outside scope.
