## Context

The Profile form currently renders the two chainsaw fields as checkbox labels without the explanatory text required by the end-user PRD. A reusable `infoIcon()` helper exists elsewhere, but it emits a non-focusable span with a native `title` tooltip, which does not reliably expose help to keyboard or touch users.

## Goals / Non-Goals

**Goals:**

- Place a recognizable information control next to each chainsaw field.
- Present the exact PRD-defined explanation for the corresponding field.
- Support pointer hover, keyboard focus, and click/touch activation.
- Associate each control and its help text for assistive technology.
- Preserve the current checkbox values and save behavior.

**Non-Goals:**

- Renaming chainsaw data fields or changing their stored meaning.
- Changing APIs, persistence, authentication, or authorization.
- Redesigning unrelated Profile fields or every existing information icon.

### Retire the general Comments profile field without a destructive migration

Remove the control and update payload from the Profile UI, reject it from the profile store's user-editable allowlist, and remove it from profile schema documentation. Keep the physical SQLite column and legacy import mapping for compatibility with existing database files and exports; `other_skills` is the supported user-editable free-text replacement, while `private_comments` remains a separate admin-only field.

## Decisions

### Use an accessible information button with an associated tooltip

Render a small button beside each chainsaw label and associate it with a tooltip element using stable IDs and appropriate ARIA attributes. The tooltip is visible while the button is hovered or focused and can be toggled by click/touch. This is preferred over relying solely on `title`, because native title tooltips are not consistently keyboard- or touch-accessible.

### Keep help separate from the checkbox label activation area

The information button will be adjacent to the descriptive label text without being nested as an interactive descendant that accidentally toggles the checkbox. Activating help must not alter the checkbox value.

### Reuse the established visual language

The control will retain the existing circular `i` appearance and help cursor, with added tooltip styling and visible focus treatment. This keeps the change visually consistent while allowing the interaction semantics to improve.

### Verify content and interaction in browser-oriented tests

Tests will assert both field-specific strings, the association between each trigger and tooltip, and access through focus and click/touch-equivalent activation. Existing profile persistence coverage remains responsible for checkbox saving.

## Risks / Trade-offs

- [Small custom tooltip behavior adds event-handling complexity] → Keep state local to information controls and use a shared helper/handler.
- [Click-open help could remain visible after the user moves on] → Close it on outside interaction or Escape while retaining hover/focus behavior.
- [Nested label/button markup can produce confusing activation] → Structure the checkbox label and help button as siblings within a field row.
- [Exact terse PRD wording may be unfamiliar to some users] → Preserve the approved text in this change; copy revisions can be proposed separately.
- [Legacy storage still contains an unused comments column] → Keep it inert to avoid a destructive database migration; it can be removed in a future versioned migration if required.
