## Context

The current implementation is a Node/Express application backed by two TSV files: `requestors.tsv` and `requests.tsv`. It already supports session-based login, trip request editing, availability summary calculations, profile updates, admin upload/download, assignment, and an efficiency report.

The current OpenSpec source documents now describe a wider system. The system needs database-backed tables for requestors, ski trip requests, work parties, work-party requests, and persisted application settings. It also needs mode-aware user flows, a Work Party tab, expanded profile fields, durable trip request identifiers, combination-trip linkage, and richer admin/reporting behavior.

The change should preserve existing user-facing trip request behavior where it already matches the spec while replacing storage and filling missing product areas.

## Goals / Non-Goals

**Goals:**

- Introduce a lightweight relational database and repository/service boundary suitable for the app's small data volume.
- Provide a migration path from the existing TSV data files into the relational schema.
- Add persisted application modes and mode-aware frontend tab availability.
- Add work-party data, API, and UI flows.
- Expand profile and request models to match the current schema.
- Keep existing login, request summary, assignment, and reporting behavior working while aligning gaps with the latest specs.
- Add focused tests for data migration, validation, mode behavior, work-party flows, request summary math, and admin reports.

**Non-Goals:**

- Replacing Express or converting the frontend to a framework.
- Building a public external API beyond the current authenticated REST-style app API.
- Implementing payment, CTL reservation confirmation, liability waiver upload processing, or outbound notification campaigns unless already represented by current admin requirements.
- Rewriting styling unrelated to new or changed workflows.

## Decisions

### Use SQLite for lightweight relational persistence

Use SQLite as the relational database because the data volume is small, deployment should stay simple, and the application does not currently need a separate database server. SQLite also fits local development and single-instance deployment on EC2.

Alternative considered: Postgres. It provides stronger multi-process/server deployment semantics but adds operational cost that is unnecessary for a few thousand rows and the current single-app deployment model.

Alternative considered: Keep TSV as primary persistence. This avoids migration work but directly conflicts with the current schema requirement for relational storage and makes work-party/application-mode relationships awkward.

### Add a data access layer before expanding feature code

Route handlers should call domain repositories/services instead of directly mutating in-memory TSV arrays. This allows the existing API shape to be preserved while moving storage behind a stable boundary.

Alternative considered: Update route handlers directly to use SQL. That is faster initially but spreads SQL and migration assumptions across authentication, request, admin, and work-party code.

### Preserve TSV import as migration and admin input

Existing TSV files should be treated as seed/import data. Startup or an explicit migration command should create the database schema and import existing requestors/requests without silently destroying the source TSV files.

Alternative considered: Convert the TSV files in place and remove support immediately. That increases deployment risk and makes rollback harder.

### Model app mode as a persisted setting

Store application mode in a small settings table or equivalent relational table keyed by setting name. This keeps the first implementation simple while allowing future settings without schema churn.

Alternative considered: Environment variable only. It is easy to deploy but fails the admin-management requirement and cannot be changed from the app.

### Represent combination trips with linked request rows

Combination trips should remain two ski trip request rows for capacity and summary calculations, linked by `Combination_first_request`. The first row represents the first hut segment, and the second row references the first row.

Alternative considered: Store combination trips as one row with two huts and traverse date. That is easier for frontend editing but complicates nightly capacity calculations and diverges from the schema.

## Risks / Trade-offs

- Database migration could corrupt or lose existing TSV data -> Keep TSV sources intact, add repeatable import tests, and require explicit backup before production migration.
- SQLite write locking can affect concurrent edits -> Keep transactions short, use one process, and avoid long-running write operations during assignment/report generation.
- Work-party and trip-request modes could block admins from needed actions -> Mode restrictions apply to end-user tabs, while admin routes remain available to admins.
- Combination-trip linking can drift if only one segment is edited -> Save combination choices transactionally and validate both linked rows together.
- Assignment behavior may change visible results -> Add deterministic seed support and tests before replacing or extending the current algorithm.
- Expanded profile fields may expose private data to users -> Enforce field-level response shaping so private comments and admin-only fields are only returned to admins.

## Migration Plan

1. Add database schema, migrations, and repository interfaces while keeping current routes behaviorally stable.
2. Import existing TSV requestors and requests into the new schema in development/test data.
3. Switch route handlers from `TsvStore` to repositories and run current request summary tests.
4. Add new capabilities incrementally: app mode, profile fields, work parties, request IDs/linkage, admin reports, assignment audit details.
5. Keep TSV export/import utilities for administrator workflows and rollback.

Rollback strategy: retain the original TSV files and old code path until database-backed behavior is verified. A rollback can redeploy the TSV-backed version using the preserved files.

## Open Questions

- Should database creation/import happen automatically at startup or through an explicit migration command?
- What default application mode should a fresh install use: Inactive, Work Party, or Trip Request?
- How should work-party seed data be loaded: admin upload, checked-in fixture, or direct database editing for the first release?
- Does `years_of_service` remain a free-form text field or should it be normalized later for assignment scoring?
