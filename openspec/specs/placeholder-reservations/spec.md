# placeholder-reservations Specification

## Purpose

Define placeholder reservations behavior for the volunteer hut reservation application.

## Requirements

### Requirement: Durable placeholder requestors
The system SHALL persist `Is_placeholder` with default false for existing and new ordinary volunteers. Dedicated admin reservation operations SHALL create one placeholder and one linked logical choice-1 request (one ordinary row or two traverse legs) per reservation reference, using a unique synthetic non-deliverable identity. Ordinary volunteer profile/import operations MUST NOT set the flag or convert people into placeholders. Each placeholder SHALL remain limited to one awarded trip.

#### Scenario: Migration preserves existing volunteers
- **WHEN** an existing database is migrated
- **THEN** every existing requestor remains non-placeholder and existing requests remain unchanged

#### Scenario: Independent bookings have independent placeholders
- **WHEN** an admin imports two distinct reservation references
- **THEN** two separate flagged requestors and their respective single-choice requests are created

### Requirement: Placeholder authentication and email exclusion
The system MUST NOT generate or send login codes, emit debug codes, authenticate by code or hash, or accept volunteer sessions for placeholders. Login email requests SHALL return the generic unknown-identity response. Placeholders MUST NOT receive contention emails through discovery, pending delivery, retry, or reconciliation paths. Their reservations SHALL continue contributing demand affecting ordinary volunteers.

#### Scenario: Placeholder requests a login code
- **WHEN** a login-email request names a placeholder identity
- **THEN** a generic response is returned without changing authentication fields or contacting the mail relay

#### Scenario: Existing credentials cannot bypass the flag
- **WHEN** a valid old code, hash or session resolves to a placeholder
- **THEN** authentication or protected volunteer access is rejected

#### Scenario: Placeholder competes without receiving alerts
- **WHEN** a placeholder booking impacts a real volunteer's choices
- **THEN** the real volunteer follows normal alert rules and no alert is sent to the placeholder, including previously pending work

### Requirement: Admin reservation upload and paste
The system SHALL offer authenticated admin-only TSV upload, sample download and TSV paste with shared validation. Rows SHALL require `Reservation_reference`, `Name`, `Hut`, `Arrival`, `Departure`, and `Guests`, with optional `Traverse_date` and private `Notes`. Name SHALL be stored in the placeholder name and displayed to admins. Each row SHALL specify one supported hut or the ordered Benson->Bradley / Bradley->Benson route, valid ISO dates within current request season/stay rules, and a positive integer guest count within capacity. Combination trips SHALL require a traverse date strictly inside the stay and create two contiguous linked legs for the same placeholder and choice. Ordinary trips MUST omit traverse dates. Each leg SHALL satisfy the existing five-night limit. Checkout day SHALL be excluded. Stored requests SHALL use choice 1 and equal minimum and ideal guest counts. Import SHALL NOT run assignment or send invitations.

#### Scenario: Valid partial reservation is imported
- **WHEN** an admin uploads a Benson reservation December 20 to December 22 for four guests
- **THEN** one placeholder and a fixed-four-guest first-choice request occupying December 20 and 21 are stored

#### Scenario: Named combination reservation
- **WHEN** an admin imports a named Benson->Bradley booking with a valid traverse date
- **THEN** the name is stored on one placeholder and two linked fixed-guest legs consume their respective hut-nights

#### Scenario: Paste matches upload behavior
- **WHEN** the same TSV is submitted through paste or upload
- **THEN** both paths apply the same validation and creation/update semantics

#### Scenario: Invalid or unauthorized input
- **WHEN** input is invalid, exceeds supported limits, or the caller is not an admin
- **THEN** no reservation or placeholder is created or changed and an actionable error is returned

### Requirement: Atomic and repeatable reservation lifecycle
References SHALL be trimmed, case-sensitive, globally unique and required. Reimporting a reference SHALL update its booking while preserving durable identities; omitted bookings SHALL remain intact. Duplicate batch references or final combined placeholder occupancy exceeding hut capacity MUST reject the whole batch. Admins SHALL be able to list and explicitly remove reservations and their dedicated placeholders atomically. Changes SHALL refresh contention and stale relevant allocation summaries using existing transaction rules.

#### Scenario: Reimport updates without duplicate occupancy
- **WHEN** an existing reference is imported with new dates
- **THEN** its existing booking is replaced, other reservations are preserved, and no extra placeholder is created

#### Scenario: Conflicting bookings reject the complete batch
- **WHEN** new or updated reservations together with retained placeholders exceed a hut-night capacity
- **THEN** the entire import rolls back and the error identifies the conflict

#### Scenario: Removal frees reserved demand
- **WHEN** an admin removes a reservation reference
- **THEN** only its linked booking and dedicated placeholder are removed and availability/contention reflect the released capacity

### Requirement: Reservation precedence in preview and allocation
The system SHALL consistently give placeholders effective credit priority above all ordinary volunteers in availability, contention, alert impact calculations and allocation, including after ordinary credits increase. Each placeholder booking SHALL use one fixed-guest first choice. Collective placeholder feasibility SHALL be checked before assignment; failure MUST preserve all existing grants. Ordinary credit precedence, choice-score optimization, person-nights and fairness rules SHALL apply after placeholder outcomes are secured. No optimizer SHALL run on ordinary editing or import.

#### Scenario: Ordinary credits increase above stored placeholder credits
- **WHEN** an ordinary volunteer's credit balance exceeds a placeholder's stored balance
- **THEN** the placeholder still has higher effective priority in preview, contention and allocation

#### Scenario: Fixed reservation consumes capacity before allocation
- **WHEN** a feasible placeholder occupies four of twelve beds on a hut-night
- **THEN** it receives all four beds and at most eight remain for ordinary grants on that night

#### Scenario: Infeasible legacy reservations cannot be silently lost
- **WHEN** existing placeholder records collectively exceed capacity or fail allocation validation
- **THEN** assignment fails clearly without selecting a subset of placeholders or rewriting grants

### Requirement: Reservation visibility and allocation history
Volunteer availability SHALL distinguish existing reservation occupancy without revealing synthetic identities or private notes; overlapping ordinary requests SHALL retain warning-based submission behavior. Admin lists and exports SHALL identify placeholders separately. Volunteer choice/credit fairness statistics SHALL exclude placeholders and report their booking counts/person-nights separately, while total occupied person-nights SHALL include them. New runs SHALL record policy `credit-rank-person-nights-v3`; saved older policies SHALL be stale without rewriting metrics or grants. Allocation fingerprints SHALL detect reservation and flag changes during solving.

#### Scenario: Full hut booking appears unavailable
- **WHEN** an imported reservation uses all beds for a hut-night
- **THEN** availability shows it as fully reserved without exposing the placeholder email or private notes

#### Scenario: Imported reservation changes during a solve
- **WHEN** an admin changes or removes a relevant reservation while assignment is running
- **THEN** the computed result cannot overwrite current records and a stale-input error is returned

#### Scenario: Existing policy history survives deployment
- **WHEN** an older-policy allocation summary is read after deployment
- **THEN** its policy and metrics are preserved, it is marked stale, and grants remain unchanged until a deliberate successful assignment
