## Context

The root-mounted Express app renders a public email/code login form followed by an authenticated shell. `/api/check-login` verifies the existing volunteer's emailed code and establishes a seven-day session. The browser currently automatically submits credentials from `email` plus `code` or `hash` query parameters. There are no public policy pages or acknowledgement records.

The user supplied two plain-text Markdown-named documents: `openspec/specs/TERMS OF USE.md` and `openspec/specs/PRIVACY POLICY.md`. Both display October 4, 2026 as their last-updated date. They are content sources, not OpenSpec capability specifications. Their wording is to be published as supplied, not rewritten as part of this implementation.

## Goals / Non-Goals

**Goals:**
- Make both complete documents readable without authentication and available throughout the app.
- Connect agreement to the intentional action of submitting an emailed code through Sign in, with prominent linked wording and accessible association.
- Preserve guarded return destinations and same-account draft recovery while preventing automatic URL-based acknowledgement.
- Store minimal, version-specific evidence after successful code verification and require the current pair at the API boundary.

**Non-Goals:**
- Additional agreement checkbox, self-registration, revising supplied legal wording, third-party consent services, or a claim of legal enforceability.
- Forcing sign-out or blocking an existing authenticated session, introducing a full consent-management console, or collecting IP addresses/user agents as acknowledgement evidence.
- Changing code expiry, volunteer eligibility, reservation rules, or session duration.

## Decisions

### Serve two explicit public document routes

Add `/terms-of-use` and `/privacy-policy` handlers before the SPA fallback. Load only the two allowlisted source files at server startup, normalize UTF-8 BOM and line endings, and render escaped text as semantic headings, paragraphs, and bullet lists. Preserve every substantive sentence, contact address, named external policy reference, and displayed date. Do not invent external policy URLs absent from the supplied documents. No arbitrary Markdown HTML execution or directory serving is needed.

Use the app stylesheet and a simple return link. These document pages do not initialize the authenticated application, attempt login, or call private APIs. Footer links and sign-in links open a separate tab with `rel="noopener"` and an accessible indication that a new tab opens, preserving the original form, destination, and in-memory draft recovery. A same-tab document link was considered but risks losing unsaved recovery state; a modal would make direct links and long-document reading harder.

### Place notice at the actual sign-in action

Within the login form, between the code field and Sign in button, display exactly: "By entering your code and logging in, you explicitly acknowledge that you have read and agree to our Privacy Policy and Terms of Use, including the Backcountry Assumption of Risk and absolute limitation of liability." Link the two document names. Associate the code field and submit button with the notice using `aria-describedby`. Keep the text readable at 360 CSS pixels, visible in normal layout, and present for both ordinary login and expired-session reauthentication.

Typing a code or requesting an email alone does not authenticate or create an acknowledgement. The submit action, including keyboard form submission, carries the current displayed document-version pair. This matches the user's requested acknowledgement without adding another checkbox or an unrelated registration step.

### Include the supplied acknowledgement in login-code emails

Retain the current plain-text email, subject, emailed code, ten-minute expiry text, and existing mail relay. Append exactly:

"By using this code to log into the web app, you agree to our Terms of Use and Privacy Policy. Because these requests are for backcountry ski huts, logging in constitutes your explicit acceptance of the inherent risks of backcountry travel (such as avalanche, hypothermia, and lack of emergency services) and our volunteer limitation of liability."

Follow the notice with labeled absolute Terms of Use and Privacy Policy URLs. Add a validated `APP_PUBLIC_URL` canonical origin for email links, using HTTPS in production and a localhost origin with the configured port in development. Require production configuration when the login-email relay is enabled, and never construct email links from an untrusted request Host header. Existing `PUBLIC_HOST` and `PUBLIC_SCHEME` remain logging settings. Sending or receiving the email does not record acknowledgement; the intentional code-login action still does that.

Extract message composition into a testable helper and capture its output with a stubbed transport, verifying exact notice text and links without sending mail to real volunteers. An HTML-only message was considered unnecessary because the existing transport sends plain text and labeled URLs remain readable across clients.

### Prefill legacy login links without submitting them

Replace `tryAutoLoginFromUrl()` with credential-prefill behavior: capture recognized query credentials, populate the signed-out form, promptly remove `email`, `code`, and `hash` from the URL, and wait for explicit submit. Keep the recognized pathname for return navigation. Existing authenticated sessions remain active and merely have credential parameters removed; opening a link is not treated as fresh agreement. This intentionally changes the legacy-link scenario in `standalone-app-experience`.

Automatic authentication was rejected because it can establish a session before the acknowledgement is presented. No code-verification route or browser path may supply implicit agreement merely because credentials are present in the URL.

### Verify current versions and store minimal acknowledgement

Expose public `/api/agreements` metadata containing the two titles, routes, last-updated labels, and server-generated version IDs. Use SHA-256 of each normalized complete source document so wording changes are detected even when dates are identical. Render public pages from the same startup-loaded content, and disable caching of current metadata/pages so clients do not retain obsolete versions across deployments.

The form obtains metadata before enabling Sign in. `/api/check-login` requires an `agreementVersions` object with matching `termsOfUse` and `privacyPolicy` IDs. Missing/malformed acknowledgement produces a clear 400 response; a stale pair produces 409 without establishing a session. Refresh the notice's metadata after a stale response, explain that documents changed, and require another explicit submit; never automatically retry acceptance. Invalid/expired codes retain generic authentication failure behavior.

Add additive SQLite tables for immutable document snapshots (type, content hash, complete source text) and requestor acknowledgements (requestor ID, terms version, privacy version, server UTC timestamp). Keep one first-acknowledged record per requestor/version pair using a uniqueness constraint, rather than creating a tracking event for every login. Subsequent sign-ins still show the notice and validate the current pair, but leave the first timestamp unchanged. New pairs retain previous records and snapshots. No IP address, browser fingerprint, or duplicate email is stored.

Record acknowledgement only after successful credential verification and before granting the session; fail sign-in if recording fails. A session-save error must return a failure rather than reporting success. Document snapshots remain available for interpreting historical hashes. Keep acknowledgement data out of profile payloads and ordinary TSV downloads; deleting a requestor cascades their acknowledgement rows. No public endpoint lists acknowledgements.

Persisting only a boolean was considered but cannot identify which supplied text the volunteer acknowledged. Recording every attempt was rejected because failed authentication and code requests are not agreement actions and additional tracking is unnecessary.

## Risks / Trade-offs

- [Old clients submit code without versions] → Explicitly update first-party browser code and all code-login API fixtures together; return a clear missing-acknowledgement error.
- [Cached form carries older versions] → Reject stale metadata, reload it, and require a new intentional submit.
- [Policy files are omitted from a deployment] → Fail startup with a specific configuration error rather than serve a notice with inaccessible documents; document packaging both source files.
- [Source edits drift from rendered documents] → Compare rendered text against normalized source content and hash the same immutable startup content.
- [New-tab links are surprising to assistive-technology users] → Announce the new-tab behavior in accessible link descriptions and test keyboard/touch access.

## Migration Plan

1. Add document serving and metadata, additive snapshot/acknowledgement schema, API checks, updated login presentation, and login-email notice in the same release.
2. Deploy both supplied source files with the application and configure `APP_PUBLIC_URL` for production email links. Existing requestors and sessions have no fabricated acceptance records and remain usable under the existing session rules.
3. Update authentication test clients, run focused API/browser/migration tests and existing standalone regression checks with isolated data, and verify both public pages on mobile/desktop.
4. On next code sign-in, volunteers acknowledge the current pair. Revisions to source text create new version IDs on restart and are acknowledged on future code sign-ins; active sessions are not forcibly invalidated.
5. Rollback restores the prior application build while retaining additive database tables and existing records. Document that the prior build does not enforce the new acknowledgement; do not delete historical records during rollback.

## Open Questions

None blocking the proposal. Use the supplied wording and dates without inventing document revisions or external policy links.
