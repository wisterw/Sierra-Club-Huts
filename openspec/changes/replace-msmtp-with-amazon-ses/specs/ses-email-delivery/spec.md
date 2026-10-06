## ADDED Requirements

### Requirement: Shared SES email delivery
The system SHALL send login codes and contention alerts through Amazon SES in `us-east-2` using the AWS SDK default credential provider chain. It SHALL preserve subjects, plain-text bodies, optional HTML bodies, recipient addresses, canonical links, and injected test transport support. It MUST NOT invoke MSMTP for delivery.

#### Scenario: Login email is submitted
- **WHEN** a login code is sent in SES mode
- **THEN** the system submits its existing subject and complete text to SES for the verified volunteer address

#### Scenario: Contention alert is submitted
- **WHEN** an eligible contention alert is sent in SES mode
- **THEN** SES receives both the existing plain-text and HTML versions for that recipient

### Requirement: Fixed sender identity
The system SHALL use `noreply@tahoe-ski-huts.rsvp` as the sender for all login and contention alert emails. It MUST NOT derive the sender from request headers or legacy sender environment overrides.

#### Scenario: Both mail types use the sender
- **WHEN** login and contention alert messages are composed with legacy sender overrides present
- **THEN** both messages use `noreply@tahoe-ski-huts.rsvp`

### Requirement: Explicit delivery mode
The system SHALL support `MAIL_TRANSPORT=ses` and `MAIL_TRANSPORT=console`, defaulting to SES in production and console otherwise. It MUST reject invalid values and production console mode. Console mode SHALL support local login-code output without AWS calls and MUST NOT record actual contention alerts as successfully sent. SES failures MUST NOT trigger console fallback. Dry-run previews and injected test transports SHALL remain usable without AWS access.

#### Scenario: Local login code
- **WHEN** a non-production login code is requested in console mode
- **THEN** the code is output locally without constructing an SES client or making an AWS request

#### Scenario: Production misconfiguration
- **WHEN** production is configured with console mode or an invalid mail mode
- **THEN** configuration validation rejects the setting

#### Scenario: Alerts cannot use console success
- **WHEN** an actual alert run uses console mode without an injected transport
- **THEN** the run fails before claiming recipients and records no successful send

#### Scenario: SES credentials fail
- **WHEN** an SES-mode login send fails to resolve credentials
- **THEN** the send reports failure and does not print the login code as fallback

### Requirement: Confirmed and uncertain provider outcomes
The system SHALL treat a returned SES message ID as provider acceptance, without claiming inbox delivery. Explicit SES rejection SHALL remain retryable for contention alerts. Timeouts, uncertain network failures, and missing message IDs SHALL remain ambiguous and MUST NOT advance successful alert history or cause automatic resend. The SES client MUST NOT automatically retry send requests. Mail delivery MUST remain outside SQLite write transactions.

#### Scenario: SES accepts an alert
- **WHEN** SES returns a message ID for an alert
- **THEN** the shared adapter reports acceptance and the worker records the sent snapshot using existing history rules

#### Scenario: SES explicitly rejects an alert
- **WHEN** SES returns a definitive rejection
- **THEN** the worker retains the alert for a later retry without advancing successful-send history

#### Scenario: Delivery is uncertain
- **WHEN** the SES request times out, encounters an uncertain network failure, or returns no message ID
- **THEN** the worker persists an ambiguous attempt for reconciliation without automatic resend
