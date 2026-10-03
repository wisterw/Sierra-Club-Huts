## ADDED Requirements

### Requirement: Unknown visitor can begin verified registration
The system SHALL allow a visitor whose normalized email is not associated with a requestor to request a short-lived email verification challenge without creating a requestor record.

#### Scenario: Unknown email requests verification
- **WHEN** a visitor submits a syntactically valid email that is not associated with a requestor
- **THEN** the system sends a time-limited verification challenge and does not yet create a requestor

#### Scenario: Existing email enters registration flow
- **WHEN** a visitor submits an email already associated with a requestor
- **THEN** the system preserves the existing requestor and directs the visitor through returning-user authentication without disclosing private account details

#### Scenario: Repeated challenge requests
- **WHEN** a visitor exceeds the configured challenge-request limit
- **THEN** the system throttles additional requests without creating requestors or revealing whether submitted emails exist

### Requirement: Registration requires verified email
The system MUST verify a valid, unexpired, single-use email challenge before accepting profile data that creates a requestor.

#### Scenario: Correct challenge
- **WHEN** a visitor submits the correct unexpired challenge for the pending email
- **THEN** the system establishes a session-bound pending registration for that verified email and consumes the challenge

#### Scenario: Incorrect or expired challenge
- **WHEN** a visitor submits an incorrect, already-used, or expired challenge
- **THEN** the system rejects verification without creating or authenticating a requestor

#### Scenario: Pending registration used from another session
- **WHEN** another browser session attempts to complete a pending registration
- **THEN** the system rejects completion and requires email verification in that session

### Requirement: Minimal volunteer profile capture
The system SHALL require first name, last name, and phone number to complete a verified registration, while allowing address, city, state, and ZIP to be omitted and completed later.

#### Scenario: Valid minimal profile
- **WHEN** a verified visitor supplies a valid first name, last name, and phone number
- **THEN** the system creates a non-admin requestor with the verified normalized email, zero credits, and the supplied profile values

#### Scenario: Required profile value missing
- **WHEN** a verified visitor omits first name, last name, or phone number
- **THEN** the system reports validation errors and does not create a requestor

#### Scenario: Email created concurrently
- **WHEN** the verified email becomes associated with an existing requestor before profile submission completes
- **THEN** the system does not overwrite that requestor and requires the returning-user authentication flow

### Requirement: Registration returns to selected work party
The system SHALL authenticate a newly created requestor in the current session and return the visitor to the work party selected before registration.

#### Scenario: Complete registration from a focused form
- **WHEN** a visitor completes registration after opening a canonical work-party URL
- **THEN** the system shows that same work party's interest form for the newly authenticated requestor

#### Scenario: Navigate to another party after registration
- **WHEN** the newly registered volunteer selects another Drupal calendar event
- **THEN** the next focused form recognizes the same authenticated requestor
