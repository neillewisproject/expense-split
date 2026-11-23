---
applyTo: 'src/features/**/data/**/*.ts,src/features/**/domain/**/*.ts,src/features/**/store.ts,src/features/groups/components/group-cloud-sync.tsx,src/features/auth/**/*.tsx,src/lib/**/*.ts,drizzle/**,supabase/**/*.sql'
---

# Domain, persistence, and sync

- Reuse existing domain helpers; amounts and split totals are integer minor units. Validate payer/participants and preserve settlement accounting.
- Local database access goes through `getExpenseDatabase`, which initializes foreign keys and migrations. Keep related writes transactional.
- Generate SQLite migrations from Drizzle schema changes. Add new Supabase migrations for changes to deployed schema; keep database types and RPC payloads consistent.
- Preserve local-only groups. Shared rows, query keys, pending uploads, and cache application must be scoped to the active account.
- A remote fetch must not overwrite pending local changes. Consider edits during upload, reconnects, retries, and late results from a prior account.
- Supabase access must be authorized by RLS/RPCs, not just UI guards. Keep authenticated access separate from named expense participants.
- Keep secrets out of client code and logs. Do not weaken auth, swap privileged keys into the app, or disable RLS to make a test pass.
- Test pure calculations locally. Explicitly distinguish mocked sync checks from live two-account/RLS/Realtime verification.
