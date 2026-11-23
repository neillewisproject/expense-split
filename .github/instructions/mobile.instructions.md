---
applyTo: 'src/app/**/*.tsx,src/components/**/*.tsx,src/features/**/components/**/*.tsx,src/hooks/**/*.{ts,tsx}'
---

# Mobile UI and routing

- Keep route files focused on composing feature UI and navigation. Verify Expo Router APIs against the installed SDK before changing layouts, protected routes, or links.
- Use existing themed components and spacing tokens. Check narrow screens, dark mode, keyboard avoidance, safe areas, touch targets, and dynamic font sizes.
- Lists need stable keys and virtualization. Keep money/action layouts readable without overlap.
- For gesture work, preserve the root GestureHandler context and platform-compatible Reanimated setup.
- Store selectors must return stable values; derive filtered arrays outside the selector with memoization or use a supported shallow comparison.
- Effects must clean up subscriptions and avoid render/update loops. Do not suppress hook diagnostics instead of fixing the data flow.
- Guest navigation must work without an account or Supabase connectivity. Test signed-out, guest, signed-in, and callback/invite paths when changing auth navigation.
