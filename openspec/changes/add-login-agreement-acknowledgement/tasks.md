## 1. Public agreement content

- [ ] 1.1 Add an allowlisted loader for both supplied documents, safe semantic rendering, last-updated labels, and content-derived version IDs using normalized UTF-8 source text.
- [ ] 1.2 Add public `/terms-of-use`, `/privacy-policy`, and `/api/agreements` routes ahead of the SPA fallback, serving one consistent document snapshot with current metadata caching disabled.

## 2. Acknowledgement persistence and code verification

- [ ] 2.1 Add backward-compatible SQLite document-snapshot and requestor-acknowledgement tables, version-pair uniqueness, server timestamps, and requestor-deletion cascade without fabricating existing-user acknowledgements.
- [ ] 2.2 Require the current `agreementVersions` pair in `/api/check-login`, reject missing/malformed or stale versions, persist acknowledgement only after valid code verification, and handle persistence/session-save failures without granting successful sign-in.
- [ ] 2.3 Keep acknowledgement records private and out of profile payloads and ordinary TSV downloads; retain historical document snapshots and first timestamps across repeated sign-ins.

## 3. Login presentation and navigation

- [ ] 3.1 Add the exact linked acknowledgement beside the code/Sign in action and persistent footer links, with accessible field/button associations, announced new-tab behavior, and mobile-readable layout.
- [ ] 3.2 Load current metadata before enabling Sign in, submit its version pair on explicit form submission, show retryable metadata errors, and recover from stale versions without automatically resubmitting.
- [ ] 3.3 Replace automatic legacy-link login with email/code or email/hash prefill and immediate credential URL cleanup; preserve authorized return destinations, existing-session behavior, and same-account suspended draft recovery.
- [ ] 3.4 Extend login-code email composition with the exact supplied risk/liability notice and labeled agreement URLs, using validated `APP_PUBLIC_URL` configuration while preserving code, expiry, subject, and existing relay behavior.

## 4. Verification and maintenance

- [ ] 4.1 Add isolated API/store tests for public documents, source fidelity, version changes, missing/stale acknowledgements, failed/expired codes, persistence failures, timestamp deduplication, historical snapshots, deletion cascade, and additive migration.
- [ ] 4.2 Update code-login fixtures to send current metadata and add browser tests for notice visibility, keyboard submission, both legacy link formats waiting for explicit Sign in, metadata/stale-version errors, and agreement links preserving form/draft context.
- [ ] 4.3 Visually verify both documents, footer, and login notice at mobile and desktop widths; run existing standalone, smoke, profile, mode, and migration regression checks using isolated data.
- [ ] 4.4 Document policy-file packaging, document revision/version behavior, private acknowledgement storage, `APP_PUBLIC_URL` for email links, the login API change, legacy-link behavior, and rollback compatibility in README.
- [ ] 4.5 Test composed emails through a captured/stubbed transport for exact notice wording, code/expiry preservation, canonical agreement links despite untrusted Host headers, and no acknowledgement on email sending; do not send test messages to real volunteers.
