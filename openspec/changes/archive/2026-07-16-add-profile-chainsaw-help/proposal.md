## Why

The end-user PRD requires explanatory help for both chainsaw profile fields, but the current Profile UI renders only plain checkboxes. Users therefore lack the definitions needed to answer these skill questions consistently.

## What Changes

- Add contextual information controls beside the experienced chainsaw user and chainsaw owner/tuner checkboxes.
- Show the PRD-defined help text for each field.
- Make the help available through pointer hover, keyboard focus, and touch/click interaction so it is not limited to mouse users.
- Add automated coverage for the help controls and their field-specific content.
- Remove the obsolete general Comments field from the Profile UI and profile schema; Other skills remains the user-editable free-text field.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `requestor-profile`: Require accessible, contextual help for the two chainsaw-related profile fields and remove the obsolete general Comments profile field.

## Impact

- Affects Profile form rendering and the shared information-control styling/behavior in `public/js/app.js` and `public/css/styles.css`.
- Affects frontend/browser tests covering the Profile tab.
- Removes Comments from profile updates while retaining the legacy persistence column for compatibility with existing databases and imports; no dependency changes.
