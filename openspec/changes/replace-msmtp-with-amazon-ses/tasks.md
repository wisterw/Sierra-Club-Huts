## 1. SES transport

- [x] 1.1 Add `@aws-sdk/client-ses` and update the lockfile; convert `libs/ses.Client.js` to CommonJS while retaining `us-east-2`, default credentials, and disabling automatic send retries.
- [x] 1.2 Replace the MSMTP transport with an injectable SES adapter implementing `sendMail`, mapping text and HTML, and normalizing confirmed acceptance and definite or ambiguous failures.
- [x] 1.3 Implement delivery-mode validation for `MAIL_TRANSPORT=ses|console`, production SES default, non-production console default, and rejection of production console mode.

## 2. Integrate mail callers

- [x] 2.1 Set `noreply@tahoe-ski-huts.rsvp` for login and alert messages and remove legacy sender overrides.
- [x] 2.2 Update login configuration validation and sending to remove executable detection, preserve explicit local code output and injected transports, and surface SES failures without fallback.
- [x] 2.3 Update alert worker and scheduler transport creation to reject console sending before claims while preserving previews, injected transports, timeout behavior, and persisted delivery outcomes.
- [x] 2.4 Remove remaining MSMTP production dependencies and remove Nodemailer if unused.

## 3. Local verification

- [x] 3.1 Add mocked SES checks for region/client configuration, fixed sender, login text, alert HTML and text, successful message ID, explicit rejection, absent message ID, and uncertain network failure without AWS calls.
- [x] 3.2 Verify delivery-mode defaults and validation, local login output without SES initialization, no SES failure fallback, and no console alert success.
- [x] 3.3 Update legacy MSMTP test fixtures and run login agreement, contention persistence, and contention alert regressions plus syntax checks for changed JavaScript.

## 4. Documentation and handoff

- [x] 4.1 Replace README and legacy `openspec/specs/API` MSMTP instructions with SES setup, fixed sender, `us-east-2`, credential/permission requirements, mail modes, and preserved alert reconciliation instructions.
- [x] 4.2 Document the user's host-side verification steps for sender identity, sandbox restrictions, login receipt, controlled alert receipt, and rollback; clearly state that live SES delivery remains unverified locally.
