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

Do not start a second Metro server blindly. Piped output can affect QR rendering and shortcuts; React Native DevTools Console is an alternative. Logs can contain sensitive data: inspect only relevant lines and redact credentials, email codes, and personal records before sharing.
