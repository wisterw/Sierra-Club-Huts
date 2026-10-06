## Why

Email delivery currently depends on an installed MSMTP executable and host relay configuration. Replace that dependency with Amazon SES using the supplied client and AWS region, so the deployed application sends mail directly through AWS.

## What Changes

- Send login codes and contention alerts through Amazon SES in `us-east-2`.
- Use `noreply@tahoe-ski-huts.rsvp` as the sender for both email types.
- Adapt `libs/ses.Client.js` to the application's CommonJS modules and add the AWS SES SDK dependency.
- Preserve message content, API behavior, injected test transports, and contention alert delivery accounting.
- **BREAKING**: Remove MSMTP configuration and executable detection; use explicit console delivery for development and tests, with SES as the production delivery mode.
- Document deployment configuration and separate local mocked verification from server-side live delivery verification.

## Capabilities

### New Capabilities

- `ses-email-delivery`: Shared SES delivery, sender and region configuration, explicit local console mode, and delivery outcome handling.

### Modified Capabilities

None. Existing login agreement and contention alert business requirements remain unchanged. The legacy `openspec/specs/API` document's MSMTP instructions must be updated during implementation to match the new delivery capability.

## Impact

Affected files include `libs/ses.Client.js`, `src/services/mailTransport.js`, `src/services/auth.js`, `src/services/contentionAlertWorker.js`, package manifests, email-related test fixtures, README deployment instructions, and the legacy API document. The deployment needs AWS credentials with SES send permission and a verified sender identity in `us-east-2`. No database or HTTP API changes are required. Real delivery will be verified by the user on the deployed host.
