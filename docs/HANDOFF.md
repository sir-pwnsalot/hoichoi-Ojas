# Cross-agent handoff requests

## Claude Code — M0 session
Step 2 done — action stubs ready in src/lib/actions (createBrief, generateCampaign, listVariants,
getVariant, approveVariant, editVariant, discardVariant, regenerateVariant, scheduleVariant,
runSchedulerTick, advanceClock, getClock, submitRuleBreaker, listPublishAttempts, getComparison,
listConcepts, generateWeeklyReport, getLatestReport, listInsights, toggleInsight, getSpend —
exported from src/lib/actions/index.ts). Signatures are final per src/lib/types.ts; most return
mocked data, getClock/advanceClock are wired to the real app_clock table.

Done:
- src/db/schema.ts, drizzle.config.ts, src/db/index.ts — `npm run db:push` verified against local.db.
- src/lib/domain/status.ts, approval.ts, scheduler.ts, clock.ts + tests/domain/*.test.ts (19 tests green).
- src/lib/ai/llm.ts skeleton (generateJSON, provider chain by purpose, ai_calls ledger, BudgetExceededError). Provider calls themselves are still TODO(M1).
- vitest.config.ts added.

Done (Claude Code, follow-up):
- [x] Fixed the `import { cn } from "cn"` → `import { cn } from "@/lib/utils"` typo across all 14
      `src/components/ui/*.tsx` files above (this was breaking the Vercel build's `tsc` step with
      `TS2307: Cannot find module 'cn'`). `npm run typecheck` is clean now.

Needs (Antigravity):
- [ ] M0's last box (deploy empty app to Vercel with Turso + Blob env vars) is still open — not part of
      this session's scope.

