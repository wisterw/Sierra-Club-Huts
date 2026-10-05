## Why

This year's customer priority is volunteer ski-trip requests; work-party management will continue through the existing manual process. The Huts application needs a complete standalone experience that explains its purpose, supports existing volunteers, and works independently of Drupal or an iframe.

## What Changes

- Provide a welcoming sign-in page explaining volunteer trip preferences, availability, and existing email-code authentication for administrator-loaded volunteers.
- Provide persistent, accessible navigation with bookmarkable Trip Requests, Profile, and authorized Admin destinations, including refresh and browser back/forward support.
- Preserve the intended destination through sign-in and session expiry, subject to role and application-mode checks.
- Make the sign-in, request editor, availability view, profile, and admin navigation usable on mobile and desktop.
- Document standalone HTTPS hosting and this year's operational selection of Trip Request mode through the existing admin selector.
- Supersede `embed-work-party-signup-in-drupal` as the current delivery direction. Its iframe, Drupal proxy, public work-party browsing, and self-registration work is deferred.
- Retain work-party functionality and all three persisted modes; retain current trip validation, preference ordering, availability calculations, assignment rules, and profile permissions.

## Capabilities

### New Capabilities

- `standalone-app-experience`: Purposeful sign-in, URL-addressable navigation, authentication return destinations, responsive standalone presentation, and independent deployment guidance.

### Modified Capabilities

None. Existing application-mode and workflow requirements remain in force; the new shell respects them.

## Impact

- Affects `public/index.html`, `public/js/app.js`, `public/css/styles.css`, standalone page routing in `src/server.js` as needed, browser verification, and README deployment/user guidance.
- Uses the existing Express application, APIs, email-code authentication, requestor import, and admin mode selector. No new identity provider, frontend framework, database migration, or Drupal dependency is planned.
- No application implementation is included in this proposal. Production mode selection is an explicit administrator operation, not a reset of stored mode on startup.
