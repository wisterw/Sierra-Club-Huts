## Context

The Huts application is currently a root-mounted Express single-page application. Its HTML, browser code, and API use root-relative `/css`, `/js`, and `/api` URLs, and its Work Party tab loads every current-year work party before saving all displayed selections. Authentication creates a seven-day `huts.sid` session only for an existing requestor.

The Loma Prieta Section Drupal site at `https://sierraclub.org` will remain responsible for the calendar and surrounding editorial content. A calendar event will target a reusable, named iframe below or beside the calendar. A reverse proxy above Drupal will route the Huts application's dedicated URL namespace to Express.

## Goals / Non-Goals

**Goals:**

- Give every work party a stable URL based on normalized hut name and Friday check-in date.
- Serve a focused form for one work party both directly and as a compact same-origin iframe.
- Preserve authentication and saved status as a visitor moves between calendar events.
- Onboard a previously unknown volunteer without creating a requestor until email ownership is verified.
- Isolate application routes, assets, and APIs from Drupal's namespaces.
- Make missing, ambiguous, closed, and removed work parties fail safely and clearly.

**Non-Goals:**

- Reimplement the Drupal calendar or control its responsive parent layout.
- Embed the full trip-request, profile, or admin application in Drupal.
- Introduce Drupal single sign-on or share Drupal identities with the Huts application.
- Allow cross-origin framing.
- Change work-party assignment or attendance rules.

## Decisions

### Use a dedicated, configurable base path

The production base path will be `/lps/workparties`. Express will serve the focused page, its assets, and its APIs below that base path, and browser URLs will be generated from the configured base rather than from root-relative constants.

Examples:

```text
/lps/workparties/benson_2026_09_18
/lps/workparties/assets/styles.css
/lps/workparties/assets/app.js
/lps/workparties/api/me
```

The reverse proxy can therefore route `/lps/workparties/*` to Express and leave all other paths with Drupal. A configurable base also permits local root or prefixed testing without production-specific source edits.

Alternative considered: continue using `/api`, `/css`, and `/js`. This is rejected because those global namespaces can collide with Drupal and make the proxy contract broader than the feature.

### Use a canonical stub with a date suffix

The final path segment will have the form `<hut-slug>_<YYYY_MM_DD>`. The parser will recognize the final date suffix and treat the preceding text as the hut slug, allowing multiword names such as `peter_grubb_2026_09_25`. Hut slugs will be lowercase ASCII, replace runs of non-alphanumeric characters with one underscore, and trim leading or trailing underscores.

Resolution will compare the canonical stub generated from stored hut and Friday date. No partial or fuzzy match will be used. Admin create/update validation will reject two work parties that would produce the same canonical stub. A legacy collision encountered at read time will produce an unavailable/ambiguous response rather than choosing a party.

Alternative considered: expose the database's composite key in the URL. Human-readable canonical stubs are better suited to Drupal calendar administration and remain independent of internal encoding.

### Make the canonical URL a focused standalone page

Direct navigation to a work-party URL will render the single-party experience with enough heading and session context to operate independently. Adding `?embed=1` will remove redundant outer presentation and size the document for an iframe; it will not change authorization, data, or save behavior.

An explicit query parameter is preferred over relying solely on `window.self !== window.top`, because it is deterministic in automated tests and can be inspected when troubleshooting. Framing without the parameter remains safe, but Drupal's integration contract will include it.

Drupal can use ordinary targeted links:

```html
<a href="/lps/workparties/benson_2026_09_18?embed=1"
   target="work-party-interest">Benson work party</a>
<iframe name="work-party-interest"
        title="Work party interest form"></iframe>
```

No parent-child messaging is required for the initial integration.

### Add a single-party lookup and save contract

The focused page will request a server-resolved work party by canonical stub. Once authenticated, the response will include that requestor's interest, accepted status, and attendance status. Saving will identify the work party from the route and accept one interest value; it will not trust a client-supplied hut, date, or requestor ID.

The existing current-year list API remains available to the standalone full application. The focused route will return explicit not-found, ambiguous, and unavailable responses suitable for a small child frame.

### Preserve same-origin session authentication

All iframe requests use `https://sierraclub.org`, so the existing host-only `huts.sid` cookie can be used across different work-party paths. Production will continue to use secure, HTTP-only cookies, trust the configured reverse proxy, and use `SameSite=Lax`. The cookie path must cover `/lps/workparties`.

Responses for the focused page will allow framing only by the same origin, using a `Content-Security-Policy` `frame-ancestors 'self'` directive (and compatible same-origin framing headers where deployed). Drupal's parent-page policy must also permit same-origin frames.

### Verify a new email before creating a requestor

The login form will preserve the current returning-user behavior. For an unknown email, the focused flow will offer registration while keeping generic responses where needed to avoid exposing whether an address already exists.

Registration will use a short-lived, single-use email challenge stored separately from requestors. Successful verification establishes a session-bound pending registration, but does not yet create a requestor. The volunteer then supplies:

- first name;
- last name;
- phone number.

Address, city, state, and ZIP remain optional and can be completed later through the profile. Submitting valid required fields creates a non-admin requestor with zero credits, authenticates that requestor in the current session, consumes the pending registration, and returns to the selected work-party form. Concurrent creation of the same normalized email will resolve to the existing account without overwriting its profile and will require the normal returning-user login path.

Challenge requests and verification attempts will be rate-limited, expire after approximately ten minutes, and use the same generic outward messaging principles as existing authentication.

Alternative considered: create an incomplete requestor before verification. This is rejected because mistyped or abusive email submissions would leave durable volunteer records.

### Keep status and registration context across iframe navigation

The session cookie carries authentication when a user selects another Drupal calendar link. The selected work party is derived anew from each iframe URL rather than stored as global session state, preventing two tabs or frames from changing each other's target. A pending registration may return to the originally requested canonical stub after profile completion.

## Risks / Trade-offs

- [Reverse proxy rewrites the prefix inconsistently] → Document one external base path, honor forwarded protocol/host, and add deployment smoke tests for HTML, assets, API, cookies, and direct navigation.
- [Drupal or proxy security headers block the iframe] → Verify both the Drupal parent `frame-src` policy and the child `frame-ancestors 'self'` policy in staging.
- [Canonical hut normalization creates collisions] → Reject new collisions and fail closed for legacy ambiguous stubs.
- [Self-registration can be abused for email or database spam] → Create no requestor before verification, rate-limit challenges and attempts, expire and consume challenges, and retain generic responses.
- [A compact iframe grows beyond its allocated space] → Keep the focused interface small and responsive; Drupal owns the iframe container dimensions. Automatic cross-document resizing is deferred.
- [The same application must still work locally] → Make the base path configurable and cover both root-mounted local and prefixed proxy operation in tests.
- [Existing templates insert work-party text as HTML] → Escape all stored work-party and requestor values rendered by the new focused surface.

## Migration Plan

1. Deploy the application with the new prefixed routes disabled or unreferenced while preserving the existing standalone root experience.
2. Configure staging proxy routing for `/lps/workparties/*`, forwarded headers, TLS, and session settings.
3. Verify direct, embedded, returning-user, new-user, invalid-stub, and multi-event session flows on `https://sierraclub.org`.
4. Add the named iframe and targeted calendar links in Drupal.
5. Monitor route, email challenge, registration, and save failures before expanding calendar links.

Rollback consists of removing or disabling the Drupal iframe links and proxy prefix route. Existing requestors and work-party requests remain compatible; verified registrations created before rollback remain ordinary requestors.

## Open Questions

- The Drupal administrator must choose the iframe name, initial empty-state markup, and responsive dimensions; these do not affect the application contract.
- Production rate-limit thresholds and retention time for expired registration challenges should be selected during implementation and documented in deployment configuration.
