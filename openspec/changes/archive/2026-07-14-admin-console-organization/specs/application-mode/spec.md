## ADDED Requirements

### Requirement: Season mode placement
The admin interface SHALL present the season mode selector inside the Admin console Application settings section.

#### Scenario: Admin sees season mode setting
- **WHEN** an admin opens the Application settings section
- **THEN** the season mode selector is available with Work Party mode, Trip Request mode, and Inactive mode options

### Requirement: Existing season mode behavior remains compatible
Reorganizing the Admin console MUST NOT change persisted application mode behavior or end-user tab behavior.

#### Scenario: Admin changes mode after reorganization
- **WHEN** an admin changes season mode from the Application settings section
- **THEN** the selected mode is persisted and subsequent mode-aware tab behavior follows the existing application-mode requirements
