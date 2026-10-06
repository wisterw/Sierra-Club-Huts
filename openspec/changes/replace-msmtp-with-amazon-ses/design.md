## Context

The CommonJS application sends login codes and contention alerts through a shared Nodemailer sendmail transport that invokes MSMTP. Login falls back to console output when the binary is absent. Contention alerts distinguish confirmed acceptance, definite rejection, and ambiguous delivery to prevent duplicate sends. The supplied `libs/ses.Client.js` uses ES modules and selects `us-east-2`; the AWS SDK dependency is not yet installed. Live SES delivery cannot be verified from the user's laptop.

## Goals / Non-Goals

**Goals:** Replace MSMTP for both mail paths, use the supplied AWS region and sender, preserve existing email content and alert accounting, and support offline local verification.

**Non-Goals:** Change authentication, email wording, alert eligibility, database schema, provision AWS resources, or perform a live send from the laptop.

## Decisions

### Use the supplied SES client through a shared adapter

Convert `libs/ses.Client.js` to CommonJS and retain `us-east-2` and the default AWS credential provider chain. Add `@aws-sdk/client-ses`. The adapter exposes the existing `sendMail(message)` contract and maps plain text and optional HTML to `SendEmailCommand`. It returns a normalized message ID and accepted recipient only after SES returns a message ID. This uses the starter client directly and avoids coupling the migration to a Nodemailer version upgrade or SESv2 transport. Retain or remove Nodemailer based on whether any other usages remain after implementation.

### Set one sender for both mail paths

Use `noreply@tahoe-ski-huts.rsvp` as the application's fixed sender for login and alerts; remove the old `LOGIN_EMAIL_FROM` and `CONTENTION_ALERT_FROM` overrides and update fixtures. Continue validating `APP_PUBLIC_URL` for production login links and alert links. AWS credentials remain outside source code.

### Make local delivery deliberate

Introduce `MAIL_TRANSPORT=ses|console`: default to SES in production and console outside production. Reject invalid values and reject console mode in production. Console mode prints login codes for local development, never constructs an SES client, and is not permitted for actual contention alert sends. Dry-run alert previews and injected test transports continue to work offline. Missing credentials or SES errors in SES mode must surface as failures, never switch silently to console output.

### Preserve uncertain delivery outcomes

Keep the alert timeout and ambiguous-attempt reconciliation behavior. Explicit SES rejection is a definite failure; network interruptions, timeouts, and responses without a message ID remain ambiguous. Disable SDK automatic retries for send operations (`maxAttempts: 1`) to avoid hidden duplicate sends after uncertain outcomes; the worker owns retries after definite failures. Unit tests must cover this boundary with an injected SES client and no AWS calls.

## Risks / Trade-offs

- Sender identity or IAM permissions may be missing in `us-east-2` → Document required SES identity and `ses:SendEmail` permission and let the user verify deployment.
- SES sandbox restrictions or quotas may prevent delivery → Include region-specific sandbox and quota checks in deployment instructions.
- SES acceptance does not prove inbox delivery → Treat message ID as provider acceptance; live verification includes checking receipt.
- Transient ambiguous sends require reconciliation → Preserve existing persisted ambiguous outcomes instead of automatic resend.
- Default local behavior changes from executable detection to environment mode → Update tests and document `MAIL_TRANSPORT` clearly.

## Migration Plan

1. Implement adapter, callers, dependencies, and configuration validation; update deployment instructions and legacy API documentation.
2. Verify payloads and failure outcomes with mocks, then run login and contention alert regression checks without live mail.
3. On the host, install dependencies, configure `NODE_ENV=production`, `MAIL_TRANSPORT=ses`, `APP_PUBLIC_URL`, and AWS credentials or role permissions. Verify the sender identity in `us-east-2`.
4. Restart and request one login code; the user checks receipt and server errors. Verify contention alerts through preview and a controlled eligible send before broad enablement.
5. Roll back to the prior application build and its MSMTP configuration if necessary. No database migration is needed; retain alert history and reconcile ambiguous attempts before retrying.

## Open Questions

No implementation decisions remain open. Sender verification, AWS permissions, sandbox status, and real receipt must be confirmed on deployment by the user.
