---
applyTo: 'src/**/*.test.ts,src/**/*.test.tsx,jest/**'
---

# Testing

- Use Jest/jest-expo and React Native Testing Library already configured in `package.json`. Extend nearby tests before creating new suites.
- Await asynchronous `render` and user-visible results. Use accessible labels/roles and test behavior instead of private component structure.
- Mock native APIs and remote boundaries; never send real auth emails or contact a live project from unit tests.
- Restore mocks/store state only after unmounting subscribed components. Clean up subscriptions, timers, and TanStack Query caches.
- Use fixed fixtures for money/splits and a few cases covering the changed behavior and edge cases. Do not test constants or framework internals.
- Run related files together with `npm test -- --runInBand <paths>`. Investigate open handles instead of adding `--forceExit`, sleeps, or silently skipped assertions. Save the full `npm run check` for the end of the task (see `workflow.instructions.md`).

## Gotchas in this project

- Importing `expo-router` for real fails in Jest (ESM `standard-navigation`). Mock it per test (`router`, `useLocalSearchParams`) and keep it out of `src/components/ui`.
- Components that read Supabase or cloud sync (for example `group-detail`) need `@/lib/supabase` and `../data/cloud-sync` mocked to avoid AsyncStorage native-module errors.
- `toHaveProp('accessibilityState', …)` compares exactly. `Pressable` adds `disabled: false`/`busy: false` if you pass them, so components only include those keys when true.
- `getByRole('alert')` finds `Text` elements with the role; a `View` with `accessibilityRole="alert"` is not matched unless it is accessible. `Banner` puts the role on its message text.
- `Sheet` uses `Modal`; its content renders only while `visible`, so open it (press the trigger) before querying inside.
- Mock `ReanimatedSwipeable` to render `renderRightActions(progress, translation, { close })` only in tests that need the actions; otherwise extra buttons break `getByRole('button')`.
- Hermes-only failures (for example `Intl` with `BigInt`) do not reproduce in Node. Simulate them by spying on the API and throwing, as in `domain.test.ts`.
- Layout regressions can be unit-tested by asserting the critical style (for example the tab root keeps `flex: 1` in `app-tabs.test.tsx`), but say that the visual result is unverified.
