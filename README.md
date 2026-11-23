# Expense Split

An expense tracker with group bill splitting, built with Expo (React Native) + TypeScript as a learning project.

**Start here → [LEARNING_ROADMAP.md](./LEARNING_ROADMAP.md)**

Milestones 1–3 are implemented. The app supports personal and group expenses, receipt photos, spending charts, and local-first groups. Milestone 4 adds optional Supabase accounts and sharing; groups created before sign-in remain local unless you explicitly recreate them as shared groups.

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

## AI development setup

The repository includes a Copilot-first setup tailored to this stack. It does not install plugins, change models, grant permissions, or run deployments.

- **Shared instructions:** [AGENTS.md](./AGENTS.md) defines architecture, data invariants, SDK documentation checks, validation, and safety boundaries.
- **Copilot instructions:** [.github/copilot-instructions.md](./.github/copilot-instructions.md) points to the shared context. Files in [.github/instructions/](./.github/instructions/) add mobile, data, and test guidance when their paths match.
- **Agents:** [Mobile Builder](./.github/agents/mobile-builder.agent.md) implements features/fixes; [Mobile Reviewer](./.github/agents/mobile-reviewer.agent.md) and [Learning Coach](./.github/agents/learning-coach.agent.md) use read/search tools only. Agent formats/tool enforcement differ between AI clients; this configuration targets Copilot.
- **Skills:** [expo-debug](./.github/skills/expo-debug/SKILL.md), [local-first-sync](./.github/skills/local-first-sync/SKILL.md), and [milestone-delivery](./.github/skills/milestone-delivery/SKILL.md) are task-specific workflows, loaded on demand rather than repeating everything in every request.

### Activate and verify in VS Code

1. Open **the `expense-split` folder itself**, not only its parent `Mobile` folder. Repository-native customization discovery is most reliable from the project root.
2. Select the Copilot harness in Chat and run **Chat: Open Customizations** from the Command Palette.
3. Confirm the agents, instructions, and skills appear without file errors. Start a fresh chat; existing sessions may retain old customization state.
4. Choose an agent from the agent dropdown or type `/` to find a skill. Try a small known task and inspect which tools it uses. Discovery alone is not evidence of correct runtime behavior.

Example requests:

```text
Mobile Builder: Fix this expense layout and preserve large-text accessibility.
Mobile Reviewer: Review the supplied group-sync changes; do not edit files.
Learning Coach: Explain how a settlement affects balances, then give me one exercise.
/expo-debug Diagnose this getSnapshot error using the attached Metro log.
/local-first-sync Add a field without uploading existing local groups.
/milestone-delivery Implement the next roadmap milestone with acceptance checks.
```

Select the named agents in the dropdown; the prefixes above describe the intended role, not special chat syntax. Skills can also be selected automatically when supported. `AGENTS.md` and the skill format are reusable, but other harnesses may require their own discovery locations. Do not duplicate or install external skills blindly.

Official references: [Copilot instructions](https://docs.github.com/en/copilot/how-tos/copilot-in-your-ide/customize-copilot/configure-custom-instructions/add-repository-instructions-in-your-ide), [custom agents](https://code.visualstudio.com/docs/agent-customization/custom-agents), and [agent skills](https://code.visualstudio.com/docs/agent-customization/agent-skills).

## Enable shared groups (Milestone 4)

1. Create a Supabase project and run [`supabase/migrations/20261123000000_shared_groups.sql`](./supabase/migrations/20261123000000_shared_groups.sql) in its SQL Editor (or apply it with the Supabase CLI).
2. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the Supabase project’s Connect dialog. These are client-side values; never put a service-role key in the app.
3. In Supabase Auth, enable email sign-in and add `expensesplit://**` and `exp://**` to the allowed redirect URLs. Under **Authentication → Emails → Magic Link**, add `{{ .Token }}` to the template so the email includes the 6-digit code the app asks for.
4. Restart Expo after changing `.env`. Sign in with the emailed code (or link), then create a new group to share it. Groups already on the device remain local-only.

Shared group changes are saved in SQLite first and queued for retry when connectivity returns. Authenticated group members can use invite links; Realtime refreshes the local cache when other members add or change shared group data. Google and Apple sign-in are not configured in this email-first milestone.

Requires Node.js 22.13+ (installed: Node 24 LTS).
