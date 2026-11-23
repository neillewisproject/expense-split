---
name: local-first-sync
description: Change or diagnose SQLite persistence, Drizzle migrations, Supabase auth/RLS/invites, offline queues, and Realtime caching in Expense Split while preserving account ownership and pending writes.
---

# Local-first data changes

Read [AGENTS.md](../../../AGENTS.md), then trace only the path affected by the request:

- Local initialization: `src/features/expenses/data/database.ts`.
- Tables/models/actions: `src/features/groups/data/schema.ts`, `domain/group.ts`, and `store.ts`.
- Sync orchestration: `src/features/groups/data/cloud-sync.ts` and `components/group-cloud-sync.tsx`.
- Auth/client contracts: `src/features/auth/auth-provider.tsx`, `src/lib/supabase.ts`, and `src/lib/supabase.types.ts`.
- Remote authorization: `supabase/migrations/`.

## Workflow

1. Establish the write/read sequence and ownership: guest-local or account-shared. Separate authenticated access from named expense participants.
2. Identify the change's failure cases: offline save, reconnect, failed upload, duplicate retry, concurrent local edits, stale remote snapshots, and account switch/sign-out.
3. Reuse transactions, validation, query keys, and retry mechanisms. Never overwrite pending local changes with a remote cache refresh or expose a previous account's rows.
4. For local schema changes, run `npm run db:generate`; review generated SQL, journal order, snapshots, and runtime imports. For remote changes, add a migration and align types/RPC contracts.
5. Verify RLS/RPC authorization from the migration. Do not apply remote migrations, disable policies, or send test emails without explicit authorization.
6. Add focused tests for changed behavior where existing tooling can exercise it. Mock native/network boundaries and clean up query clients/listeners.
7. Report a verification matrix: guest-local, account A, account B, offline/retry, and live RLS/Realtime. Mark unavailable live cases as unverified.

Never print `.env` values or accept privileged keys as a workaround. Successful bundling is not evidence that a deployed policy or multi-user flow works.
