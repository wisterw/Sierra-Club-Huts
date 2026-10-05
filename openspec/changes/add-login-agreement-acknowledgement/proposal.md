## Why

The app currently authenticates volunteers without displaying the supplied Terms of Use or Privacy Policy. Volunteers need to be able to read both documents and clearly understand that submitting their emailed login code acknowledges agreement to both.

## What Changes

- Publish public, mobile-readable Terms of Use and Privacy Policy pages using the exact supplied text in `openspec/specs/TERMS OF USE.md` and `openspec/specs/PRIVACY POLICY.md`, both last updated October 4, 2026.
- Display linked acknowledgement immediately beside the code/sign-in action: "By entering your code and logging in, you explicitly acknowledge that you have read and agree to our Privacy Policy and Terms of Use, including the Backcountry Assumption of Risk and absolute limitation of liability." Make the code field programmatically associated with this notice. No extra checkbox is required.
- Keep both documents accessible before sign-in and through a persistent footer after sign-in; reading them must not submit the code or discard the login destination.
- Include the supplied backcountry-risk and volunteer-liability acknowledgement language in every login-code email, alongside the existing code/expiry text and absolute links to both agreements.
- **BREAKING**: Replace automatic authentication from email/code or email/hash URLs with a prefilled login form requiring explicit Sign in activation after the notice is displayed. Retain existing link formats and credential query cleanup.
- Require current agreement versions with code verification and record a minimal private acknowledgement associated with the authenticated volunteer and server timestamp. Failed login or requesting a code does not record agreement.
- Preserve existing sessions without forced sign-out; show the acknowledgement on every subsequent code sign-in, including reauthentication and administrator login.

## Capabilities

### New Capabilities

- `login-agreements`: Public policy documents, accessible sign-in and email acknowledgement notices, current-version verification, and private acknowledgement persistence.

### Modified Capabilities

- `standalone-app-experience`: Require an explicit sign-in action for legacy code-bearing links while preserving guarded return destinations, session recovery, and credential URL cleanup.

## Impact

- Affects explicit Express policy routes, HTML/CSS, browser login initialization, login-code email composition in `src/services/auth.js`, canonical public app URL configuration, `/api/check-login`, SQLite acknowledgement storage, authentication/email/browser/migration tests, and README maintenance guidance.
- Existing API clients and test fixtures that verify codes must send the displayed agreement versions. The documents' content and dates remain as supplied; this change implements presentation and acknowledgement without rewriting their legal terms.
- Scope excludes registration, new third-party services, extra personal tracking, reservation-rule changes, retroactive acceptance, and an agreement-management admin console.
