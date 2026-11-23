---
applyTo: 'src/app/**/*.tsx,src/components/**/*.tsx,src/features/**/components/**/*.tsx,src/constants/theme.ts'
---

# Neumorphic design system

The app uses a warm neumorphic ("soft UI") look: cream/charcoal surfaces that share the background colour and get their shape from paired shadows, with orange as the only accent. Build every screen from these pieces before writing custom styles.

## Tokens (`src/constants/theme.ts`, read with `useTheme()`)

- Surfaces: `background` and `card` are the same colour on purpose. Do not add borders or a different card colour to separate surfaces; use depth.
- Orange has two roles. `accent` is the darker orange for text and icons (AA contrast on cream). `accentFill` is the bright orange for filled surfaces, always paired with `onAccent` (dark brown) text. Never put white or `accent` text on `accentFill`.
- Status colours: `success`/`danger`/`warning` for text and icons, `*Soft` variants for tinted backgrounds.
- Spacing: `Spacing`, `Radius`, and `ScreenPadding` (20px page padding). Category colours live in `features/expenses/components/category-style.ts`; avatar colours in `components/ui/fab.tsx`. No other hard-coded hex values.
- Use `HeroGradient` only for the Home summary card; text on it is dark (`#2B1600` family), not white.

## Depth (`components/ui/neu.ts`)

- Give depth with `neu(theme, 'raised' | 'raisedSm' | 'inset' | 'insetSm' | 'glow' | 'glowSm')`; carved text fields use `inputWell(theme, focused)`. Do not use legacy `shadowColor`/`shadowOffset`/`elevation` or `borderColor` outlines.
- Pressed controls switch to `insetSm`. Selected/active state must also change colour (orange fill or `accent` text), never depth alone.
- `boxShadow` needs the New Architecture; outset shadows need Android 9+ and inset shadows Android 10+. Older devices show flat UI, which must remain usable.

## Shadow clipping — the most common bug

Shadows reach up to ~18px past an element (glow ~16px). They are cut off in a straight line by anything that clips:

- `ScrollView`/`FlatList` edges: put padding in `contentContainerStyle` (≥ `ScreenPadding`), not on a parent View. Horizontal chip rows bleed with negative margin + inner padding (see `ChipGroup`).
- The bottom of a tab screen, where the tab bar starts: floating elements (`Fab`, bulk bars) need ≥20px below them.
- `overflow: 'hidden'` parents: `Card` only clips when `padded={false}` (edge-to-edge rows). Never put shadowed buttons inside a clipping container; use an outer shadow View plus inner clip View (see `Card`, `Banner`, list cells).

## Components (`@/components/ui` and `features/expenses/components/personal-ui.tsx`)

- Page shells: tab screens use `<Screen tabBar header={<ScreenHeader large … />}>`; pushed screens use `PersonalPage` (or `Screen` + `ScreenHeader onBack={() => router.back()}`). Use `scroll={false}` when the page renders its own FlatList.
- Actions: `Button` (`primary` = one main action per area; `secondary` default; `danger` for destructive). `Action` picks `danger` automatically for Delete/Remove/Void/Archive labels. Floating add actions use `Fab` (a primary `Button`, not a custom pill).
- Lists of records: `ItemCard` (title, detail lines, optional progress bar, compact actions). Settings/navigation rows: `Card padded={false}` + `ListRow` + `Divider`. Transactions: `TransactionRow`/`ExpenseList`.
- Choices: `Chip`/`ChipGroup`/`Choices` (radio role). Messages: `Banner` (danger tone carries the `alert` role) and `Failure`. Inputs: `Field`. Overlays: `Sheet`. Search: `SearchBar`.
- Icons: add names to the `ICONS` map in `components/ui/icon.tsx` with both an SF Symbol and a Material Symbol; TypeScript validates both. Do not import icon packs.
- Group screens use `GroupPage`/`GroupButton` (toggle = `selected` prop, `compact` for wrapping rows) from `features/groups/components/group-controls.tsx`.
- Keep `src/components/ui` free of `expo-router` and store imports; pass callbacks (`onBack`, `onPress`). Importing `expo-router` there breaks Jest.

## Navigation chrome

- Tabs are a custom neumorphic bar in `components/app-tabs.tsx` built on `expo-router/ui` headless tabs. It sits below the screens (no content inset needed) and hides on Android while the keyboard is open.
- `Tabs` from `expo-router/ui` replaces, not merges, its default `flex: 1` when given `style`; always include `flex: 1` or the screens collapse to a black area.
- The navigation theme in `src/app/_layout.tsx` is derived from `Colors`; keep it that way so transitions never flash black/grey.

## Interaction details

- Swipe actions (`ReanimatedSwipeable`): call `swipeable.close()` before deleting/restoring, and do not add enter/exit/layout animations to swipeable list rows (they caused the delete-button flash).
- Do not pass `disabled: false` or `busy: false` in `accessibilityState`; only include them when true (tests and screen readers compare the exact state).
- Keep touch targets ≥44px, labels on icon-only buttons (`accessibilityLabel`), and money text `flexShrink: 0` so amounts never overlap descriptions.
- After UI changes, say what could not be verified visually (no device/emulator) instead of implying the look was checked.
