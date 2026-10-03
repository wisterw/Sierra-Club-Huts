## Why

Work-party visitors currently have to use the full standalone Huts application even when they arrive from a specific event in the Loma Prieta Section Drupal calendar. Providing a same-origin, single-party interest form lets Drupal retain the calendar and surrounding content while visitors authenticate or register, record interest, and review their status in context.

## What Changes

- Add canonical work-party URLs under `/lps/workparties/<hut-slug>_<YYYY_MM_DD>` that resolve one work party by normalized hut name and Friday check-in date.
- Support both a directly reachable standalone presentation and a compact `?embed=1` presentation suitable for a reusable iframe below or beside the Drupal calendar.
- Scope the form, status display, and save operation to the work party identified by the URL.
- Keep application pages, assets, and APIs within the `/lps/workparties/` reverse-proxy namespace so they do not collide with Drupal routes.
- Allow returning volunteers to use the existing email-code authentication and retain their session while navigating between calendar events.
- Add verified-email self-registration and minimal profile capture for people who are not already requestors, followed by submission of their work-party interest.
- Provide explicit invalid, unavailable, and removed work-party states.

## Capabilities

### New Capabilities

- `drupal-work-party-embedding`: Canonical single-work-party URLs, standalone and iframe presentations, proxy-safe resource routing, and the Drupal calendar-to-child-frame integration contract.
- `volunteer-self-registration`: Verified-email onboarding and minimal requestor data capture for a new work-party volunteer.

### Modified Capabilities

- `work-party-signup`: Allow viewing and saving interest for one URL-selected work party while showing the authenticated volunteer's current status.

## Impact

- Affects Express routing and session configuration, browser initialization and rendering, work-party API routing, static asset paths, requestor creation, email-code authentication, and automated browser/API tests.
- Establishes a deployment contract with the reverse proxy and Drupal at `https://sierraclub.org/lps/workparties/*`.
- Requires Drupal calendar links to target a named same-origin iframe using the canonical work-party URL with `?embed=1`.
