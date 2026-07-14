## Context

The application already stores `liability_waiver_date` on requestors and uses that date to determine whether a volunteer has an approved waiver for a work-party year. Admin volunteer management can approve a waiver date, but the admin Review liability waivers section is still a placeholder and the profile page does not yet provide the blank-waiver download or submitted-waiver upload flow described in the PRD.

This change spans profile UI, admin UI, API routes, SQLite persistence, and filesystem storage. Waiver documents can contain personal signatures, so submitted files must be treated as private admin-only documents.

## Goals / Non-Goals

**Goals:**
- Let volunteers download the current blank waiver from their profile.
- Let volunteers upload a completed waiver file and see a short submitted-for-review confirmation.
- Persist submitted waiver files in a dedicated server-side directory and store only the current waiver pointer on the requestor.
- Let admins review current-year waiver submissions, download/open the file, and approve the waiver.
- Preserve the existing year-based `approved` waiver status semantics.

**Non-Goals:**
- No prior-year waiver browser, pruning, or deletion workflow.
- No electronic signature validation or OCR.
- No external object storage integration.
- No public exposure of submitted waiver documents or filesystem paths.

## Decisions

1. Store waiver files on the local filesystem and keep a requestor pointer in SQLite.

   Rationale: The current app is a local Node/SQLite application and the PRD calls for a dedicated filesystem folder. Storing only a pointer avoids putting binary data in SQLite and keeps backups/deployment simple. Alternative considered: storing files in SQLite BLOBs, which would simplify referential integrity but make downloads, backups, and manual recovery more awkward.

2. Track only the current submitted waiver pointer on `requestors`.

   Rationale: The PRD explicitly says prior-year waiver pointers do not need to be retained in the database. A new upload replaces the previous pointer for that requestor while old files may remain on disk. Alternative considered: a `liability_waivers` history table, which adds review history but exceeds the requested scope.

3. Gate all submitted-waiver metadata and downloads behind admin authorization.

   Rationale: Waivers contain private signed documents. Non-admin users only need to upload their own file and see review status. Alternative considered: allowing users to download their own submitted waiver, but that adds access-control complexity without a stated workflow need.

4. Use current-year filtering for the admin review queue.

   Rationale: Existing waiver status is evaluated by whether `liability_waiver_date` falls in the selected year. The review queue should follow the same administrative year context and show submitted, unapproved waivers for that year.

## Risks / Trade-offs

- Filesystem pointer drift -> validate that stored pointers resolve under the waiver storage directory before serving files.
- Large or unsafe uploads -> enforce a conservative upload size limit and allow only common document/image MIME types.
- Duplicate submissions -> replace the current pointer and keep review status pending until an admin approves.
- Approval race with a new upload -> approval should apply to the current stored waiver pointer at the time of approval.
- Local filesystem storage limits portability -> acceptable for the current app, but the storage interface should stay isolated enough to replace later.

## Migration Plan

1. Add nullable requestor columns for current waiver file pointer and submitted timestamp.
2. Create the waiver storage directory at startup if it does not exist.
3. Preserve existing `liability_waiver_date` values and treat requestors without a waiver pointer as having no current submitted file.
4. Rollback can leave uploaded files on disk; the database columns are additive and do not affect existing login, profile, or admin-volunteer behavior.

## Open Questions

- Which exact blank liability waiver file should ship with the app, and where should it live in the repository?
- What maximum upload size should be enforced for scanned image/PDF waiver files?
