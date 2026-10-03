## ADDED Requirements

### Requirement: Canonical work-party URL
The system SHALL expose each work party at `/lps/workparties/<hut-slug>_<YYYY_MM_DD>`, where the slug is derived deterministically from the hut name and the date is its Friday check-in date.

#### Scenario: Resolve a single-word hut
- **WHEN** a visitor opens `/lps/workparties/benson_2026_09_18`
- **THEN** the system resolves the Benson work party whose Friday check-in date is September 18, 2026

#### Scenario: Resolve a multiword hut
- **WHEN** a visitor opens `/lps/workparties/peter_grubb_2026_09_25`
- **THEN** the system treats `peter_grubb` as the hut slug and resolves the work party dated September 25, 2026

#### Scenario: Reject a malformed stub
- **WHEN** a visitor opens a work-party path without a valid final `_YYYY_MM_DD` suffix
- **THEN** the system displays a work-party-not-found state without exposing another work party

#### Scenario: Prevent canonical collision
- **WHEN** an admin attempts to create or rename work-party data so that two parties would have the same canonical stub
- **THEN** the system rejects the change and preserves the existing work parties

### Requirement: Focused standalone presentation
The system SHALL render the canonical work-party URL as an independently usable page scoped to the resolved work party.

#### Scenario: Open canonical URL directly
- **WHEN** a visitor navigates directly to a valid canonical work-party URL without an embed parameter
- **THEN** the system shows the authentication or single-party interest experience with sufficient heading and session controls to operate outside Drupal

### Requirement: Same-origin iframe presentation
The system SHALL support a compact iframe presentation when the canonical work-party URL contains `embed=1`, without changing the selected work party, authentication rules, data, or save behavior.

#### Scenario: Drupal targets the child frame
- **WHEN** a Drupal calendar link targets a named iframe with a valid canonical URL containing `embed=1`
- **THEN** the iframe shows the compact interest experience for that work party

#### Scenario: Select another calendar event
- **WHEN** an authenticated visitor activates a second calendar link targeting the same iframe
- **THEN** the child frame navigates to the second work party and retains the authenticated session

#### Scenario: Cross-origin site attempts framing
- **WHEN** a page from an origin other than the application's `sierraclub.org` origin attempts to frame the focused page
- **THEN** the focused page's framing policy prevents it from being embedded

### Requirement: Proxy-isolated application namespace
The system MUST serve focused pages, browser assets, and API requests within the configured `/lps/workparties` namespace without requiring ownership of Drupal's root-level `/api`, `/css`, or `/js` paths.

#### Scenario: Load through the production prefix
- **WHEN** the reverse proxy sends a canonical work-party request to the application
- **THEN** the returned page loads all required assets and APIs from paths inside `/lps/workparties`

#### Scenario: Run with a configured local base
- **WHEN** the application is started with a supported local base-path configuration
- **THEN** focused routing, assets, and APIs use that configured base consistently

### Requirement: Explicit unavailable states
The system SHALL display a clear, non-editable state when a canonical stub is missing, ambiguous, removed, or unavailable for signup.

#### Scenario: Work party was removed
- **WHEN** a previously published canonical URL no longer identifies a stored work party
- **THEN** the page reports that the work party is unavailable and does not show a different party's form

#### Scenario: Legacy canonical collision
- **WHEN** more than one stored work party resolves to the requested canonical stub
- **THEN** the system fails closed with an unavailable state and does not select either party
