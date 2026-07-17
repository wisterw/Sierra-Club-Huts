## Why

The end-user PRD requires each profile to show the requestor's work-party history and current ski-trip reservation requests, but the profile currently ends after its editable fields. Adding these summaries gives users and admins the promised request context without making them navigate to mode-specific tabs.

## What Changes

- Show a requestor's past work-party participation and current pending work-party requests below the profile fields.
- Show the requestor's current ski-trip reservation requests below the work-party history.
- Load history for the profile being viewed, including another requestor when an admin opens that person's profile.
- Present clear empty states when the requestor has no matching work parties or ski-trip requests.
- Keep both sections read-only; existing work-party and trip-request workflows remain responsible for edits.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `requestor-profile`: Extend the profile with read-only work-party history and current ski-trip reservation request sections for the requestor being viewed.

## Impact

- Profile rendering and profile data loading in `public/js/app.js`.
- Authenticated requestor API behavior in `src/routes/api.js` and supporting store queries in `src/data/sqliteStore.js` if existing endpoints cannot return another requestor's history safely.
- Profile-related automated tests and browser smoke coverage.
- No database schema change or new dependency is expected.
