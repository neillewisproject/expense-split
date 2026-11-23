---
applyTo: '**'
---

# Development workflow

## Validation cadence (user preference)

The full suite takes over a minute, and the user asked not to run it repeatedly.

- While developing, run only `npm run typecheck` and the specific test files you touched: `npm test -- --runInBand <paths>`.
- Run the full validation **once**, after all requested work is finished: `npm run check`, plus `npm run test:database` for schema changes and `npx expo export --platform android --output-dir <temp>` for routing, native-import or bundling changes. Delete the export directory afterwards.
- For a bug fix, add a focused test and confirm it fails without the fix before reporting it as covered.
- Report exactly what ran. Unit tests and bundle exports are not device, email, RLS, Realtime or visual verification; say what still needs checking on the phone.

## Editing on Windows (PowerShell 5.1)

- Prefer editor tools over shell rewrites. `Set-Content`/`Add-Content` write a UTF-8 BOM or the ANSI code page and can corrupt `₹`, `…`, `“ ”`.
- Text piped into `node -` or `python -` from PowerShell loses non-ASCII characters. Keep such scripts ASCII-only, or use the editor tool for lines containing symbols.
- In .NET calls (`[IO.File]::...`), use absolute paths, because the .NET working directory differs from the PowerShell location. Write with `New-Object Text.UTF8Encoding($false)`.
- Run `npx prettier --write <changed files>` before the final check; formatting is part of `npm run check`.

## Communication

- The user is learning React Native. Explain the cause of a bug and the key concept briefly, in plain language.
- If the user is unavailable for a design or scope question, choose the pragmatic option, state the assumption, and keep it easy to change.
