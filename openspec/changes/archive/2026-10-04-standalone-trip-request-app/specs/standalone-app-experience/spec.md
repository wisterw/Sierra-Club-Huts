## ADDED Requirements

### Requirement: Standalone sign-in introduction
The system SHALL present an independently usable sign-in page identifying Sierra Club ski hut volunteer trip requests, explaining preference submission and availability review, distinguishing requests from confirmed reservations, and explaining email-code login for volunteers already recorded by an administrator. The page SHALL retain generic code-send responses and SHALL NOT expose private records or offer self-registration.

#### Scenario: Existing volunteer arrives signed out
- **WHEN** a signed-out visitor opens the app
- **THEN** the page explains its trip-request purpose and how to request and enter an emailed code without requiring surrounding website content

### Requirement: URL-addressable principal navigation
The system SHALL provide `/trip-requests`, `/profile`, `/admin`, and `/work-parties` destinations with persistent navigation after sign-in. Direct loading, refresh, and browser back/forward SHALL restore the corresponding authorized, mode-enabled destination. Navigation SHALL identify the current destination and support keyboard use.

#### Scenario: Profile link is refreshed
- **WHEN** an authenticated volunteer opens or refreshes `/profile`
- **THEN** the app displays that volunteer's profile and identifies Profile as the current destination

#### Scenario: Browser history restores a destination
- **WHEN** a volunteer navigates from Trip Requests to Profile and uses Back then Forward
- **THEN** the app restores Trip Requests then Profile without creating additional history entries

### Requirement: Destination access follows existing roles and modes
The system SHALL apply existing application-mode and role requirements to all navigation, including direct URLs and history navigation. Root and unknown paths SHALL resolve to Trip Requests in Trip Request mode, Work Parties in Work Party mode, and Profile in Inactive mode after authentication. Unavailable or unauthorized destinations SHALL fall back to the authorized mode default with an explanation. Profile SHALL remain available in every mode, and Admin SHALL remain restricted to administrators.

#### Scenario: Work-party URL in Trip Request mode
- **WHEN** an authenticated volunteer opens `/work-parties` in Trip Request mode
- **THEN** the app selects Trip Requests and explains that work-party selection is unavailable

#### Scenario: Non-admin opens Admin URL
- **WHEN** a non-admin opens `/admin`
- **THEN** the app shows the authorized mode default and an access explanation without rendering admin content

#### Scenario: Administrator changes mode
- **WHEN** an administrator changes the mode while the current destination becomes unavailable
- **THEN** the app resolves to an available destination and subsequent navigation obeys the saved mode

#### Scenario: Existing seasonal workflows remain available
- **WHEN** an administrator selects Work Party mode or Inactive mode and the application restarts
- **THEN** the existing persisted mode, default destination, disabled workflow tabs, and Profile availability remain effective

### Requirement: Authentication preserves safe destination context
The system SHALL preserve a recognized app destination through sign-in and session expiry, rechecking role and mode after authentication. Session expiry SHALL hide private views and offer sign-in, while network and non-authentication errors SHALL remain distinguishable from session expiry. Explicit logout SHALL clear private client state and return to the signed-out root page. Destination handling SHALL NOT redirect to arbitrary external URLs.

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
- **WHEN** a visitor opens an existing email/code or email/hash login link
- **THEN** the app retains existing login compatibility and removes credential query parameters from the current URL after the attempt

### Requirement: Responsive standalone workflow
The system SHALL support sign-in, trip-request editing, availability review, Profile, and authorized Admin navigation on mobile and desktop. At a 360 CSS-pixel viewport width, the page SHALL fit the viewport, forms and primary actions SHALL remain usable, and wide tables SHALL scroll within their own containers. Keyboard focus and current navigation state SHALL be visible.

#### Scenario: Volunteer edits requests on a phone
- **WHEN** a volunteer opens Trip Requests at a 360 CSS-pixel viewport width
- **THEN** request controls, save feedback, and availability context remain readable and usable without page-wide horizontal scrolling

#### Scenario: Volunteer navigates by keyboard
- **WHEN** a volunteer uses keyboard navigation to switch destinations and operate sign-in or save controls
- **THEN** focus is visible and controls expose accessible names and the current destination

### Requirement: Independent deployment and seasonal activation guidance
The project SHALL document standalone HTTPS deployment using existing API, session, mail, and requestor-import facilities and selection of Trip Request mode through Admin Application settings. Operation SHALL NOT depend on Drupal, an iframe, or a Drupal-specific URL prefix. Deployment SHALL preserve the saved application mode rather than forcing Trip Request mode at startup.

#### Scenario: Operator deploys this year's app
- **WHEN** an operator follows the standalone deployment guidance
- **THEN** the guidance covers direct page links, assets, email-code delivery, session settings, eligible volunteer loading, and administrator selection of Trip Request mode

#### Scenario: Deployment preserves an existing mode
- **WHEN** a deployment restarts an installation with a previously saved mode
- **THEN** that mode remains selected until an administrator changes it
