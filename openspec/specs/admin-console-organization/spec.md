# admin-console-organization Specification

## Purpose
The Admin tab is organized as an admin-only console with stable sections for operational workflows.

## Requirements
### Requirement: Admin console sections
The system SHALL present the Admin tab as an admin-only console with distinct sections for Application settings, Manage volunteers/requestors, Review liability waivers, Download requests, Efficiency report, and Set up work parties.

#### Scenario: Admin opens console
- **WHEN** an authenticated admin opens the Admin tab
- **THEN** the system displays admin-local navigation for the Admin console sections

#### Scenario: Non-admin cannot see console
- **WHEN** an authenticated non-admin uses the application
- **THEN** the Admin tab and Admin console sections are not available

### Requirement: Admin section navigation
The system SHALL allow admin users to switch between Admin console sections without leaving the Admin tab.

#### Scenario: Admin changes section
- **WHEN** an admin selects a different Admin console section
- **THEN** the selected section becomes active and the other section content is hidden

### Requirement: Workflow section readiness
The system SHALL show functional workflows in Admin console sections as they are implemented and SHALL avoid exposing unfinished workflow actions.

#### Scenario: Admin views implemented workflow section
- **WHEN** an admin opens an implemented workflow section
- **THEN** the system displays the workflow controls for that section

#### Scenario: Admin views reserved workflow section
- **WHEN** an admin opens a section whose workflow is not yet implemented
- **THEN** the system indicates that the workflow is not yet available or shows non-actionable placeholder content
