This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Project context

Expense Split is a learning application with personal expenses, named group participants, bill splitting, receipts, and optional shared groups.

- Read `package.json` for current versions. The stack is Expo, React Native, React, strict TypeScript, Expo Router, Zustand, TanStack Query, Drizzle with expo-sqlite, Supabase Auth/Postgres/Realtime, react-hook-form, Zod, Reanimated, and Gesture Handler.
- `src/app/` contains routes only. Auth screens are in `(auth)`; application screens and tabs are in `(app)`; invite routes are public.
- `src/features/*/domain/` contains pure domain logic; `data/` contains persistence; stores expose client state; feature components contain reusable UI.
- Shared UI, theme tokens, and hooks live in `src/components/`, `src/constants/theme.ts`, and `src/hooks/`. Build screens from the design system in `src/components/ui` (Screen, Card, Button, Chip, ListRow, Banner, Sheet, Icon) instead of hard-coded colours. Use the `@/` source alias.
- SQLite is the local source of truth. Remote groups are cached locally and local changes are queued for upload.
- Existing local groups remain local. New groups created while signed in belong to that account. Do not automatically upload existing groups.
- `group_access` represents authenticated users with access; `group_members` represents named expense participants. These are distinct concepts.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Additional repository commands (run from the project root):

```bash
npm run check             # typecheck, lint, formatting, and Jest
npm test -- --runInBand   # unit/component tests
npm run db:generate       # generate and format bundled SQLite migrations
npm run test:database     # SQLite upgrades and isolated PostgreSQL/RLS; no live services
npx expo export --platform android # validate the Android JS bundle, not a device test
```

Run only targeted checks (typecheck and the touched test files) while developing; the user prefers not to wait for the full suite repeatedly. When all requested work is done, run `npm run check` once. For changes to native imports, routing, or bundling, also export Android. Documentation/configuration-only changes need formatting and configuration validation, not an unnecessary app rebuild. Never describe a bundle export as on-device verification.

## Engineering invariants

- Money uses integer minor units, not floating-point currency arithmetic. Reuse the existing money, split, balance, and settlement helpers.
- Keep Zustand selectors referentially stable. Do not return fresh arrays or objects from a selector without appropriate equality handling; select stable state and derive values with `useMemo`, or use an existing shallow-selector pattern.
- TanStack Query keys for shared data include the account ID. Preserve account filtering, pending local writes, retry behavior, and cleanup of auth/network/Realtime listeners.
- SQLite schema changes require `npm run db:generate` and review of SQL, the migration journal, and bundled migration imports. Do not rewrite previously applied migrations.
- Supabase schema changes use new migrations in `supabase/migrations/` and matching TypeScript database contracts. Preserve RLS and RPC authorization.
- Use existing theme tokens and native primitives. Preserve safe areas, keyboard behavior, dark mode, screen-reader labels, and large-text layouts.
- Surface actionable errors in the UI and log relevant diagnostic context without tokens, email codes, personal expense data, or credentials. Do not hide failures behind success-shaped defaults.
- Follow existing tests. React Native Testing Library rendering is asynchronous in this project; await `render`. Mock native boundaries, clean up listeners/query clients, and never mask hanging tests with `--forceExit`.

## Working safely and teaching

- Read related implementation and tests before editing. Make focused changes, preserve unrelated work, and update directly related documentation.
- Explain the key concept and why the chosen approach fits the stack, briefly. Do not turn each task into a large tutorial unless requested.
- Do not read or print `.env` values to diagnose configuration. Report presence/format checks only. Never request passwords, service-role keys, auth tokens, or email codes in chat.
- `EXPO_PUBLIC_*` values are shipped to clients. Only client-safe Supabase project URLs and publishable keys belong there; privileged credentials never belong in the app.
- Do not delete app data, reset a database, run remote migrations, change cloud settings, send auth emails, deploy, install plugins, commit, or push without an explicit request covering that action.
- Diagnose from the actual error and stack trace. Mark unavailable device, email, RLS, and multi-user checks as unverified rather than claiming success.

## AI customization

This file is the shared project context. Copilot discovery files live in `.github/`: path-specific instructions in `instructions/`, selectable roles in `agents/`, and on-demand workflows in `skills/`. Read the relevant instructions and use a matching skill when available. Agents are optional roles, not a mandatory delegation pipeline. See the README for activation and examples.

Path-specific instructions:

- `workflow.instructions.md` (all files): validation cadence, Windows editing pitfalls, reporting.
- `ui-design-system.instructions.md`: neumorphic tokens, depth, shadow clipping, components, tab bar.
- `mobile.instructions.md`: routing, state selectors, effects, guest navigation.
- `native-runtime.instructions.md`: Hermes vs Node differences, Expo Go limits, web, deep links.
- `auth.instructions.md`: email OTP, PKCE link handling, SecureStore, dashboard setup.
- `data.instructions.md` and `schema-and-backups.instructions.md`: domain, sync, migrations, backup versioning.
- `tests.instructions.md`: Jest/RNTL conventions and project-specific mocking gotchas.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. Check SDK-matched compatibility before adding a native library; modules outside that bundle require a development build. Do not regenerate native projects just to debug JavaScript.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
