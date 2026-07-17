## Context

An authenticated admin endpoint already accepts a multipart TSV file and calls the SQLite requestor upsert path, while the current Manage volunteers/requestors UI has no upload control. The legacy route performs case-sensitive header matching, builds full records with blank/default values, writes rows individually, and returns only a combined count. This makes re-exposure risky without first defining safe update semantics.

## Goals / Non-Goals

**Goals:**

- Restore bulk volunteer creation and update in the existing admin workflow.
- Preserve existing values when input cells are blank or columns are absent.
- Normalize headers and surrounding whitespace predictably without altering meaningful internal spaces.
- Validate before writing and commit the import atomically.
- Provide a minimal downloadable template and clear results.

**Non-Goals:**

- Supporting quoted tabs, embedded newlines, CSV, or spreadsheet formats other than TSV.
- Clearing stored fields through bulk import.
- Importing ski-trip requests or work-party participation.
- Redesigning the volunteer-management grid.

## Decisions

1. Refactor the existing route rather than introduce a parallel importer. The endpoint and multipart dependency already exist and are admin-protected; consolidating behavior avoids two import contracts.
2. Normalize each header with surrounding-whitespace trimming and lowercase comparison, then map recognized aliases to requestor properties. Unknown columns are ignored. The basic template will emit `Email`, `first_name`, `last_name`, `address`, `city`, `state`, `zip`, and `Phone` in that order.
3. Trim leading and trailing whitespace from every cell. Do not collapse or remove internal whitespace, so multi-part names, street addresses, and cities remain intact.
4. Treat email as the row identity and only required supported field. Reject an import before any write if the Email header is absent or a nonblank data row has an empty email. All other recognized fields are optional.
5. Build sparse update objects: only recognized, nonblank cells are supplied to the data layer. A new requestor receives existing data-layer defaults for omitted fields; an existing requestor retains stored values for blank or omitted cells. Clearing values remains an individual-edit workflow.
6. Parse and validate the entire file first, then execute every upsert in one SQLite transaction. Any validation or persistence failure rolls back the whole import. This favors predictable recovery over partial success.
7. Return separate created, updated, and skipped counts plus validation errors when rejected. Blank lines are skipped; unknown columns do not constitute row errors. The UI displays the result and reloads the volunteer grid only after a committed import.
8. Serve the sample through an admin-only download endpoint so both import and template discovery remain scoped to the Admin console. The response uses a TSV content type and attachment filename.

## Risks / Trade-offs

- [Risk] Legacy files may rely on exact but differently styled headers. → Use case-insensitive matching, trim header whitespace, and retain supported legacy aliases.
- [Risk] TSV values containing tabs or line breaks cannot be represented safely by the simple format. → Document the template as plain TSV and reject structurally malformed rows rather than guessing.
- [Risk] A large upload could consume memory or hold a transaction too long. → Apply an explicit upload-size limit and keep the operation synchronous and bounded.
- [Risk] Privileged extra columns could change admin-only data unexpectedly. → Maintain an explicit recognized-column allowlist and cover sensitive-field behavior with authorization tests.
- [Risk] Users may expect blank cells to clear values. → State preservation behavior beside the upload control and keep clearing in individual profile/admin edits.
