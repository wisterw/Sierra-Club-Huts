## MODIFIED Requirements

### Requirement: Deterministic final fairness ties
The system SHALL apply years of service descending, stored lottery number ascending, and requestor ID ascending only after fixing all optimal credit-level choice scores and maximum person-nights. Hut count, minimum hut flexibility across choices, and traverse route count MUST NOT influence requestor fairness order. The system SHALL use the same requestor order for remaining guest-count ties and preserve deterministic canonical hut/option resolution. It MUST preserve default lottery regeneration, the disabled-regeneration option, seeded reproducibility, and lower lottery numbers winning when earlier criteria tie. Allowed huts and linked traverse routes SHALL remain feasibility constraints.

#### Scenario: Lottery resolves otherwise equal outcomes
- **WHEN** only one of two otherwise equivalent requestors can be served and their score/person-night outcomes and years of service tie
- **THEN** the lower preserved lottery number wins, regardless of the number of allowed huts

#### Scenario: Restrictive extra choice
- **WHEN** a volunteer adds a lower choice open to only one hut
- **THEN** that restriction does not advance them in the requestor fairness order

#### Scenario: Service precedes lottery without hut-count priority
- **WHEN** two objective-equivalent allocations differ in which volunteer is favored and one volunteer has more years of service but more allowed huts
- **THEN** years of service determines the final preference before lottery rather than favoring the narrower hut choice

#### Scenario: Broader options enable both volunteers
- **WHEN** one volunteer allows Benson only, another allows Benson or Bradley, and both can be accommodated by using different huts
- **THEN** both can receive their choices through feasibility optimization without giving fewer allowed huts a fairness bonus

#### Scenario: Guest-count ties
- **WHEN** score and person-night objectives and awarded ranks are fixed but surplus guests can be distributed in multiple ways
- **THEN** remaining guest-count ties use the service/lottery/ID requestor order without a hut-count preference
