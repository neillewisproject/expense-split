---
name: expo-debug
description: Diagnose Expo startup, routing, native-module, React render-loop, and device errors from real logs. Use when Expense Split crashes, warns, fails to navigate, or behaves differently on a phone.
---

# Evidence-first Expo debugging

1. Read [AGENTS.md](../../../AGENTS.md) and `package.json`. Determine the platform, Expo Go versus development build, and the exact action triggering the issue.
2. Locate `metro.log` if present. Read the relevant error and first application frames, not an entire log dump. If no saved log exists, request the error/stack or use an approved terminal/UI inspection tool. Do not invent a cause from the last conversation.
3. Map the first relevant app frame to its component, store, or native boundary. Read related layout/provider code and tests.
4. For Expo APIs, consult SDK-matched documentation. For `getSnapshot`/update-depth errors, inspect selectors returning fresh objects/arrays and effects updating their own dependencies. For routes, check actual route files, guards, hrefs, anchors, and callback parameters.
5. For native errors, check whether the module is supported in the current runtime before recommending a development build. Cache clearing is a follow-up step, not a substitute for a code fix.
6. Reproduce with the smallest relevant test or device action when possible. Fix the demonstrated cause without resetting SQLite data or bypassing auth.
7. Run targeted checks and the validation required by shared instructions. Report the error, evidence, fix, checks, and any remaining device reproduction.

## Capture logs on Windows

From the project root, the user can run:

```powershell
npx expo start -c 2>&1 | Tee-Object -FilePath metro.log
```

Do not start a second Metro server blindly. Piped output can affect QR rendering and shortcuts; React Native DevTools Console is an alternative. Logs can contain sensitive data: inspect only relevant lines and redact credentials, auth codes and tokens, and personal records before sharing.

## Known symptoms in this project

| Symptom                                                                          | Cause found before                                                                               | Where to look                                             |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| `TypeError: Cannot convert BigInt to number` in a list                           | `Intl.NumberFormat` given a `BigInt` (Hermes only)                                               | `features/expenses/domain/money.ts`                       |
| "Expense Split is locked" + "Invalid key provided to SecureStore"                | SecureStore key with `:`                                                                         | `features/privacy/app-lock.tsx`                           |
| Black screen with the tab bar at the top                                         | `expo-router/ui` `Tabs` given `style` without `flex: 1`                                          | `components/app-tabs.tsx`                                 |
| OAuth browser closes but the app stays on sign-in                                | Redirect URL not allow-listed (code lands on the Site URL route), or an expired/reused PKCE code | `features/auth/sign-in-link.ts`, Supabase redirect URLs   |
| "Unsupported provider: provider is not enabled"                                  | Google/Apple provider not enabled in Supabase Auth                                               | Supabase Auth → Providers (user dashboard action)         |
| Native Apple sign-in fails with an audience/"Unacceptable audience" error        | Bundle ID (or `host.exp.Exponent` in Expo Go) missing from Apple provider Client IDs             | Supabase Auth → Providers → Apple (user dashboard action) |
| "Supabase not configured"                                                        | Missing/invalid `EXPO_PUBLIC_*` values or Metro not restarted after editing `.env`               | `lib/supabase.ts` (check presence/format only)            |
| `GestureDetector must be used as a descendant of GestureHandlerRootView`         | Root wrapper missing or moved                                                                    | `src/app/_layout.tsx`                                     |
| Glow/shadow cut off in a straight line                                           | Clipped by a ScrollView edge, tab-screen bottom, or `overflow: hidden` parent                    | `ui-design-system.instructions.md`                        |
| Red delete action flashes after swipe-delete                                     | Row layout/exit animations with the swipe still open                                             | `features/expenses/components/expense-list.tsx`           |
| Web: `Unable to resolve ./wa-sqlite/wa-sqlite.wasm`, SSR `window is not defined` | Web is unsupported (SQLite wasm, native-only modules)                                            | Ignore for phone issues; do not use web to verify screens |
