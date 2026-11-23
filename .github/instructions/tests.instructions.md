---
applyTo: 'src/**/*.test.ts,src/**/*.test.tsx,jest/**'
---

# Testing

- Use Jest/jest-expo and React Native Testing Library already configured in `package.json`. Extend nearby tests before creating new suites.
- Await asynchronous `render` and user-visible results. Use accessible labels/roles and test behavior instead of private component structure.
- Mock native APIs and remote boundaries; never send real auth emails or contact a live project from unit tests.
- Restore mocks/store state only after unmounting subscribed components. Clean up subscriptions, timers, and TanStack Query caches.
- Use fixed fixtures for money/splits and a few cases covering the changed behavior and edge cases. Do not test constants or framework internals.
- Run related files together with `npm test -- --runInBand <paths>`. Investigate open handles instead of adding `--forceExit`, sleeps, or silently skipped assertions.
