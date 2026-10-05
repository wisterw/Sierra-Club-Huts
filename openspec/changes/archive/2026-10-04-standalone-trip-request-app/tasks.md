## 1. Standalone shell and introduction

- [x] 1.1 Update the app heading and signed-out introduction to explain volunteer trip requests, availability review, requests versus reservations, and email-code access for administrator-loaded volunteers.
- [x] 1.2 Make signed-in navigation persistent and accessible, preserving existing mode-disabled tabs, their hover messages, and admin visibility rules.

## 2. Principal destination routing

- [x] 2.1 Implement centralized pathname parsing and mode/role guards for `/trip-requests`, `/profile`, `/admin`, and `/work-parties`, with root/unknown-path defaults and fallback explanations.
- [x] 2.2 Connect navigation to history updates and implement `popstate` restoration without creating extra entries; verify direct page loads and root-relative assets/API routing through Express.
- [x] 2.3 Separate mode availability updates from destination selection so startup preserves authorized deep links and saved mode changes revalidate the current destination.

## 3. Authentication continuity

- [x] 3.1 Preserve recognized destinations through email-code sign-in and distinguish expired-session responses from network and other API errors.
- [x] 3.2 Hide private views on session expiry, retain unsaved choices in memory for same-requestor reauthentication, clear drafts on account changes and logout, and prevent automatic draft submission.
- [x] 3.3 Preserve legacy email/code and email/hash login links while removing credential query parameters after each attempt; keep return navigation limited to recognized app paths.

## 4. Responsive presentation

- [x] 4.1 Refine header, sign-in, navigation, profile, and admin navigation for narrow screens with visible focus and accessible control names.
- [x] 4.2 Stack the request editor and availability view on mobile, confine wide tables to local scroll containers, and keep save actions, feedback, and availability headings usable at 360 CSS pixels.

## 5. Verification and deployment guidance

- [x] 5.1 Add focused browser coverage using an isolated database for direct links, refresh, back/forward, root/unknown paths, non-admin Admin access, and unavailable destinations in all three modes.
- [x] 5.2 Verify normal and legacy login, destination restoration, expired-session handling, same-account draft recovery, different-account draft clearing, logout, and non-authentication errors.
- [x] 5.3 Visually verify mobile and desktop sign-in, trip editing/availability, profile, and authorized admin navigation; exercise keyboard navigation and a complete request save/reload journey.
- [x] 5.4 Run relevant existing `test:mode`, `test:trip-request`, `test:profile`, `test:admin-console`, and `test:smoke` checks, confirming no changes to reservation rules or persisted mode behavior.
- [x] 5.5 Update README user and deployment guidance for standalone HTTPS hosting, direct-route checks, mail/session settings, eligible volunteer loading, and administrator activation of Trip Request mode; document deployment verification and rollback without changing production state during implementation.
