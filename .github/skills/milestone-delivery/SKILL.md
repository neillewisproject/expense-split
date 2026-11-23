---
name: milestone-delivery
description: Implement a learning milestone or focused feature in Expense Split using the existing Expo stack, with scoped acceptance criteria, tests, and roadmap updates.
---

# Deliver a milestone

1. Read [AGENTS.md](../../../AGENTS.md), [LEARNING_ROADMAP.md](../../../LEARNING_ROADMAP.md), and the relevant implementation/tests. Establish what already works before proposing new packages.
2. Turn the request into a small acceptance checklist covering user behavior, persistence, platform limitations, and tests. Ask about material scope/UX decisions before implementing.
3. Reuse the feature-folder architecture and domain helpers. Verify installed-version APIs from official docs; add packages through `npx expo install` only when necessary.
4. Implement coherent changes end-to-end. Preserve previous milestones, guest mode, local group ownership, and existing styling/accessibility.
5. While implementing, run only typecheck and the touched test files. When the whole request is done, run `npm run check` once; add `npm run test:database` for schema changes and an Android export for native-import/routing/bundling changes. Request device/live-cloud confirmation when the acceptance criteria require it.
6. Update the README and roadmap to distinguish implemented code from unverified device/cloud acceptance. Do not mark unchecked live behavior as verified.
7. Return a concise learning handoff: what changed, one key concept, how to try it, actual check results, and remaining setup.

Do not add CI, telemetry, deployment, provider logins, agent orchestration, or architecture layers unless the requested milestone calls for them. Do not commit or push automatically.
