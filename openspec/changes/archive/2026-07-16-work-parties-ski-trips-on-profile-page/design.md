## Context

The Profile tab renders a requestor returned by `/api/me` or `/api/requestor/:id`. Those payloads already contain the requestor's ski-trip `requests`, but the renderer does not display them. Work-party data is currently exposed only through a year-specific endpoint that returns every party for the year, including parties for which the requestor expressed no interest; it cannot provide a concise multi-year history.

The same profile renderer is used for a user viewing their own profile and for an admin viewing another requestor. Existing authorization on `/api/requestor/:id` already limits cross-requestor access to admins.

## Goals / Non-Goals

**Goals:**

- Add a read-only work-party history below the profile form, containing the requestor's past applications/participation and pending current or future applications.
- Add a read-only list of the requestor's current stored ski-trip requests below that history.
- Make the data describe the profile target, not always the signed-in user.
- Provide deterministic ordering and explicit empty states.
- Preserve existing profile authorization and private-field shaping.

**Non-Goals:**

- Editing work-party interest, assignment status, attendance, or ski-trip requests from the Profile tab.
- Changing the database schema, application-mode behavior, or existing Work Party and Trip Request tabs.
- Adding historical ski-trip archival; the current data model treats the requestor's stored request rows as the current request set.

## Decisions

### Include profile history in the requestor payload

Extend `requestorPayload` with a `workPartyHistory` array while continuing to use its existing `requests` array for ski trips. This keeps profile rendering to one authorized request and ensures an admin viewing another requestor receives data for that target. A separate browser call to `/work-parties` was considered, but that endpoint is year-scoped and includes unselected parties, so it does not represent history cleanly.

### Query only meaningful work-party request records

Add a store query that joins `work_party_requests` to `work_parties` for one requestor. Include all dated past request records and current or future records whose accepted status remains pending. Return the work-party identity, dates, interest, accepted status, attendance status, and leader needed for a useful read-only summary. Sort newest past records first and current/future pending records chronologically so the most relevant entries are easy to find.

### Render summaries rather than reuse editable controls

Add semantic headings and compact tables/lists after the profile form. Work-party rows show hut/date and recorded statuses; ski-trip rows show choice, huts, dates, requested party size, and request status using the existing request fields. Both sections show a plain-language empty state when their arrays are empty. Reusing the editable trip cards or work-party controls was rejected because it would blur the PRD's history/summary purpose and introduce mutation behavior on Profile.

### Retain existing authorization boundaries

History is assembled only after `/me` or `/requestor/:id` has resolved an authorized target. No endpoint will accept an unchecked requestor identifier, and the history fields contain operational request data rather than admin-only profile fields. Existing response shaping for private comments and waiver data remains unchanged.

## Risks / Trade-offs

- [The phrase "current pending" depends on status normalization] → Reuse the store's accepted-status normalization and cover pending, accepted/attended past, empty-state, and admin-target cases in tests.
- [Older imported work-party requests may reference a missing work-party definition] → Use a join strategy that retains the request identity fields and renders missing optional metadata safely.
- [Profile payloads become larger] → Data remains scoped to one requestor and consists of small summary rows; avoid returning unrelated work parties.
- [Date-relative tests can become brittle] → Seed dates relative to the test clock or clearly past/future fixed boundaries and assert ordering independently.
