## Context

The profile form currently always emits the `private_comments` textarea and merely disables it for non-admins. That contradicts response-shaping requirements and leaves the existence and label of an internal field visible. The application already exposes reusable information-control behavior for the chainsaw fields, and server routes already remove or reject admin-only properties for non-admin users.

## Goals / Non-Goals

**Goals:**

- Render the comments control only when the active user is an admin.
- Present the admin-facing label and explanatory text consistently and accessibly.
- Retain defense in depth at the API boundary and cover the regression with tests.

**Non-Goals:**

- Renaming the database column or JSON property `private_comments`.
- Expanding profile access or comment visibility to a new role.
- Changing the separate volunteer-management comments workflow.

## Decisions

1. Gate the entire form fragment on `isAdmin`. Omitting the label, help control, and textarea prevents non-admin disclosure in the rendered DOM; disabling the textarea is insufficient because its label and purpose remain visible. Server-side response shaping and mutation authorization remain unchanged as a second security boundary.
2. Keep `private_comments` as the internal field name while displaying "Admin-only comments." This avoids a storage migration and API compatibility work for a presentation-only terminology change.
3. Use the profile page's existing accessible information-control pattern. The guidance will be available on pointer hover, keyboard focus, and click/touch activation, with an accessible name and programmatic association to the help content. This is more inclusive than relying solely on the HTML `title` attribute.
4. Treat "hut leaders and admins" as explanatory context, not authorization expansion. The explicit requirement that non-admins cannot see the profile field controls access; any hut leader who needs this control must already hold admin authorization.

## Risks / Trade-offs

- [Risk] The requested guidance refers to hut leaders even though the control is admin-only. → Preserve admin authorization and phrase the requirement so the comments are useful to hut leaders/admins without granting a new role access.
- [Risk] Client-only checks could regress or be bypassed. → Retain API response filtering and update authorization, and test both UI omission and server behavior.
- [Risk] Hover-only help is inaccessible on touch devices and to keyboard users. → Reuse an interaction pattern supporting hover, focus, click, and touch.
