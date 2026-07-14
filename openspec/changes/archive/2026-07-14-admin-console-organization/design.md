## Context

The Admin PRD now treats the Admin tab as a console with sections or subtabs: Application settings, Manage volunteers/requestors, Review liability waivers, Download requests, Efficiency report, and Set up work parties. The current frontend renders existing admin operations in one panel, while future admin work will add larger workflows that need clear navigation and stable placement.

Existing backend behavior for application mode, lottery assignment, request downloads, and efficiency reporting is already covered by `application-mode` and `admin-operations`. This change should organize the admin surface without changing those APIs or implementing the larger volunteer, waiver, or work-party management workflows.

## Goals / Non-Goals

**Goals:**
- Provide a clear Admin console structure aligned with the Admin PRD.
- Group season mode and assignment lottery controls under Application settings.
- Keep download requests and efficiency report available as distinct admin sections.
- Add visible but non-functional future workflow destinations for Manage volunteers/requestors, Review liability waivers, and Set up work parties so the console structure can grow predictably.
- Preserve existing admin authorization and backend API semantics.

**Non-Goals:**
- Implementing the volunteer/requestor grid, filters, or row actions.
- Implementing waiver upload storage or waiver review.
- Implementing work-party create/edit/delete workflows.
- Changing assignment algorithm behavior, lottery regeneration semantics, download report contents, or efficiency calculations.
- Changing the three application modes or end-user mode behavior.

## Decisions

### Use a sectioned Admin console instead of separate top-level tabs

The Admin tab remains one top-level application tab available only to admin users. Inside it, use admin-local section navigation for Admin PRD areas.

Alternative considered: promote every admin area to a top-level app tab. That would crowd the primary navigation and expose unfinished admin concepts beside end-user workflows. Keeping them inside Admin preserves the existing application shape.

### Make Application settings the default admin section

Application settings should be the first/default section because it contains the existing season mode and assignment lottery controls that admins can already use today.

Alternative considered: a landing/overview section. That adds a non-operational screen and delays access to the most mature admin actions.

### Preserve existing APIs and move only the presentation layer

The current `/api/mode`, `/api/admin/run-assignment`, `/api/admin/regenerate-lottery`, download, and efficiency routes should continue to be used by the reorganized UI. The change is presentation and interaction organization, not service behavior.

Alternative considered: introduce a new admin-console API that aggregates all admin data. That is premature until the volunteer, waiver, and work-party workflows define their data contracts.

### Represent future workflows as disabled or placeholder sections

The Admin PRD names workflows that will be implemented in later changes. This change can reserve navigation for them, but their content should clearly indicate that the workflow is not available yet or omit controls that would imply working behavior.

Alternative considered: hide future sections entirely. That avoids placeholders, but it makes later work more likely to reorganize the console again.

## Risks / Trade-offs

- Placeholder sections can be mistaken for completed functionality -> Label future sections clearly and avoid actionable controls until their workflows are implemented.
- Moving existing controls can break event wiring -> Keep existing API calls and verify mode save, assignment run, lottery regeneration, downloads, and efficiency loading after the UI move.
- Section navigation can add visual complexity -> Use simple admin-local navigation with predictable active state and preserve current Admin tab visibility rules.
