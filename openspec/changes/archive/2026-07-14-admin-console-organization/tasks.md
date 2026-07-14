## 1. Admin Console Shell

- [x] 1.1 Refactor Admin tab rendering to use admin-local section navigation.
- [x] 1.2 Make Application settings the default active Admin console section.
- [x] 1.3 Add Admin console sections for Manage volunteers/requestors, Review liability waivers, Download requests, Efficiency report, and Set up work parties.
- [x] 1.4 Ensure non-admin users cannot see or navigate to Admin console sections.

## 2. Existing Operation Placement

- [x] 2.1 Move the season mode selector into the Application settings section without changing its API behavior.
- [x] 2.2 Move the run lottery control and regenerate lottery numbers checkbox into the Application settings section with regeneration defaulted to on.
- [x] 2.3 Move the joined request download action and filters into the Download requests section.
- [x] 2.4 Move the efficiency report loader and report output into the Efficiency report section.

## 3. Future Workflow Placeholders

- [x] 3.1 Add non-actionable placeholder content for Manage volunteers/requestors.
- [x] 3.2 Add non-actionable placeholder content for Review liability waivers.
- [x] 3.3 Add non-actionable placeholder content for Set up work parties.

## 4. Styling and Interaction

- [x] 4.1 Add or adjust styles for Admin console section navigation, active section state, and section content layout.
- [x] 4.2 Verify Admin console text and controls fit on desktop and mobile widths without overlap.
- [x] 4.3 Preserve existing status and result messages for mode saves, lottery actions, downloads, and efficiency report loading.

## 5. Verification

- [x] 5.1 Add or update focused tests for Admin console section navigation and admin-only visibility.
- [x] 5.2 Verify existing application mode behavior still works from the reorganized Application settings section.
- [x] 5.3 Verify existing assignment lottery, download requests, and efficiency report actions still use their existing backend behavior.
- [x] 5.4 Run the relevant existing admin, mode, assignment, and browser smoke checks.
