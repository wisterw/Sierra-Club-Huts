## MODIFIED Requirements

### Requirement: Current-year work party list
The system SHALL show authenticated users the current-year admin-managed work parties in chronological order with dates, hut, leader, hike-in comments, availability, user interest, and user status.

#### Scenario: User views work parties
- **WHEN** a user opens the Work Party tab in Work Party mode
- **THEN** the system displays only admin-managed work parties for the current year in chronological order

#### Scenario: Admin-created work party appears to users
- **WHEN** an admin creates a work party for the current year
- **THEN** authenticated users can see that work party in the Work Party tab

#### Scenario: Admin-deleted work party is removed from user list
- **WHEN** an admin deletes a work party
- **THEN** authenticated users no longer see that work party in the Work Party tab
