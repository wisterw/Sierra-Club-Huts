## 1. Profile Help Controls

- [x] 1.1 Add accessible information controls and associated tooltip content beside both chainsaw Profile fields using the exact specified help text.
- [x] 1.2 Implement hover, keyboard focus, click/touch toggle, Escape dismissal, and outside-interaction dismissal without changing checkbox values.
- [x] 1.3 Add tooltip, focus, and responsive styling consistent with the existing circular information icon treatment.

## 2. Verification

- [x] 2.1 Add automated assertions for both help strings, accessible trigger-to-content associations, and independent checkbox behavior.
- [ ] 2.2 Add browser coverage for pointer, keyboard, and click/touch-equivalent interactions, including dismissal behavior.
- [x] 2.3 Run the relevant profile and browser smoke test suites and resolve regressions.

## 3. Remove Obsolete Profile Comments

- [x] 3.1 Remove the general Comments control and payload field from the Profile UI while retaining Other skills and private comments.
- [x] 3.2 Ignore the obsolete Comments property in profile updates and remove it from the profile schema documentation.
- [x] 3.3 Add regression coverage confirming the field is absent from the UI and cannot be updated through the profile store path.
