# requestor-profile Specification

## Purpose
TBD - created by archiving change align-code-with-current-main-specs. Update Purpose after archive.
## Requirements
### Requirement: Expanded profile fields
The system SHALL support profile fields for email, first name, last name, address, city, state, ZIP, phone, chainsaw user, chainsaw owner/tuner, other skills, admin flag, credits, years of service, private comments, liability waiver date, and current liability waiver file pointer. The obsolete general Comments field SHALL NOT be displayed or accepted as a profile update.

#### Scenario: User views own profile
- **WHEN** a non-admin authenticated user opens the Profile tab
- **THEN** the system displays user-editable profile fields including Other skills, omits the obsolete general Comments field, displays liability waiver download and submit actions, and does not render admin-only private fields, their labels, their help controls, or the waiver file pointer

#### Scenario: Admin views profile
- **WHEN** an admin opens a requestor profile
- **THEN** the system displays the private-comments field with the label "Admin-only comments," may include other admin-only fields and the current liability waiver file pointer, and omits the obsolete general Comments field

#### Scenario: Client submits obsolete comments field
- **WHEN** a client includes the obsolete general Comments field in a profile update
- **THEN** the system ignores that field while processing supported profile fields

### Requirement: Accessible chainsaw field help
The system SHALL display a contextual information control beside each chainsaw-related field on the Profile tab and SHALL make its field-specific help available through pointer hover, keyboard focus, and click or touch activation.

#### Scenario: User requests experienced chainsaw user help
- **WHEN** a user hovers over, focuses, or activates the information control beside "I am an experienced chainsaw user"
- **THEN** the system displays "Can execute a directional fell without binding"

#### Scenario: User requests chainsaw owner and tuner help
- **WHEN** a user hovers over, focuses, or activates the information control beside "I own a chainsaw and know how to tune it"
- **THEN** the system displays "tension, sharpen, lube, adjust carb"

#### Scenario: User interacts with chainsaw help independently
- **WHEN** a user opens or closes either chainsaw information control
- **THEN** the associated checkbox value remains unchanged

#### Scenario: Assistive technology identifies chainsaw help
- **WHEN** assistive technology encounters a chainsaw information control
- **THEN** the control has an accessible name and a programmatic association with its help content

### Requirement: Accessible admin-only comments help
The system SHALL display a contextual information control beside the "Admin-only comments" field and SHALL make the guidance "Comments added here should be matter-of-fact basic but are only visible by other hut leaders and admins. Include here anything that other leaders would find useful regarding this volunteer for future work parties" available through pointer hover, keyboard focus, and click or touch activation.

#### Scenario: Admin requests comments guidance
- **WHEN** an admin hovers over, focuses, or activates the information control beside "Admin-only comments"
- **THEN** the system displays the admin-only comments guidance

#### Scenario: Assistive technology identifies comments help
- **WHEN** assistive technology encounters the admin-only comments information control
- **THEN** the control has an accessible name and a programmatic association with its help content

#### Scenario: Non-admin views profile
- **WHEN** a non-admin opens the Profile tab
- **THEN** the admin-only comments label, information control, help content, and input are absent from the rendered page

### Requirement: User-editable profile fields
The system SHALL allow users to update their mutable non-admin profile fields.

#### Scenario: User saves chainsaw fields
- **WHEN** a user saves chainsaw skill values on their profile
- **THEN** the system persists those values for the requestor

### Requirement: Admin-only profile fields
The system MUST restrict admin flag, credits, private comments, and liability waiver date mutation to admin users.

#### Scenario: Non-admin attempts admin field update
- **WHEN** a non-admin user submits an update containing credits or admin-only fields
- **THEN** the system ignores or rejects those admin-only changes

#### Scenario: Admin updates another requestor
- **WHEN** an admin updates credits or liability waiver date for a requestor
- **THEN** the system persists the admin-only field changes

### Requirement: Field-level response shaping
The system MUST NOT expose private comments, current liability waiver file pointer, or other admin-only fields to non-admin users.

#### Scenario: Non-admin reads own profile
- **WHEN** a non-admin user requests their profile
- **THEN** private comments and current liability waiver file pointer are absent from the response

### Requirement: Admin grid private comments
The system SHALL allow admin users to add or update private requestor comments from the volunteer management grid.

#### Scenario: Admin updates comments from grid
- **WHEN** an admin saves private comments for a volunteer from volunteer management
- **THEN** the requestor's private comments are persisted and available in admin-only views

### Requirement: Admin grid waiver approval
The system SHALL allow admin users to approve a volunteer's liability waiver from the volunteer management grid.

#### Scenario: Admin approves current-year waiver from grid
- **WHEN** an admin accepts a volunteer's liability waiver from volunteer management
- **THEN** the requestor's waiver approval status is updated for the current year

### Requirement: Private fields remain hidden from non-admins
Volunteer management MUST NOT expose private comments, admin-only waiver approval controls, or admin-only profile fields to non-admin users.

#### Scenario: Non-admin reads profile after admin grid update
- **WHEN** a non-admin reads their own profile after an admin updated private comments
- **THEN** private comments are absent from the response

### Requirement: Profile work-party history
The system SHALL display below the profile fields a read-only work-party history for the requestor whose profile is being viewed. The history SHALL include that requestor's past work-party request records and current or future work-party request records that remain pending, and SHALL identify each work party by hut and date while showing its recorded request, accepted, and attendance statuses when available.

#### Scenario: User has past and pending work parties
- **WHEN** an authenticated user opens their profile and has both a past work-party request and a current or future pending work-party request
- **THEN** the Profile tab displays both records below the profile fields with their hut, date, and available statuses

#### Scenario: Completed future work party is not history
- **WHEN** a requestor has a future work-party request whose accepted status is no longer pending
- **THEN** the Profile tab does not include that future record in the past-and-pending work-party history

#### Scenario: No matching work-party history
- **WHEN** the profile requestor has no past or current/future pending work-party requests
- **THEN** the Profile tab displays a clear empty-state message in the work-party history section

### Requirement: Profile current ski-trip requests
The system SHALL display below the work-party history a read-only summary of the profile requestor's current stored ski-trip reservation requests, including each request's choice number, selected hut or huts, arrival and departure dates, requested spot counts, and status.

#### Scenario: User has current ski-trip requests
- **WHEN** an authenticated user opens their profile and has current stored ski-trip reservation requests
- **THEN** the Profile tab displays those requests below the work-party history in choice order with their request details and status

#### Scenario: No current ski-trip requests
- **WHEN** the profile requestor has no current stored ski-trip reservation requests
- **THEN** the Profile tab displays a clear empty-state message in the ski-trip request section

### Requirement: Profile history follows the authorized profile target
The system MUST load work-party history and ski-trip requests for the requestor whose profile was authorized and opened, rather than always loading data for the signed-in requestor.

#### Scenario: Admin views another requestor
- **WHEN** an admin opens another requestor's profile
- **THEN** the work-party history and ski-trip request sections display that requestor's records

#### Scenario: Non-admin requests another requestor's history
- **WHEN** a non-admin attempts to open another requestor's profile
- **THEN** the system denies access without exposing that requestor's work-party history or ski-trip requests
