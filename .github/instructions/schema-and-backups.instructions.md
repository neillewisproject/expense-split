---
applyTo: 'drizzle/**,src/features/**/data/schema.ts,src/features/import-export/**,scripts/check-sqlite.cjs,scripts/check-database.cjs,supabase/**'
---

# Schema changes and backup compatibility

SQLite on the device is the source of truth, and users keep data across app updates and restore old JSON backups. Every persisted change must stay upgrade-safe.

## Adding or changing a persisted field (checklist)

1. Change the Drizzle schema in `src/features/<feature>/data/schema.ts`. Prefer additive columns with a `NOT NULL DEFAULT` so existing rows stay valid.
2. Run `npm run db:generate`. Review the new SQL file, `drizzle/meta/_journal.json` and the import list in `drizzle/migrations.js`. Never edit or reorder migrations that have already shipped.
3. Extend `scripts/check-sqlite.cjs` so the upgrade fixture proves old rows survive and the new field persists; run `npm run test:database`.
4. If the data belongs in personal backups, bump the backup version in `src/features/import-export/domain/portability.ts`:
   - add the new literal to the accepted versions;
   - give older versions a safe default during upgrade (for example, missing rules become `[]` and missing budget basis becomes `personal`);
   - write the field in `data/portability.ts` (create and restore);
   - add tests that an older version still previews/restores and that invalid new data is rejected.
5. Update the backup/restore wording in `README.md` (which versions remain importable and what older backups lack).
6. Supabase changes go in a new file under `supabase/migrations/` with matching types in `src/lib/supabase.types.ts`; keep RLS/RPC authorization. Do not apply migrations to a live project without explicit approval.

## Invariants

- Money is stored as safe-integer minor units. Validate with the existing money helpers; never store floats.
- Personal writes go through `personalMutation` (serialized) and multi-row changes use one transaction (`db.transaction`).
- Derived features must not silently rewrite history: suggestions (category rules) apply only to new entries after explicit acceptance; recurring items create drafts that need approval.
- A matched group-cash movement must not change an account balance a second time; voiding a match keeps the personal transaction.
- Backups never contain login tokens or signed-in user IDs; receipt image bytes are omitted and counted.
