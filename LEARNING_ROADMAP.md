# React Native Learning Roadmap: Expense Split

You learn by building one real app, an **expense tracker with group bill splitting** (like Splitwise).
Each milestone adds a feature and teaches the industry-standard tool for that job.

> You already know React. Components, hooks, props and state work the same way.
> What's new is the **platform**: native primitives, navigation, gestures, device APIs, storage, and shipping to app stores.

---

## The stack (and why)

| Concern            | Choice                                               | Why it's the standard                                                           |
| ------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| Framework          | **Expo** (SDK 58, React Native 0.88, New Arch)       | Officially recommended by the React Native team; no Xcode/Android Studio needed |
| Language           | **TypeScript** (strict)                              | Default in almost every production RN codebase                                  |
| Navigation         | **Expo Router**                                      | File-based routing (like Next.js) on top of React Navigation, deep links free   |
| Client state       | **Zustand**                                          | Tiny, hook-based, no boilerplate                                                |
| Local database     | **expo-sqlite** + **Drizzle ORM**                    | Real offline-first storage that works in Expo Go                                |
| Server state       | **TanStack Query**                                   | Caching, retries and background refetch, same as on the web                     |
| Backend            | **Supabase** (Postgres + Auth + Realtime)            | Shared groups need a server; easy auth and row-level security                   |
| Forms & validation | **react-hook-form** + **zod**                        | Performant forms with schema validation shared across the app                   |
| Lists              | `FlatList` → **FlashList**                           | Virtualized lists; FlashList for large or fast lists                            |
| Animation/gestures | **Reanimated** + **Gesture Handler**                 | Run on the UI thread at 60/120fps (already installed)                           |
| Testing            | **Jest** + **React Native Testing Library**, Maestro | Unit/component tests now; Maestro for end-to-end flows                          |
| Code quality       | ESLint (`expo lint`) + Prettier + `tsc`              | `npm run check` runs all of them                                                |
| Build & ship       | **EAS Build / Submit / Update**                      | Cloud builds, store submission, over-the-air JS updates                         |

---

## How the project is organised

```
src/
  app/                 # ROUTES ONLY. Every file is a screen (Expo Router).
    _layout.tsx        #   root stack, theme, modal presentation
    (app)/             #   protected application routes
      (tabs)/          #   native Home, Activity, Groups, Insights and More tabs
      add-expense.tsx  #   add/edit modal form
      expenses/[id].tsx #  expense detail route
    (auth)/            #   sign-in and callback routes
    join/[code].tsx    #   public invitation entry
  components/          # shared, dumb UI (ThemedText, EmptyState, ...)
    ui/                #   design system: Card, Button, Chip, ListRow, Sheet, Icon, ...
  features/            # feature modules: domain logic, stores, feature UI
    expenses/
      components/      #   expense form, grouped FlatList (+ tests)
      data/            #   Drizzle schema and SQLite database
      domain/          #   pure TypeScript: money, validation, splitting (+ tests)
      store.ts         #   Zustand state backed by SQLite
    groups/
drizzle/               # generated, bundled SQLite migrations
  constants/theme.ts   # design tokens: light/dark colours, spacing, radii, fonts
  hooks/               # shared hooks
```

Rules worth following from day one:

1. **Keep screens thin.** `src/app/*` files compose components and call hooks. Logic lives in `features/`.
2. **Keep domain logic pure.** `features/*/domain` has no React or React Native imports, so it's trivially testable.
3. **Money is an integer of minor units** (paise). See `money.ts`. Never use floats for money.
4. **Install packages with `npx expo install <pkg>`**, never plain `npm install`, so versions match the SDK.

---

## Daily commands

```bash
npm start            # start Metro; scan the QR code with the Expo Go app on your phone
npm test             # run unit/component tests  (npm run test:watch while coding)
npm run check        # typecheck + lint + format check + tests (run before every commit)
npm run format       # auto-format everything
npm run doctor       # diagnose dependency/config problems
npm run db:generate  # generate a SQLite migration from the Drizzle schema
```

Phone and computer must be on the **same Wi-Fi**. If they can't connect, use `npx expo start --tunnel`.

---

## Milestone 0: Orientation (2–3 days)

**Goal:** understand what's different from React on the web.

Learn:

- Core components: `View`, `Text`, `Image`, `Pressable`, `ScrollView`, `TextInput`. There's no `div`, and **all text must be inside `<Text>`**.
- Styling: `StyleSheet.create`, no CSS cascade, **flexbox defaults to `flexDirection: 'column'`**, unitless numbers (density-independent pixels).
- Safe areas (notches, home indicator): `react-native-safe-area-context`.
- Platform differences: `Platform.OS`, `.ios.tsx` / `.android.tsx` / `.web.tsx` file extensions (this template already uses `.web.tsx`).
- Dev tools: shake the phone (or press `m` in the terminal) for the dev menu; press `j` to open the React Native DevTools debugger.

Build:

- [ ] Run the app on your phone with Expo Go.
- [ ] Change the "Spent this month" card styles; see Fast Refresh work.
- [ ] Read `src/app/_layout.tsx` and `src/components/app-tabs.tsx` to see how tabs are wired.
- [ ] Read `src/features/expenses/domain/*` and its tests.

Docs: [Core components](https://reactnative.dev/docs/components-and-apis) · [Flexbox](https://reactnative.dev/docs/flexbox) · [Expo tutorial](https://docs.expo.dev/tutorial/introduction/)

---

## Milestone 1: Personal expense tracker (1–2 weeks)

**Goal:** add, list, edit and delete your own expenses. In-memory first, then persisted.

Learn:

- **Expo Router stacks & modals:** `src/app/expenses/[id].tsx`, `src/app/add-expense.tsx` presented as a modal, `Link`, `router.push`, `useLocalSearchParams`, typed routes.
- **Lists:** `FlatList` (`keyExtractor`, `ItemSeparatorComponent`, `ListEmptyComponent`). Why `.map()` inside a `ScrollView` doesn't scale.
- **Forms on mobile:** `TextInput` (`keyboardType="decimal-pad"`), `KeyboardAvoidingView`, dismissing the keyboard, react-hook-form + zod. Use `parseAmount()` from `money.ts`.
- **State:** a Zustand store in `features/expenses/store.ts`.
- **Persistence:** `expo-sqlite` + Drizzle (schema, migrations), then load the store from the DB.

Build:

- [x] Add-expense modal: amount, description, category, date, opened from the bottom action button.
- [x] Expenses list grouped by day, with the monthly total in the summary card.
- [x] Swipe-to-delete (Gesture Handler `ReanimatedSwipeable`) and tap-to-edit.
- [x] Data survives app restarts (SQLite, Zustand store, Drizzle schema and generated migrations).
- [x] Component tests: the add form validates input; the list renders items.

The migration workflow is `npm run db:generate` after changing the schema, then review and commit the generated `drizzle/` files. Runtime migrations are applied before the store reads or writes data.

---

## Milestone 2: Groups & splitting (1–2 weeks)

**Goal:** the core Splitwise logic, still local-only. Group, member, expense and split data
is stored on-device in SQLite; no account or sync is involved yet.

Learn:

- Nested navigation: Groups tab → group detail stack → add group expense.
- Modelling relations in SQLite (groups, members, expenses, splits).
- Derived state with `useMemo` and selectors; keeping domain logic outside components.

Build:

- [x] Create a group, add members by name.
- [x] Add a group expense: who paid, split equally (`splitEqually`) or by shares (`splitByShares`).
- [x] Group balances screen using `computeBalances`.
- [x] **Exercise:** implement `simplifyDebts(balances)` in `balances.ts` (greedy: match biggest creditor with biggest debtor). The `it.todo` tests in `domain.test.ts` are now real tests.
- [x] "Settle up" records a payment as a special expense.

The second Drizzle migration creates groups, members, group expenses and split rows with foreign keys. A settlement is recorded as a group expense paid by the debtor and split entirely to the creditor, so the existing balance calculation nets it out.

---

## Milestone 3: Polish & native feel (1 week)

Learn:

- **Reanimated** layout animations (`entering`, `exiting`, `LinearTransition`), gestures.
- **Haptics** (`expo-haptics`), **images** (`expo-image`), **icons** (`expo-symbols` / SF Symbols, Material Symbols).
- Dark mode (the theme already supports it), accessibility (`accessibilityLabel`, `accessibilityRole`, dynamic font sizes).
- **FlashList** for long lists; profiling with React Native DevTools.

Build:

- [x] Animated list insert/delete; haptic feedback on successful save.
- [x] Charts for spending by category (`react-native-gifted-charts`).
- [x] Attach a receipt photo (`expo-image-picker`), stored in app documents and shown with `expo-image`.
- [ ] Validate with a screen reader (TalkBack/VoiceOver) on a device.

---

## Milestone 4: Backend, auth & sync (2–3 weeks)

**Goal:** real shared groups between real users.

Learn:

- **Supabase:** Postgres tables, Row Level Security, email OTP (Google/Apple providers are a follow-up).
- **Secure storage** for tokens: `expo-secure-store`.
- **TanStack Query** for server state; optimistic updates; offline queueing.
- **Protected routes** in Expo Router (auth group `(auth)` vs `(app)`), **deep links** for group invites (`expensesplit://join/<code>`).
- Environment variables: `EXPO_PUBLIC_*` and `.env` (never commit secrets).

Build:

- [x] Email link sign in / sign out, with local-only guest access.
- [x] New signed-in groups and expenses sync to Supabase; invite friends with a deep link. Pre-existing local groups are not uploaded.
- [x] Realtime updates refresh the local cache when shared group data changes.

Apply the SQL migration in `supabase/migrations/` and configure `.env` plus Supabase Auth redirect URLs before testing against a live project. Google/Apple sign-in and provider-specific setup remain follow-up work.

---

## Milestone 5: Production & shipping (1–2 weeks)

Learn:

- **Development builds** (`eas build --profile development`): needed once you add native modules that aren't in Expo Go.
- **EAS Build / Submit:** Play Store internal testing, TestFlight.
- **EAS Update:** ship JS fixes over the air.
- **Push notifications** (`expo-notifications`): "Asha added ₹1,200 for Dinner".
- **Crash reporting** (Sentry), analytics.
- **E2E tests** with Maestro; **CI** with GitHub Actions running `npm run check` on every push.

Build:

- [ ] App icon and splash screen.
- [ ] Internal test release on Android (and iOS via TestFlight if you have an Apple developer account).
- [ ] CI pipeline + one Maestro flow: "add expense → appears in list".

---

## Stretch ideas

Multiple currencies with exchange rates · recurring expenses · CSV export (`expo-sharing`) · home-screen widget · biometric lock (`expo-local-authentication`) · localisation (`expo-localization`).

## Functionality expansion

The prototype now includes a richer personal ledger, accounts, budgets, recurring approval drafts,
CSV/JSON recovery, explicit description-category suggestions, savings reservations, budget carryover, multiple receipt photos, advanced
splits/multiple payers/itemized bills, fixed group exchange rates, linked refunds, partial settlements,
group spending/settlement breakdowns and shareable previews, explicit account-linked group cash snapshots, zoned recurring schedules with optional end dates and
unposted-commitment reporting, audited edits, a durable revision-checked operation queue, and
ownership/invitation/access controls. The UI uses a token-based neumorphic design system
(`src/components/ui`, with depth from `neu.ts`) and five tabs; read `app-tabs.tsx`, `home-screen.tsx`
and `personal-home.tsx` to see how screens compose cards, chips, bottom sheets and a floating action button.

Continue learning through the [functionality guide and limitations](./README.md#functionality).
Native OCR, remote push, continuous personal sync, partial/multiple-transaction group cash matching,
account/tag-filtered group budgets, and image-complete/group backup still need implementation or integration work. Device and
live-cloud acceptance remain separate from passing unit tests and bundle exports.

## Resources

- Expo docs (versioned for SDK 58): <https://docs.expo.dev/versions/v58.0.0/>
- Expo Router: <https://docs.expo.dev/router/introduction/>
- React Native docs: <https://reactnative.dev/docs/getting-started>
- React Native Testing Library: <https://callstack.github.io/react-native-testing-library/>
- Supabase + Expo: <https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native>
