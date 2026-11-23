---
applyTo: 'src/features/auth/**,src/app/(auth)/**,src/app/join/**,src/lib/supabase.ts,src/lib/crypto-polyfill.ts'
---

# Authentication (Supabase email OTP + PKCE)

Supabase is optional. Guest mode ("Continue without an account") must work with no `.env`, no network and no Supabase project.

## How sign-in works

- `sendSignInLink` calls `signInWithOtp` with `emailRedirectTo = Linking.createURL('auth/callback')`. The email contains a PKCE link and, if the project's email template includes `{{ .Token }}`, a one-time code.
- Codes are verified with `verifyOtp({ email, token, type: 'email' })` from the sign-in screen.
- Links are handled by `features/auth/sign-in-link.ts`:
  - `readSignInLink(url)` reads `code` or `error`/`error_description` from the query or fragment of **any** incoming URL. When the redirect URL is not allow-listed, Supabase falls back to the project's Site URL, so the link can open the app root instead of `/auth/callback`.
  - `completeSignInLink(code)` exchanges each code only once, because both the `Linking` listener in `AuthProvider` and the callback route may see the same URL.
  - Invite links (`/join/...`) are ignored by the reader.
- A PKCE code only works in the app installation that requested it (the verifier is stored there) and only once.

## Rules

- Keep `flowType: 'pkce'`, `detectSessionInUrl: false`, SecureStore session storage on native and AsyncStorage on web.
- SecureStore keys may contain only letters, digits, `.`, `-` and `_`. A `:` throws "Invalid key provided to SecureStore" (this once broke app lock).
- Surface link errors (expired/used links, rate limits) through the auth `error` shown on the sign-in screen; never swallow them.
- Dashboard setup the user must do (you cannot): add `exp://**` and `expensesplit://**` to Authentication → URL Configuration → Redirect URLs; editing email templates (to add `{{ .Token }}`) and avoiding "email rate limit exceeded" both require custom SMTP. Explain these steps; do not claim they are done.
- Never send real auth emails from tests or scripts, never ask for or log email codes/tokens, and never read `.env` values.
- When changing auth navigation, check signed-out, guest, signed-in, link-callback and invite paths. Stack guards live in `src/app/_layout.tsx` (`Stack.Protected`).
