## Context

The Admin console now has a reserved Manage volunteers/requestors section. The Admin PRD defines that section as a work-party leader tool for reviewing volunteers, filtering by work-party and ski-trip state, and taking row-level actions. The current app already stores requestors, private comments, liability waiver dates, work parties, work-party requests, and ski trip requests, but it does not yet expose a grid-oriented admin workflow for acting across those records.

This change sits between the existing end-user work-party signup flow and later admin flows such as full liability waiver review and work-party setup. It should give leaders a useful operational view without implementing file-backed waiver review or work-party creation/editing.

## Goals / Non-Goals

**Goals:**
- Add the Manage volunteers/requestors Admin console section as a real grid workflow.
- Filter volunteers by work-party accepted status, specific work party, ski trip reservation status, and current-year waiver approval status.
- Display volunteer contact fields, work-party applications, private admin comments, years of service, chainsaw fields, waiver status, and ski trip request count.
- Allow admins to update private comments and approve waiver status from the grid.
- Allow admins to update work-party accepted status and attendance status only when one specific work party is selected.
- Keep work-party accepted status and attendance status as separate fields and concepts.
- Preserve non-admin privacy rules for private comments and admin-only fields.

**Non-Goals:**
- Implementing liability waiver file upload, storage, preview, or review queue.
- Implementing work-party create/edit/delete or leader assignment.
- Changing the end-user work-party signup interest choices.
- Changing ski trip lottery assignment, granted request semantics, or CTL follow-up confirmation.
- Adding role scoping by individual work-party leader; for this change, all admin users can use the admin volunteer management workflow.

## Decisions

### Use one admin grid endpoint plus focused mutation endpoints

The grid should be backed by an admin-only read endpoint that returns already-shaped rows for the selected filters. Mutations should use focused admin-only endpoints for private comments, waiver approval, work-party accepted status, and work-party attendance status.

Alternative considered: fetch all requestors, work-party requests, and ski trip requests separately and join them in the browser. That leaks too much shaping complexity to the frontend and makes private-field exposure harder to audit.

### Require a specific work-party filter for work-party actions

Work-party accepted and attendance actions need a target work-party key. The UI should disable those actions unless the Work party filter identifies exactly one hut/date combination, and the backend should reject work-party status mutations without that key.

Alternative considered: infer the target from the row's work-party applications. That breaks down when a volunteer has applied to multiple work parties and could mutate the wrong application.

### Keep accepted status distinct from attendance status

Accepted status answers "is this volunteer accepted or waitlisted for this work party?" Attendance status answers "what happened after the work party?" The grid can show both, but status updates must write to the correct field.

Alternative considered: fold completion into accepted status. That would overload a planning decision with post-event outcomes and make filtering leaders' pending/accepted lists less reliable.

### Treat waiver approval as date-based for this change

The current persistence model has `liability_waiver_date`. Until file-backed waiver review is implemented, current-year waiver approval can be represented by setting or clearing the approval date. The grid should filter by whether the waiver approval date falls in the current work-party year.

Alternative considered: introduce a full waiver table now. That belongs with the later liability-waiver-review change because the Admin PRD also discusses file pointers and filesystem retention.

## Risks / Trade-offs

- Ambiguous status mutations -> Require and validate a specific work-party key for work-party accepted/attendance actions.
- Private comments could leak to non-admin users -> Keep all volunteer grid endpoints admin-only and preserve existing requestor response shaping for non-admin profile reads.
- Current-year waiver filtering can be imprecise around season boundaries -> Define the current-year test consistently in the service layer and cover it with focused tests.
- Grid queries can become hard to maintain as filters grow -> Keep row shaping in one service/repository path and keep mutation endpoints focused.
