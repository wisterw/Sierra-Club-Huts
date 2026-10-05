# login-agreements Specification

## Purpose

Define login agreements behavior for the volunteer hut reservation application.

## Requirements

### Requirement: Public supplied agreement documents
The system SHALL provide `/terms-of-use` and `/privacy-policy` as public, independently reachable pages displaying the complete corresponding supplied source text from `openspec/specs/TERMS OF USE.md` and `openspec/specs/PRIVACY POLICY.md`. It SHALL preserve substantive wording and last-updated dates, render source text safely, and keep both documents readable on mobile and desktop without authentication.

#### Scenario: Signed-out visitor reads agreements
- **WHEN** a visitor directly opens either agreement URL without a session
- **THEN** the corresponding complete document and its supplied last-updated date are displayed without login or private data requests

#### Scenario: Agreement content remains faithful
- **WHEN** the supplied documents are rendered
- **THEN** all sections, bullet content, contact details, and named policy references remain present without substantive additions or omissions

### Requirement: Accessible acknowledgement at code submission
The login form SHALL display "By entering your code and logging in, you explicitly acknowledge that you have read and agree to our Privacy Policy and Terms of Use, including the Backcountry Assumption of Risk and absolute limitation of liability." beside the code field and immediately before the Sign in button. The document names SHALL link to the corresponding public pages. The code input and submit action SHALL be programmatically associated with this notice. The notice SHALL appear for every code sign-in, including administrators and session reauthentication, without requiring an extra checkbox.

#### Scenario: Volunteer submits a code
- **WHEN** a volunteer reaches the code field and Sign in action
- **THEN** the linked acknowledgement is visible before submission and available through assistive technology

#### Scenario: Keyboard submission acknowledges the displayed pair
- **WHEN** a volunteer submits the login form using the keyboard after entering a code
- **THEN** the same displayed agreement-version pair is submitted as for activation of the Sign in button

#### Scenario: Volunteer requests a code only
- **WHEN** a visitor requests an email code or enters code digits without submitting Sign in
- **THEN** the app neither authenticates the visitor nor records acknowledgement

### Requirement: Agreement links preserve app context
The system SHALL offer both agreement links on the sign-in form and in a persistent footer visible to signed-out and signed-in users. Reading an agreement SHALL NOT submit credentials or discard the original tab's login destination, entered form values, or suspended trip drafts. Links that open new tabs SHALL announce this behavior accessibly.

#### Scenario: Volunteer reads a document before signing in
- **WHEN** a volunteer follows an agreement link from the login form
- **THEN** the document opens separately and the original tab retains the form and intended destination awaiting explicit sign-in

#### Scenario: Signed-in volunteer reviews documents
- **WHEN** a signed-in volunteer opens either footer agreement link
- **THEN** the document is readable while the original app tab and session remain intact

### Requirement: Current agreement versions are required for code authentication
The system SHALL expose public metadata for the current pair of documents, derive distinct version IDs from their normalized complete content, and require matching `termsOfUse` and `privacyPolicy` IDs in an `agreementVersions` object submitted to `/api/check-login`. It SHALL NOT grant a new code-authenticated session when acknowledgement is absent, malformed, or stale. The form SHALL disable Sign in until metadata is available and SHALL require a fresh intentional submit after stale-version recovery.

#### Scenario: Code verification lacks acknowledgement
- **WHEN** a client submits a login code without both required document-version IDs
- **THEN** the API rejects the request with a missing-acknowledgement response and creates no authenticated session or acknowledgement record

#### Scenario: Document content has changed
- **WHEN** a client submits a version pair that differs from the server's current pair
- **THEN** the API rejects sign-in as stale and the browser refreshes document metadata, explains the update, and waits for another explicit submission

#### Scenario: Agreement metadata is unavailable
- **WHEN** current agreement metadata cannot be loaded
- **THEN** Sign in remains disabled and the form shows a clear retryable error instead of submitting an implicit acknowledgement

### Requirement: Private versioned acknowledgement persistence
After successful code verification with current agreement versions, the system SHALL durably associate the authenticated requestor with the two document versions and a server UTC first-acknowledged timestamp before granting a session. It SHALL preserve immutable document content for referenced versions, keep one record per requestor/version pair, and reject sign-in if persistence fails. It SHALL NOT create acknowledgement records for failed codes, expose them through public APIs, profiles, or ordinary requestor exports, or add IP-address/user-agent tracking. Deleting a requestor SHALL delete their acknowledgement rows.

#### Scenario: First valid sign-in for a document pair
- **WHEN** an existing volunteer successfully verifies a code with the current document versions for the first time
- **THEN** the system stores the requestor association, version pair, and server timestamp and then grants the session

#### Scenario: Same versions acknowledged again
- **WHEN** a volunteer successfully signs in again with an already acknowledged version pair
- **THEN** the notice remains present and the original first-acknowledged timestamp remains unchanged

#### Scenario: Revised documents acknowledged
- **WHEN** a volunteer successfully signs in with a new current version pair
- **THEN** a new pair-specific record is stored while earlier records and referenced document snapshots are preserved

#### Scenario: Invalid or expired code
- **WHEN** a visitor submits an invalid or expired code with current document versions
- **THEN** generic authentication failure behavior remains in force and no acknowledgement is stored

### Requirement: Login-code email acknowledgement notice
Every login-code email sent by the system SHALL retain the login code and expiry information and include exactly: "By using this code to log into the web app, you agree to our Terms of Use and Privacy Policy. Because these requests are for backcountry ski huts, logging in constitutes your explicit acceptance of the inherent risks of backcountry travel (such as avalanche, hypothermia, and lack of emergency services) and our volunteer limitation of liability." The email SHALL include labeled absolute links to both agreement pages using a configured canonical app origin, without trusting request Host headers. Sending, delivering, or reading the email SHALL NOT itself create an acknowledgement record.

#### Scenario: Login code is emailed
- **WHEN** the system sends an emailed login code for an existing volunteer
- **THEN** the email contains the code, expiry information, the complete supplied notice, and public Terms of Use and Privacy Policy URLs

#### Scenario: Email links use the configured application origin
- **WHEN** an email is composed from a request with a different or untrusted Host header
- **THEN** its agreement links still use the configured canonical app origin

#### Scenario: Email has not been used to sign in
- **WHEN** a volunteer receives or reads the login-code email without completing code verification
- **THEN** no agreement acknowledgement is recorded

### Requirement: Existing sessions remain compatible
The system SHALL preserve existing authenticated sessions and SHALL NOT fabricate historical acknowledgements or force sign-out when this change or a document revision is deployed. The linked acknowledgement SHALL apply on the next explicit code sign-in, with existing role, mode, destination, and draft-ownership guards still effective.

#### Scenario: Existing session resumes after rollout
- **WHEN** a volunteer with a valid session opens the app after this feature is deployed
- **THEN** normal authorized navigation resumes without forced code entry or a fabricated acknowledgement record
