## 1. Canonical Routing and Base Path

- [ ] 1.1 Add tested helpers that normalize hut names, build canonical `<hut-slug>_<YYYY_MM_DD>` stubs, parse the final date suffix, and reject malformed values.
- [ ] 1.2 Add store lookup and admin validation for canonical stubs, including missing, legacy-ambiguous, and create/update collision outcomes.
- [ ] 1.3 Add configurable application base-path handling so focused HTML, assets, and APIs operate consistently under `/lps/workparties` and supported local configurations.
- [ ] 1.4 Add direct canonical work-party routing with explicit not-found, ambiguous, removed, and unavailable responses.

## 2. Single-Party API and Session Security

- [ ] 2.1 Add an authenticated focused-work-party read endpoint that derives work-party identity from the canonical route and returns the current requestor's interest and statuses.
- [ ] 2.2 Add an authenticated single-interest save endpoint that derives both requestor and work party server-side and validates the allowed interest values.
- [ ] 2.3 Verify session cookie path, secure-cookie, forwarded-proxy, and seven-day session behavior under the production prefix.
- [ ] 2.4 Add same-origin framing headers and tests that permit the Drupal parent while preventing cross-origin framing.
- [ ] 2.5 Escape stored work-party and requestor values rendered by the focused page and add regression coverage for unsafe text.

## 3. Verified Volunteer Registration

- [ ] 3.1 Add persistent registration-challenge storage with normalized email, expiry, attempt/request controls, session binding, and single-use consumption.
- [ ] 3.2 Add a registration challenge endpoint that sends verification email for unknown addresses while preserving generic account-enumeration-resistant responses and returning existing users to normal login.
- [ ] 3.3 Add challenge verification with expiry, retry throttling, consumption, and session-bound pending-registration state.
- [ ] 3.4 Add minimal profile validation requiring first name, last name, and phone while accepting optional address, city, state, and ZIP.
- [ ] 3.5 Add atomic requestor creation for a verified email with non-admin and zero-credit defaults, including safe handling when the email is created concurrently.
- [ ] 3.6 Authenticate the newly created requestor, consume pending registration state, and restore the originally selected canonical work party.

## 4. Focused Browser Experience

- [ ] 4.1 Add a focused standalone page that loads one canonical work party and shows public context without exposing private status before authentication.
- [ ] 4.2 Add returning-user email-code login within the focused page and restore the selected form after successful authentication.
- [ ] 4.3 Add the unknown-user verification and minimal-profile steps within the focused page.
- [ ] 4.4 Render and save the three interest choices for only the selected party while displaying availability, accepted status, and attendance status as read-only.
- [ ] 4.5 Add `embed=1` compact presentation that removes redundant outer chrome without changing routing, authentication, data, or save behavior.
- [ ] 4.6 Make the focused presentation responsive for Drupal-controlled below-calendar and side-by-side iframe sizes.
- [ ] 4.7 Preserve authentication as named-iframe calendar links navigate between different canonical work-party URLs.

## 5. Verification and Deployment Contract

- [ ] 5.1 Add store and API tests for slug normalization, collisions, single-party authorization, identity tampering, interest persistence, and unavailable states.
- [ ] 5.2 Add authentication tests for unknown-email challenges, expiry, replay, throttling, session binding, profile validation, concurrent email creation, and successful onboarding.
- [ ] 5.3 Add browser tests for direct standalone access, embedded presentation, returning-user login, new-user registration, saved status, and switching calendar targets in one iframe session.
- [ ] 5.4 Add a prefixed reverse-proxy smoke test covering direct navigation, assets, APIs, forwarded HTTPS, cookies, and frame security headers.
- [ ] 5.5 Document the `/lps/workparties/*` proxy rule, required environment settings, Drupal named-link/iframe markup, parent content-security policy requirement, and staging verification procedure.
- [ ] 5.6 Run the complete existing and new automated test suites and resolve regressions before enabling Drupal calendar links.
