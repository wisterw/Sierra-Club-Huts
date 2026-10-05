## Context

The app already serves independently from Express with root-relative assets and `/api` routes. Its vanilla JavaScript frontend shows a login card, then toggles tab visibility without updating the URL. `applyModeUi()` currently selects a mode default during initialization, and logout returns to `/`. Email-code login supports existing requestors, including legacy email/code query parameters. The customer will continue manual work-party management and use Trip Request mode this year.

The pending Drupal embedding change is superseded for this release and retained as deferred planning. This change improves the existing full application rather than implementing that integration.

## Goals / Non-Goals

**Goals:**
- Explain volunteer trip requests before sign-in and guide existing volunteers through authentication.
- Give principal destinations stable URLs, reliable history behavior, and mode/role-aware access.
- Support independent mobile and desktop use with the existing request editor and availability summary.
- Document standalone deployment and administrator activation of Trip Request mode.

**Non-Goals:**
- Self-registration, public volunteer or request data, work-party browsing, iframe presentation, Drupal integration, or rebuilding a calendar.
- Removing work-party functionality, hiding existing profile history, changing the mode selector, or resetting persisted mode automatically.
- Changing request validation, credits, lottery/assignment behavior, API permissions, or introducing a new framework or schema.
- Bookmarking individual draft choices or every admin subsection.

## Decisions

### Extend the existing application shell

Retain Express and vanilla JavaScript. Revise the heading, introductory copy, sign-in instructions, and signed-in navigation to explain the trip-request purpose. Explain that preferences are requests rather than confirmed reservations and that an administrator must already have recorded the volunteer's email. Preserve generic code-send messaging and existing login behavior. A separate marketing site or frontend rewrite would add scope without helping the core workflow.

### Use pathname routes for principal destinations

Use `/trip-requests`, `/profile`, `/admin`, and `/work-parties`. `/` resolves to the current mode's default after authentication: Trip Requests, Work Parties, or Profile for inactive mode. The existing Express HTML fallback supports direct page loads; ensure `/api` and static resources continue to resolve correctly.

Centralize route parsing, mode/role validation, history updates, and tab rendering. User navigation adds history entries; normalization and fallback replace the current entry; `popstate` restores the view without adding entries. Unknown routes fall back to the authorized mode default. Existing tabs and disabled-state hover messages remain compatible with application-mode requirements. Accessible navigation identifies the current destination and provides visible keyboard focus.

Hash routing was considered, but pathnames give conventional shareable app URLs and fit the existing server fallback. No routing dependency is needed for four destinations.

### Resolve destinations after authentication and mode loading

Preserve a recognized requested pathname while showing sign-in. After `/me` and the persisted mode are loaded, prefer that destination if authorized and enabled; otherwise use the mode default with an explanation. A direct `/admin` visit never renders admin content for a non-admin. Profile remains available in all modes. Revalidate destinations after a mode change and on history navigation; URL navigation cannot override server authorization.

For authenticated API responses indicating session expiry, hide private views and show sign-in at the current recognized pathname. Preserve in-memory draft choices during reauthentication for the same requestor; never auto-save them and clear them if a different account signs in. A full refresh reloads saved records and does not promise durable draft recovery. Network failures and other server errors remain errors rather than being treated as sign-out. Explicit logout clears private client state and returns to `/`.

Use recognized same-app paths rather than accepting arbitrary return URLs. Preserve legacy email/code login links; consume their credentials through the existing mechanism and remove credential query parameters with history replacement after success or failure.

### Adapt layout without changing workflow semantics

Keep the request editor and availability view together on larger screens and stack them on smaller screens. Keep labels, choice controls, save feedback, and availability headings readable at narrow widths. Confine wide data tables to their own scroll containers rather than overflowing the page. Keep request/profile save feedback visible and keyboard accessible. Continue using existing styles and brand identity; no new image assets are required.

### Operate independently using the existing mode setting

Document root-mounted standalone hosting behind HTTPS, existing session/mail environment settings, volunteer import, and selecting Trip Request mode in Admin Application settings. Keep root-relative APIs/assets and host-only session cookies. The app does not require the `sierraclub.org` hostname, a Drupal namespace, or a parent document. Production activation belongs to an authorized administrator and is not performed by proposal creation or forced by deployment code.

## Risks / Trade-offs

- [Mode initialization overrides deep links] → Separate mode availability updates from final route resolution and verify every mode.
- [History navigation bypasses disabled tabs] → Use one destination guard for initialization, clicks, mode changes, and back/forward.
- [Reauthentication loses or crosses draft ownership] → Retain drafts only in memory for the same requestor, clear on logout/account change, and verify no automatic save.
- [Mobile tables are inherently wide] → Use labeled local scroll containers and verify that the surrounding page fits the viewport.
- [Old embedding change still appears in CLI listings] → Mark its proposal superseded and link the replacement; do not archive it as implemented.

## Migration Plan

1. Implement the shell, routing, authentication return behavior, and responsive refinements without changing database records or API contracts.
2. Run focused browser verification and relevant existing mode, trip-request, profile, admin-console, and smoke checks using an isolated database.
3. Deploy through the existing standalone hosting process and confirm direct links, assets, login email, session persistence, and mobile layout over HTTPS.
4. An administrator loads eligible volunteers as needed and selects Trip Request mode using the existing selector. Verify the normal trip-request journey.
5. Roll back by restoring the prior application build; saved requests, volunteer records, and persisted mode remain compatible. Any operational mode change is a separate administrator action.

## Open Questions

- Production hostname and coordinator contact copy can be supplied before deployment. Neither blocks implementation; avoid inventing a contact address or season deadline.
