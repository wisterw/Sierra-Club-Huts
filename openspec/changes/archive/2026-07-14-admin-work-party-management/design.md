## Context

The Admin console already reserves a Set up work parties section, but it currently renders placeholder content. The data model already has `work_parties` and `work_party_requests`, and the end-user Work Party tab reads from those records. Admins need a supported workflow for maintaining work-party records before leaders review applicants and before volunteers sign up.

This change is mostly CRUD over existing relational data, but deletion has cross-record impact because work-party requests reference work parties with cascading deletion. The UI should make that impact explicit.

## Goals / Non-Goals

**Goals:**
- Provide an admin-only current-year list of work parties.
- Allow admins to create work parties with hut, Friday check-in date, Sunday check-out date, leader, leader contact, capacity, comments, and availability.
- Allow admins to edit non-key work-party fields.
- Keep hut and Friday check-in date immutable after creation.
- Allow admins to delete work parties after confirmation.
- Populate the leader selector from admin requestors and derive the leader email/contact from the selected admin where possible.
- Keep end-user work-party signup lists in sync with admin-managed work parties.

**Non-Goals:**
- No recurring work-party generation.
- No role scoping by assigned leader; any admin can manage work parties.
- No bulk import/export of work parties.
- No soft-delete or archive view for deleted work parties.
- No change to volunteer accepted/attendance status workflows beyond preserving existing cascade behavior.

## Decisions

1. Use the existing `work_parties` table as the source of truth.

   Rationale: The table already contains the needed fields plus `availability`. Adding a separate admin setup model would duplicate state and risk divergence. Alternative considered: a separate draft table, which would support staged schedules but is unnecessary for the current PRD.

2. Treat `(friday_check_in, hut)` as immutable work-party identity.

   Rationale: Existing requests use those fields as the composite foreign key. Editing them would either orphan request rows or require a move operation with larger consequences. Alternative considered: allowing key edits by delete-and-recreate, but that should remain an explicit delete/create action.

3. Delete work parties through a confirmed admin operation that cascades volunteer applications.

   Rationale: The current schema already supports cascading deletion from `work_parties` to `work_party_requests`. The UI and API should make this destructive effect explicit. Alternative considered: preventing deletion when applications exist, but the PRD asks for a trash-can delete action.

4. Store leader display/contact fields on the work-party row even when selected from an admin user.

   Rationale: This preserves historical display values and fits the existing row shape. The leader selector can derive those values at edit time, but the work-party row remains self-contained. Alternative considered: storing a leader requestor id, which improves referential integrity but requires a schema change and migration not demanded by the PRD.

## Risks / Trade-offs

- Accidental deletion of applications -> require explicit confirmation and keep destructive action admin-only.
- Leader contact drift -> storing text snapshots means later profile edits do not automatically update existing work parties.
- Duplicate work parties -> enforce the existing composite key and return validation errors on conflicts.
- Capacity changes after signups -> do not automatically reopen or close work parties; preserve the existing narrow automatic open-to-waitlist behavior.

## Migration Plan

No schema migration is expected beyond existing `work_parties` fields. Implementation should reuse existing records and default new work parties to `open` availability unless the admin chooses another value.

## Open Questions

- Should leader phone or leader email be the primary displayed contact in the list when both are available?
