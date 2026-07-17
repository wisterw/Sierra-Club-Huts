## MODIFIED Requirements

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

## ADDED Requirements

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
