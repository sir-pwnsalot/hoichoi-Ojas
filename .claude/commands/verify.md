---
description: Verify the current milestone against tests and the acceptance table
---
1. Run `npm run typecheck && npm test`. Fix failures before anything else.
2. Re-read the 5 non-negotiables in CLAUDE.md. For each one this milestone touched, name the test or code path that enforces it. If none exists, say so and add it.
3. Walk the milestone's user flow in the browser (dev server) and note anything broken.
4. Update the Evidence column in `docs/ACCEPTANCE.md` for anything newly proved.
5. Report: ✅ done / ⚠️ gaps / ⏱ time check vs PLAN.md targets, and suggest what to cut if behind.
