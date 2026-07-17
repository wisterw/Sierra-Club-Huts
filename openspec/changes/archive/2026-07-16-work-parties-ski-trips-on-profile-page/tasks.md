## 1. Profile History Data

- [x] 1.1 Add a store query that returns one requestor's past and current/future pending work-party request records with work-party details, normalized statuses, and deterministic ordering
- [x] 1.2 Include the authorized profile target's work-party history in `/api/me` and `/api/requestor/:id` payloads without changing existing private-field shaping or cross-requestor authorization
- [x] 1.3 Add API/store tests for past inclusion, future pending inclusion, future non-pending exclusion, ordering, empty history, and admin versus non-admin profile access

## 2. Profile Presentation

- [x] 2.1 Render a read-only work-party history section below the profile form with hut, date, request/accepted/attendance details, and a clear empty state
- [x] 2.2 Render a read-only current ski-trip request section below work-party history using the profile target's existing requests, ordered by choice and showing huts, dates, spot counts, status, and a clear empty state
- [x] 2.3 Add accessible, responsive styling for both profile summary sections without introducing edit controls

## 3. Verification

- [x] 3.1 Add browser coverage confirming both sections and their empty states on a user's own profile
- [x] 3.2 Add browser coverage confirming an admin viewing another requestor sees that requestor's history and ski-trip requests
- [x] 3.3 Run the relevant profile, API, and browser smoke test suites and resolve regressions
