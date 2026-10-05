## MODIFIED Requirements

### Requirement: Authentication preserves safe destination context
The system SHALL preserve a recognized app destination through sign-in and session expiry, rechecking role and mode after authentication. Session expiry SHALL hide private views and offer sign-in, while network and non-authentication errors SHALL remain distinguishable from session expiry. Explicit logout SHALL clear private client state and return to the signed-out root page. Destination handling SHALL NOT redirect to arbitrary external URLs. Code-bearing legacy login links SHALL prefill the signed-out form and require explicit Sign in submission after displaying the linked Terms of Use and Privacy Policy acknowledgement; they SHALL NOT automatically authenticate a signed-out visitor.

#### Scenario: Sign-in returns to Profile
- **WHEN** a signed-out volunteer opens `/profile` and completes email-code sign-in
- **THEN** the app opens Profile rather than replacing it with the mode default

#### Scenario: Session expires during editing
- **WHEN** an authenticated API operation reports session expiry while a volunteer has unsaved choices
- **THEN** the app hides private views and offers sign-in while retaining draft choices in memory for that same requestor

#### Scenario: Same volunteer reauthenticates
- **WHEN** the same requestor signs in again without a full page reload after session expiry
- **THEN** the app restores the authorized destination and retained draft choices without saving them automatically

#### Scenario: A different volunteer signs in
- **WHEN** another requestor signs in after session expiry
- **THEN** the app discards the previous requestor's drafts and displays only the newly authenticated requestor's records

#### Scenario: Legacy login link is used
- **WHEN** a signed-out visitor opens an existing email/code or email/hash login link
- **THEN** the app prefills the corresponding email and code, promptly removes credential query parameters from the current URL, and displays the linked agreement notice while waiting for explicit Sign in submission

#### Scenario: Legacy link is submitted intentionally
- **WHEN** a visitor submits the prefilled login form after the agreement notice is displayed
- **THEN** the app verifies the code with current agreement versions and returns the authenticated visitor to the authorized requested destination

#### Scenario: Existing session opens a code-bearing link
- **WHEN** a visitor with a valid existing session opens a legacy code-bearing login link
- **THEN** the existing session remains active, credential query parameters are removed, and the app does not record a new acknowledgement merely from link navigation
