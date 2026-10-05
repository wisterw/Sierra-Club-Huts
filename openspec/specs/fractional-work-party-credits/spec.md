# fractional-work-party-credits Specification

## Purpose

Define fractional work party credits behavior for the volunteer hut reservation application.

## Requirements

### Requirement: Exact credits in tenths
The system SHALL represent work-party credits in increments of 0.1 and persist them exactly as integer tenths. Public requestor fields, API payloads, and TSV files SHALL retain the `Credits` name and express balances in credit units. Signed balances SHALL remain supported, and accepted scaled values MUST fit the JavaScript safe-integer range.

#### Scenario: Fractional balance survives restart
- **WHEN** an admin saves a balance of 1.5 credits and the application restarts
- **THEN** the persisted tenths value is 15 and the requestor's returned `Credits` value is 1.5

#### Scenario: Signed balance is preserved
- **WHEN** a valid balance of -0.5 credits is persisted
- **THEN** it is stored as -5 tenths and returned as -0.5 credit units

### Requirement: Credit precision validation
The system MUST reject invalid explicit credit values and values not exactly representable in tenths without rounding or mutating the target profile. Whole numbers and trailing-zero equivalents of tenths SHALL be accepted. Profile API errors SHALL use HTTP 400 and identify the credit validation problem. Omitted credit fields SHALL preserve existing balances.

#### Scenario: Excess precision is rejected
- **WHEN** an admin submits 1.25 as Credits along with another profile field update
- **THEN** the system returns HTTP 400 explaining the one-decimal precision requirement and neither field is changed

#### Scenario: Invalid value is rejected
- **WHEN** an explicit Credits input is null, blank, boolean, non-numeric, non-finite, or outside the supported scaled range
- **THEN** the system rejects the input without changing the balance

#### Scenario: Equivalent decimal formats are accepted
- **WHEN** valid credit inputs are 3, 3.0, or the decimal string 1.50
- **THEN** the stored balances respectively represent 3, 3, and 1.5 credits without rounding

### Requirement: Fractional profile editing and authorization
The profile SHALL support admin credit edits with a number input stepping by 0.1. Whole balances SHALL display without a forced fractional suffix and fractional balances SHALL display one decimal place. Non-admins SHALL see the credit field as read-only and MUST NOT be able to mutate credits through profile API submissions. The behavior SHALL apply in every existing application mode.

#### Scenario: Admin saves a fractional balance
- **WHEN** an admin enters 2.5 credits in a volunteer's profile and saves
- **THEN** the save succeeds and reopening the profile displays 2.5

#### Scenario: Whole balance display
- **WHEN** a profile with 3 credits is opened
- **THEN** the credit field displays 3

#### Scenario: Non-admin attempts a credit update
- **WHEN** a non-admin submits Credits of 2.5 in their profile update
- **THEN** their persisted credit balance remains unchanged under the existing admin-only field authorization behavior

### Requirement: Balance-preserving one-time migration
The system SHALL migrate existing credit balances to integer tenths transactionally, preserving their credit-unit meaning and all unrelated records and relationships. The migration MUST run at most once per database. Invalid legacy balances MUST cause startup to fail with a clear error without partial schema or balance conversion, rounding, or truncation.

#### Scenario: Existing balances migrate once
- **WHEN** a legacy database contains balances of 3 and 1.5 credits and the new application starts twice
- **THEN** both startups return balances of 3 and 1.5 credit units and the internal values remain 30 and 15 tenths
- **AND** requestor identities, login fields, trip requests, work-party records, agreements, and application settings remain intact

#### Scenario: Invalid legacy balance blocks conversion
- **WHEN** a legacy database contains a balance of 1.25 credits or an invalid number
- **THEN** startup fails with an actionable credit validation error and leaves the legacy schema and all balances unchanged

### Requirement: Fractional import and export continuity
Admin uploads, startup TSV imports, and the legacy TSV repository SHALL validate credits consistently and preserve valid fractions. Admin uploads MUST preserve existing balances for blank Credits cells and reject an invalid-credit upload without partially committing rows. Exported Credits SHALL remain canonical credit-unit values and SHALL support lossless re-import.

#### Scenario: Fractional TSV round trip
- **WHEN** a valid TSV containing 1.5 credits is imported, exported, and re-imported
- **THEN** the volunteer retains 1.5 credits and the exported Credits cell contains 1.5 rather than 15

#### Scenario: Blank upload cell preserves balance
- **WHEN** an admin uploads an existing volunteer with a blank Credits cell
- **THEN** the volunteer's existing fractional balance is preserved

#### Scenario: Invalid row rejects entire upload
- **WHEN** an upload contains a valid first row and a later row with Credits of 1.25
- **THEN** the system rejects the upload with row-specific credit validation information and commits neither row

### Requirement: Fractional credits preserve request priority rules
Assignment ordering, availability priority groups, and reports SHALL compare fractional credits numerically under the existing priority rules. Equal fractional balances SHALL belong to the same credit priority group, and other tie-break criteria SHALL remain unchanged.

#### Scenario: Higher fractional balance ranks first
- **WHEN** otherwise equivalent trip-request candidates have 1.5 and 1.4 credits
- **THEN** the 1.5-credit candidate has the higher credit priority and reports sort it first where credits are the sorting criterion

#### Scenario: Equal fractional balances use existing tie-breaks
- **WHEN** two requestors both have 1.5 credits
- **THEN** availability summaries treat them as equal in credits and assignment ordering applies the existing subsequent criteria
