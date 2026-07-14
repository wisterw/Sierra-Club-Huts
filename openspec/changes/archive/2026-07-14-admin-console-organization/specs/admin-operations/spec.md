## ADDED Requirements

### Requirement: Admin operation placement
The admin interface SHALL present assignment lottery, request download, and efficiency report controls within the organized Admin console sections.

#### Scenario: Assignment lottery appears in Application settings
- **WHEN** an admin opens the Application settings section
- **THEN** the run lottery control and regenerate lottery numbers checkbox are available with the regenerate checkbox defaulted to on

#### Scenario: Download requests appears in Download requests section
- **WHEN** an admin opens the Download requests section
- **THEN** the joined request download action and its request filter options are available

#### Scenario: Efficiency report appears in Efficiency report section
- **WHEN** an admin opens the Efficiency report section
- **THEN** the control for loading the efficiency report is available

### Requirement: Existing admin operations remain compatible
Reorganizing the Admin console MUST NOT change the behavior of existing assignment lottery, request download, or efficiency report operations.

#### Scenario: Admin operation after reorganization
- **WHEN** an admin runs an existing admin operation from its organized console section
- **THEN** the operation uses the existing backend behavior and returns the same kind of result as before the reorganization

