# Expense Split

An expense tracker with group bill splitting, built with Expo (React Native) + TypeScript as a learning project.

**Start here → [LEARNING_ROADMAP.md](./LEARNING_ROADMAP.md)**

Milestone 1 is implemented: add, edit and delete personal expenses, with monthly totals and local SQLite persistence. See the roadmap for the stack and build notes.

## Run it on your phone

1. Install **Expo Go** from the Play Store / App Store.
2. `npm install` (first time only)
3. `npm start` and scan the QR code (Android: in Expo Go; iOS: with the Camera app).

Phone and PC must be on the same Wi-Fi network; otherwise use `npx expo start --tunnel`.

## Scripts

| Command              | What it does                             |
| -------------------- | ---------------------------------------- |
| `npm start`          | Start the Metro dev server               |
| `npm test`           | Run Jest unit/component tests            |
| `npm run test:watch` | Re-run tests on change                   |
| `npm run check`      | Typecheck + lint + format check + tests  |
| `npm run format`     | Format all files with Prettier           |
| `npm run doctor`     | Diagnose Expo dependency / config issues |

Add packages with `npx expo install <package>` so versions match the Expo SDK.

Requires Node.js 22.13+ (installed: Node 24 LTS).
