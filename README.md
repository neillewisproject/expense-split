# Expense Split

An expense tracker with group bill splitting, built with Expo (React Native) + TypeScript as a learning project.

**Start here → [LEARNING_ROADMAP.md](./LEARNING_ROADMAP.md)**

The original milestones have been expanded with a personal ledger, manual accounts, advanced group splitting, and revision-checked offline collaboration. Supabase remains optional: groups created before sign-in remain local, and personal cloud backups require an explicit upload.

## Functionality

The app has five tabs:

- **Home**: this month's spending, income and net; recurring items awaiting approval; shortcuts; and recent activity.
- **Activity**: every transaction, with search, a filter sheet, trash/restore and bulk changes.
- **Groups**: shared and on-device groups, plus two-person balances under **People**.
- **Insights**: top categories this month, plus the spending breakdown, reports, budgets and savings goals.
- **More**: sign in or out, accounts, recurring schedules, categories and rules, privacy, import/export and cloud backup.

Screens are built from a small neumorphic design system on a warm cream and orange palette.

- Colour, spacing and radius tokens are in [`src/constants/theme.ts`](./src/constants/theme.ts).
- `neu()` and `inputWell()` in [`src/components/ui/neu.ts`](./src/components/ui/neu.ts) give surfaces raised, pressed-in or glowing depth using paired `boxShadow`s.
- Reusable components such as cards, buttons, chips, list rows, banners, bottom sheets and icons are in [`src/components/ui`](./src/components/ui).

Selected states are also filled orange, so they never rely on shadow alone. Light and dark mode follow the device setting. Soft shadows use React Native's `boxShadow`. Raised shadows need Android 9+ and pressed-in shadows need Android 10+; older Android versions show flatter surfaces.

| Area                  | Implemented functionality                                                                                                                                                                                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Personal transactions | Expenses, income, linked/capped refunds, same-currency transfers between manual accounts, notes, tags, custom categories, duplicate, confirmed bulk recategorize/tag/trash, restore, search/filters and up to ten local receipt photos.                                                                                   |
| Group expenses        | Selected-participant equal splits, exact amounts, percentages, shares, adjustments, multiple payers, saved inputs, manual itemization with discounts/tax/tips, capped linked refunds, categories/notes, edit/delete/restore, local receipt photos.                                                                        |
| Group management      | Rename/archive/reopen, participant add/rename/deactivate, explicit "me" mapping, owner-approved claims, author/owner editing, comments/history, rotating/expiring invites, ownership transfer and warned access removal/leave.                                                                                            |
| People                | Two-person groups use the same ledger engine. Cross-group summaries require verified user IDs and remain separated by group and currency; no name-based identity matching or automatic cross-group netting.                                                                                                               |
| Settlements           | Suggested or custom/partial recorded payments, payment dates/method/reference, corrections and void/restore. Explicitly link your actual group payments, refunds or receipts to a manual account. Recording never sends money. Simplification is deterministic/greedy, not a promise of mathematically minimum transfers. |
| Currency              | Currency-specific minor-unit precision, fixed manually entered group exchange-rate snapshots, original/base amounts and reconciled allocations. No automatic live-rate provider.                                                                                                                                          |
| Planning              | Monthly personal or combined group-share budgets with unused-budget carryover, date-range/comparison reports and unposted commitments, group per-person breakdowns, account-backed savings reservations/releases, zoned recurring approval drafts with optional end dates, and local reminders.                           |
| Portability           | Validated CSV preview/import/deduplication, spreadsheet-safe CSV export, versioned personal JSON preview/restore, document picking and file sharing/download. JSON contains financial data, not receipt image bytes or login tokens.                                                                                      |
| Privacy               | Optional device/passcode app lock, explicit private personal cloud snapshots with revision checks, explicit private shared-receipt uploads and short-lived links. App lock is not database encryption.                                                                                                                    |
| Offline collaboration | Durable SQLite operation queue, atomic authenticated server mutations, revisions/idempotency, deleted-row propagation, account isolation, and visible conflict recovery. Existing local groups never upload automatically.                                                                                                |

Cloud receipt uploads require a saved/synced shared expense; open **Shared receipts** from its editor. Current private cloud backup is manual snapshot backup/restore, not continuous bidirectional personal sync.

Open a group and choose **Review shareable summary** to preview names, balances and suggested repayments before opening the device share sheet. Notes, receipt photos and invite links are not included.

In **More → Categories & rules**, add and prioritize literal description-to-category rules for expenses or income. The first match suggests a category in the transaction form; you must tap to apply it. Rules never change existing records, refunds, transfers or recurring drafts automatically.

### Explicit limitations and follow-ups

- Native on-device OCR and remote push infrastructure are deferred pending integration/build approval; manual itemization, photo capture, local reminders, and in-app activity work without those services.
- Lossless backups including image bytes and group ledgers, external-app-specific import adapters, and automatic private personal sync are follow-ups. Personal JSON v7 includes category rules, budget basis, group cash snapshots and transaction matches alongside savings goals/reservations, carryover and schedule time zones/end dates. Versions 1–6 remain importable; older backups have no category rules, older budgets use the personal-only basis, versions 1–3 have no group cash snapshots, and version 4 has no transaction matches. Older schedules use device time. Cash snapshots include group, entry, participant and local account identifiers, but omit signed-in user IDs; backups contain no login tokens.
- Refunds preserve the original payer/share allocation and fixed exchange-rate snapshot; arbitrary item-specific refund overrides and automatic cross-group netting are not implemented. Invitation links remain forwardable bearer links until revoked/expired; accepting them requires sign-in.
- Group-share consumption is distinct from personal ledger totals. Link cash as a new snapshot, or manually match one existing personal transaction with the same account, currency, amount and direction to avoid counting its account effect twice. Combined budgets subtract matched personal transactions and add your group shares. Unmatched personal entries can still double-count a group expense; review and match them. Combined budgets cannot filter by account/tag and include only locally available groups. Void a match before changing its transaction's accounting fields or deleting it; its transaction remains. Snapshots stay fixed after group edits; void them and record a correction if needed. Partial matches are not yet implemented.
- Live auth, RLS, Storage, Realtime, notifications, biometrics, and multi-device behavior require configured-backend/device checks. Unit tests and JS exports alone do not prove them.
- No bank connection, payment processing, cloud OCR or advertising is included. Dates are still typed as `YYYY-MM-DD`; a native date picker is a follow-up.

## Run it on your phone

1. Install **Expo Go** from the Play Store / App Store.
2. `npm install` (first time only)
3. `npm start` and scan the QR code (Android: in Expo Go; iOS: with the Camera app).

Phone and PC must be on the same Wi-Fi network; otherwise use `npx expo start --tunnel`.

## Scripts

| Command                 | What it does                                                          |
| ----------------------- | --------------------------------------------------------------------- |
| `npm start`             | Start the Metro dev server                                            |
| `npm test`              | Run Jest unit/component tests                                         |
| `npm run test:watch`    | Re-run tests on change                                                |
| `npm run check`         | Typecheck + lint + format + serial Jest                               |
| `npm run test:database` | SQLite upgrade and isolated PostgreSQL/RLS fixtures; no live services |
| `npm run format`        | Format all files with Prettier                                        |
| `npm run doctor`        | Diagnose Expo dependency / config issues                              |

Add packages with `npx expo install <package>` so versions match the Expo SDK.

## AI development setup

The repository includes a Copilot-first setup tailored to this stack. It does not install plugins, change models, grant permissions, or run deployments.

- **Shared instructions:** [AGENTS.md](./AGENTS.md) defines architecture, data invariants, SDK documentation checks, validation, and safety boundaries.
- **Copilot instructions:** [.github/copilot-instructions.md](./.github/copilot-instructions.md) points to the shared context. Files in [.github/instructions/](./.github/instructions/) load automatically when their paths match: workflow (all files), UI design system, mobile, native runtime, auth, data, schema and backups, and tests. They record the project's conventions and the bugs already found, such as shadow clipping, Hermes `BigInt` formatting, SecureStore keys and PKCE link handling.
- **Agents:** [Mobile Builder](./.github/agents/mobile-builder.agent.md) implements features/fixes; [Mobile Reviewer](./.github/agents/mobile-reviewer.agent.md) and [Learning Coach](./.github/agents/learning-coach.agent.md) use read/search tools only. Agent formats/tool enforcement differ between AI clients; this configuration targets Copilot.
- **Skills:** [expo-debug](./.github/skills/expo-debug/SKILL.md), [local-first-sync](./.github/skills/local-first-sync/SKILL.md), and [milestone-delivery](./.github/skills/milestone-delivery/SKILL.md) are task-specific workflows, loaded on demand rather than repeating everything in every request.

### Activate and verify in VS Code

1. Open **the `expense-split` folder itself**, not only its parent `Mobile` folder. Repository-native customization discovery is most reliable from the project root.
2. Select the Copilot harness in Chat and run **Chat: Open Customizations** from the Command Palette.
3. Confirm the agents, instructions, and skills appear without file errors. Start a fresh chat; existing sessions may retain old customization state.
4. Choose an agent from the agent dropdown or type `/` to find a skill. Try a small known task and inspect which tools it uses. Discovery alone is not evidence of correct runtime behavior.

Example requests:

```text
Mobile Builder: Fix this expense layout and preserve large-text accessibility.
Mobile Reviewer: Review the supplied group-sync changes; do not edit files.
Learning Coach: Explain how a settlement affects balances, then give me one exercise.
/expo-debug Diagnose this getSnapshot error using the attached Metro log.
/local-first-sync Add a field without uploading existing local groups.
/milestone-delivery Implement the next roadmap milestone with acceptance checks.
```

Select the named agents in the dropdown; the prefixes above describe the intended role, not special chat syntax. Skills can also be selected automatically when supported. `AGENTS.md` and the skill format are reusable, but other harnesses may require their own discovery locations. Do not duplicate or install external skills blindly.

Official references: [Copilot instructions](https://docs.github.com/en/copilot/how-tos/copilot-in-your-ide/customize-copilot/configure-custom-instructions/add-repository-instructions-in-your-ide), [custom agents](https://code.visualstudio.com/docs/agent-customization/custom-agents), and [agent skills](https://code.visualstudio.com/docs/agent-customization/agent-skills).

## Enable shared groups (Milestone 4)

1. Create a Supabase project and apply every SQL file in [supabase/migrations/](./supabase/migrations/) in filename order using its SQL Editor or the Supabase CLI. See the upgrade section below for ordering and older-client compatibility.
2. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the Supabase project’s Connect dialog. These are client-side values; never put a service-role key in the app.
3. In Supabase Auth, enable email sign-in and add `expensesplit://**` and `exp://**` to the allowed redirect URLs. Under **Authentication → Emails → Magic Link**, add `{{ .Token }}` to the template so the email includes the 6-digit code the app asks for.
4. Restart Expo after changing `.env`. Sign in with the emailed code (or link), then create a new group to share it. Groups already on the device remain local-only.

Shared group changes are saved in SQLite first and queued for retry when connectivity returns. Authenticated group members can use invite links; Realtime refreshes the local cache when other members add or change shared group data. Google and Apple sign-in are not configured in this email-first milestone.

### Upgrade an existing Supabase project

Back up the backend and apply only unapplied migrations. For a new project, apply every file in [supabase/migrations/](./supabase/migrations/) in filename order:

1. The original shared-group schema.
2. [Private personal backups](./supabase/migrations/20261123000002_personal_backups.sql).
3. [Revision-checked group operations](./supabase/migrations/20261123010000_group_operations.sql).
4. [Group refunds and access lifecycle](./supabase/migrations/20261123020000_group_refunds_and_access.sql).
5. [Private receipt Storage](./supabase/migrations/20261123030000_private_receipts.sql), which depends on the group-operation metadata.

The group protocol deliberately stops older clients from directly modifying shared tables. Update clients together with the migration; do not weaken RLS to make an old client work. Offline queues must sync or be explicitly resolved before changing accounts/group access.

SQLite migrations are bundled and applied on-device automatically. They preserve existing INR amounts, receipt references, settlements, and local-only group ownership. Do not reset app data to upgrade.

Local notifications work in supported Expo Go runtimes. Remote push on Android and Face ID on iOS need a development build and separate setup. Restart Metro after dependency changes.

Requires Node.js 22.13+ (installed: Node 24 LTS).
