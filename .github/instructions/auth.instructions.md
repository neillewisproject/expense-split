---
applyTo: 'src/features/auth/**,src/app/(auth)/**,src/app/join/**,src/lib/supabase.ts,src/lib/crypto-polyfill.ts'
---

# Authentication (Supabase Google/Apple sign-in + PKCE)

Supabase is optional. Guest mode ("Continue without an account") must work with no `.env`, no network and no Supabase project. Email OTP/magic links were removed; there is no email sign-in.

## How sign-in works

`signInWithProvider(provider, inviteCode?)` in `features/auth/social-sign-in.ts` (exposed through `useAuth()`) resolves `true` when signed in and `false` when the user closes the sheet. Cancellation is not an error.

- **Google (all platforms) and Apple on Android** use browser OAuth: `signInWithOAuth({ provider, options: { redirectTo, skipBrowserRedirect: true } })`, then `WebBrowser.openAuthSessionAsync(url, Linking.createURL('auth/callback'))`.
  - The invite code goes only in `redirectTo` (`auth/callback?inviteCode=…`). The return URL passed to `openAuthSessionAsync` has no query because Android's polyfill matches it with `startsWith`.
  - A `success` result's URL is read with `readSignInLink` and exchanged with `completeSignInLink`.
  - On Android the redirect is also a deep link, so Expo Router opens `/auth/callback` and the `AuthProvider` `Linking` listener sees it too. The browser result can even report `dismiss` although the redirect arrived; the callback route then finishes sign-in and the invite.
- **Apple on iOS** uses the native sheet (`expo-apple-authentication`, included in Expo Go): Apple receives the SHA-256 of a random nonce, then `signInWithIdToken({ provider: 'apple', token, nonce: rawNonce })`. `ERR_REQUEST_CANCELED` means cancelled.
- Apple shares the user's name only on the first authorization; it is saved with `updateUser({ data: { full_name, given_name, family_name } })`. `firstName()` in `features/auth/display-name.ts` reads profile metadata before falling back to the email, which may be an Apple private-relay address.
- `features/auth/sign-in-link.ts`:
  - `readSignInLink(url)` reads `code` or `error`/`error_description` from the query or fragment of **any** incoming URL. When the redirect URL is not allow-listed, Supabase falls back to the project's Site URL, so the redirect can open the app root instead of `/auth/callback`. Invite links (`/join/...`) are ignored.
  - `completeSignInLink(code)` exchanges each code only once, because the browser result, the `Linking` listener and the callback route may all see the same URL.
- A PKCE code only works in the app installation that requested it (the verifier is stored there) and only once.

## Rules

- Keep `flowType: 'pkce'`, `detectSessionInUrl: false`, SecureStore session storage on native and AsyncStorage on web.
- SecureStore keys may contain only letters, digits, `.`, `-` and `_`. A `:` throws "Invalid key provided to SecureStore" (this once broke app lock).
- On iOS render Apple's native `AppleAuthenticationButton` (it meets Apple's branding rules) first and at least as prominent as Google. It has no disabled state, so guard the handler. Brand icons are not in the `Icon` map; other provider buttons are text-only design-system `Button`s.
- Surface provider and redirect errors (provider not enabled, redirect not allowed, expired code) through the sign-in screen or auth `error`; never swallow them.
- Dashboard setup the user must do (you cannot): add `exp://**` and `expensesplit://**` to Authentication → URL Configuration → Redirect URLs; enable the Google provider with a Google Cloud OAuth web client whose redirect URI is the Supabase callback URL; enable the Apple provider with the app's bundle IDs (and `host.exp.Exponent` for Expo Go) under Client IDs, plus a Services ID and signing-key secret for browser OAuth on Android (the secret expires every 6 months). Explain these steps; do not claim they are done.
- Never ask for or log ID tokens, OAuth codes or nonces, and never read `.env` values. Tests mock Supabase, `expo-web-browser` and `expo-apple-authentication`.
- When changing auth navigation, check signed-out, guest, signed-in, OAuth callback (Android) and invite paths. Stack guards live in `src/app/_layout.tsx` (`Stack.Protected`).
