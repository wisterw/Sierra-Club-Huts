## 1. Data Model and Normalization

- [x] 1.1 Define allowed work-party accepted status values: blank, pending, accepted, waitlisted.
- [x] 1.2 Define allowed work-party attendance status values: blank, full attended, partial attended, no show, cancelled.
- [x] 1.3 Normalize existing work-party request reads/writes to the accepted and attendance status values.
- [x] 1.4 Define current-year waiver approval logic using persisted requestor waiver approval data.

## 2. Volunteer Management Data Access

- [x] 2.1 Add repository/service support for listing work-party filter options.
- [x] 2.2 Add repository/service support for building volunteer grid rows with contact, skills, private comments, years of service, work-party summaries, waiver status, and ski trip request count.
- [x] 2.3 Add filtering support for work-party accepted status, selected work party, reservation status, and waiver approval status.
- [x] 2.4 Add repository/service mutation support for private admin comments and waiver approval.
- [x] 2.5 Add repository/service mutation support for work-party accepted status and attendance status by explicit work-party key.

## 3. Admin API

- [x] 3.1 Add admin-only API endpoint for loading volunteer grid rows and filter options.
- [x] 3.2 Add admin-only API endpoint for updating a volunteer's private comments.
- [x] 3.3 Add admin-only API endpoint for approving a volunteer's current-year liability waiver.
- [x] 3.4 Add admin-only API endpoint for updating work-party accepted status.
- [x] 3.5 Add admin-only API endpoint for updating work-party attendance status.
- [x] 3.6 Reject work-party status mutations that do not include exactly one target work-party key.
- [x] 3.7 Add authorization tests proving non-admin users cannot read or mutate volunteer management data.

## 4. Admin Frontend

- [x] 4.1 Replace the Manage volunteers/requestors placeholder with the volunteer grid.
- [x] 4.2 Add filters for work-party accepted status, work party, reservation status, and waiver approval status.
- [x] 4.3 Render volunteer grid columns for name, phone, city, email, work parties applied for, admin comments, years of service, chainsaw fields, waiver status, and hut trip request count.
- [x] 4.4 Link volunteer names to the admin-accessible profile view or existing requestor profile flow.
- [x] 4.5 Add row action UI for private comments and waiver approval.
- [x] 4.6 Add row action UI for work-party accepted and attendance status updates.
- [x] 4.7 Disable or hide work-party accepted and attendance actions unless the Work party filter selects one specific work party.
- [x] 4.8 Refresh grid data and user-visible status messages after successful row actions.

## 5. Verification

- [x] 5.1 Add focused tests for volunteer grid filtering and row shaping.
- [x] 5.2 Add focused tests for private comment updates and non-admin private-field hiding.
- [x] 5.3 Add focused tests for waiver approval filtering and persistence.
- [x] 5.4 Add focused tests for accepted status and attendance status updates, including ambiguous work-party rejection.
- [x] 5.5 Add or update browser smoke coverage for the Manage volunteers/requestors Admin console workflow.
- [x] 5.6 Run relevant existing profile, work-party, admin-console, mode, and smoke tests.
