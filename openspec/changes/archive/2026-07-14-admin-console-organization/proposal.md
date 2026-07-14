## Why

The Admin PRD now defines the Admin tab as a set of organized sections or subtabs instead of a single mixed panel of unrelated controls. The current admin surface already exposes several operations, but it needs a clear console structure before the larger volunteer, waiver, and work-party admin workflows are added.

## What Changes

- Organize the Admin tab into distinct admin sections or subtabs that match the Admin PRD.
- Add an Application settings area that groups the season mode control and assignment lottery controls.
- Keep existing admin-only access restrictions for the Admin tab and all admin operations.
- Preserve existing mode, lottery, joined download, and efficiency report behavior while relocating or labeling those controls within the organized console.
- Establish placeholder navigation destinations for future Manage volunteers/requestors, Review liability waivers, and Set up work parties work without implementing those workflows in this change.

## Capabilities

### New Capabilities
- `admin-console-organization`: Defines the Admin tab structure, section navigation, and placement of existing admin operations within the console.

### Modified Capabilities
- `admin-operations`: Existing assignment lottery, download requests, and efficiency report controls are presented inside the organized Admin console.
- `application-mode`: Existing season mode control is presented inside the Admin console's Application settings area.

## Impact

- Frontend Admin tab rendering and navigation in `public/js/app.js`.
- Admin tab markup and styling in `public/index.html` and `public/css/styles.css` if needed.
- Existing admin API routes for mode, assignment lottery, downloads, and efficiency reports should remain compatible.
- Focused browser or script coverage should verify admin-only visibility, section navigation, and preserved existing admin actions.
