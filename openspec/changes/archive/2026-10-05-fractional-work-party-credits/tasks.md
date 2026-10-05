## 1. Exact credit representation

- [x] 1.1 Add shared exact credit parsing, tenths conversion, and canonical formatting helpers with precision and range validation.
- [x] 1.2 Change SQLite schema and repository mappings to credits_tenths and implement transactional, validated, one-time legacy migration.
- [x] 1.3 Apply consistent credit validation to startup TSV imports and the legacy TSV repository.

## 2. App and data boundaries

- [x] 2.1 Validate admin profile credit updates before any mutation and return clear HTTP 400 errors.
- [x] 2.2 Validate bulk upload credits with row context while preserving blank-cell semantics and atomic uploads.
- [x] 2.3 Enable profile input steps of 0.1 and canonical display while retaining admin-only editing.
- [x] 2.4 Audit assignments, availability summaries, SQL references, and exports for credit units and fractional priority behavior.

## 3. Verification and documentation

- [x] 3.1 Add targeted helper, migration/restart/rollback, persistence, API authorization, import/export, and fractional priority regression coverage.
- [x] 3.2 Verify admin profile fractional editing and read-only volunteer presentation in a browser.
- [x] 3.3 Update schema documentation and README with exact storage, accepted values, migration, and rollback guidance.
- [x] 3.4 Run relevant existing suites, syntax and diff checks, and strict OpenSpec validation; mark verified tasks complete.
