## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Expanded profile fields
The system SHALL support profile fields for email, first name, last name, address, city, state, ZIP, phone, chainsaw user, chainsaw owner/tuner, other skills, admin flag, credits, years of service, private comments, liability waiver date, and current liability waiver file pointer. The obsolete general Comments field SHALL NOT be displayed or accepted as a profile update.

#### Scenario: User views own profile
- **WHEN** an authenticated user opens the Profile tab
- **THEN** the system displays user-editable profile fields including Other skills, omits the obsolete general Comments field, displays liability waiver download and submit actions, and hides admin-only private fields and waiver file pointer

#### Scenario: Admin views profile
- **WHEN** an admin opens a requestor profile
- **THEN** the system may include admin-only private fields and the current liability waiver file pointer but omits the obsolete general Comments field

#### Scenario: Client submits obsolete comments field
- **WHEN** a client includes the obsolete general Comments field in a profile update
- **THEN** the system ignores that field while processing supported profile fields
