# Expense Split

An expense tracker with group bill splitting, built with Expo (React Native) + TypeScript as a learning project.

**Start here → [LEARNING_ROADMAP.md](./LEARNING_ROADMAP.md)**

Milestones 1–3 are implemented. The app supports personal and group expenses, receipt photos, spending charts, and local-first groups. Milestone 4 adds optional Supabase accounts and sharing; groups created before sign-in remain local unless you explicitly recreate them as shared groups.

## Run it on your phone

1. Install **Expo Go** from the Play Store / App Store.
2. `npm install` (first time only)
3. `npm start` and scan the QR code (Android: in Expo Go; iOS: with the Camera app).

Phone and PC must be on the same Wi-Fi network; otherwise use `npx expo start --tunnel`.

## Scripts

| Command              | What it does                             |
| -------------------- | ---------------------------------------- |
| `npm start`          | Start the Metro dev server               |
| `npm test`           | Run Jest unit/component tests            |
| `npm run test:watch` | Re-run tests on change                   |
| `npm run check`      | Typecheck + lint + format check + tests  |
| `npm run format`     | Format all files with Prettier           |
| `npm run doctor`     | Diagnose Expo dependency / config issues |

Add packages with `npx expo install <package>` so versions match the Expo SDK.

## Enable shared groups (Milestone 4)

1. Create a Supabase project and run [`supabase/migrations/20261123000000_shared_groups.sql`](./supabase/migrations/20261123000000_shared_groups.sql) in its SQL Editor (or apply it with the Supabase CLI).
2. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the Supabase project’s Connect dialog. These are client-side values; never put a service-role key in the app.
3. In Supabase Auth, enable email sign-in and add `expensesplit://auth/callback` to the allowed redirect URLs. When testing in Expo Go, also allow the development URL returned by Expo Linking.
4. Restart Expo after changing `.env`. Sign in with an emailed link, then create a new group to share it. Groups already on the device remain local-only.

Shared group changes are saved in SQLite first and queued for retry when connectivity returns. Authenticated group members can use invite links; Realtime refreshes the local cache when other members add or change shared group data. Google and Apple sign-in are not configured in this email-first milestone.

Requires Node.js 22.13+ (installed: Node 24 LTS).
