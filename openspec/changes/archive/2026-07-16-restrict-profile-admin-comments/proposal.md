## Why

The profile page currently renders the private-comments control for non-admin users, despite the field being intended for internal administrative use. The label and guidance also need to state the field's audience and appropriate matter-of-fact purpose clearly.

## What Changes

- Hide the internal comments field entirely on the profile page for non-admin users rather than rendering a disabled control.
- Rename the admin-visible profile field from "Private comments" to "Admin-only comments."
- Add hover-accessible information explaining that entries should be matter-of-fact and useful to hut leaders and admins evaluating the volunteer for future work parties.
- Preserve server-side authorization so non-admin profile responses and updates cannot read or mutate the comments.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `requestor-profile`: Clarify that the internal comments profile control is rendered only for admins and specify its label and explanatory hover information.

## Impact

- Profile-page rendering and interaction code in `public/js/app.js`.
- Requestor profile privacy and admin-only field tests.
- No database schema or public API shape change is expected; the existing `private_comments` storage/API field can remain an internal implementation detail.
