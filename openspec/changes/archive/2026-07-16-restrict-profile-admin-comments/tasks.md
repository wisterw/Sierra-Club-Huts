## 1. Profile UI

- [x] 1.1 Render the complete `private_comments` form fragment only for admin users and rename its visible label to "Admin-only comments"
- [x] 1.2 Add the specified comments guidance using the existing accessible information-control interaction for hover, focus, click, and touch
- [x] 1.3 Ensure profile submission includes `private_comments` only for admins while retaining existing server-side response and mutation authorization

## 2. Verification

- [x] 2.1 Add or update profile tests proving non-admins cannot see the comments label, help, input, or response property and cannot mutate the value
- [x] 2.2 Add or update admin profile tests covering the new label, exact guidance, accessible help association, and successful comment persistence
- [x] 2.3 Run the relevant automated profile and smoke test suites and resolve any regressions
