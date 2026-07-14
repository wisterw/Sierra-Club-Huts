## Why

Work party leaders need a practical admin surface for reviewing volunteers across work-party applications, waiver status, skills, and request activity. The Admin PRD now defines a volunteer/requestor grid with filters and context-sensitive row actions, which should become a clear capability before waiver review and work-party setup expand further.

## What Changes

- Add a Manage volunteers/requestors Admin console section with a volunteer grid.
- Add filters for work-party accepted status, specific work party, reservation status, and current-year liability waiver approval.
- Show volunteer contact, skills, private comments, years of service, work-party applications, waiver status, and ski trip request count in the grid.
- Add row actions for private admin comments and liability waiver approval.
- Add work-party-scoped row actions for marking a volunteer accepted, waitlisted, full attended, partial attended, no show, or cancelled for the currently filtered work party.
- Require a specific work-party filter before enabling work-party-scoped row actions so volunteers with multiple work-party applications are never mutated ambiguously.
- Keep work-party accepted status separate from work-party attendance status.

## Capabilities

### New Capabilities
- `admin-volunteer-management`: Admin volunteer/requestor grid, filters, columns, context-sensitive row actions, and authorization.

### Modified Capabilities
- `work-party-signup`: Work-party request status model is clarified to expose accepted status separately from attendance status.
- `requestor-profile`: Admin private comments and liability waiver approval become actionable from the volunteer grid while remaining hidden from non-admins.
- `relational-persistence`: Work-party request accepted/attendance statuses and current-year waiver approval data must be persisted through repository/service boundaries.

## Impact

- Admin frontend section in `public/js/app.js` and related styles.
- New or extended admin API routes for volunteer grid reads and row actions.
- Data access methods for filtering volunteers, summarizing work-party applications, updating work-party request statuses, updating private comments, and approving liability waivers.
- Existing work-party request persistence may need status normalization from current `confirmation_status`/`attendance_status` values.
- Focused tests for filtering, action enablement, admin authorization, private-field exposure, and status updates.
