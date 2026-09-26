# Acceptance — judging criteria → evidence

Fill in the **Evidence** column as each item is proved (test name, screen, or demo step). This becomes the README table.

| # | Criterion (from problem statement) | How we satisfy it | Evidence |
|---|---|---|---|
| G1 | Visual differs meaningfully per channel | Separate plan + image prompt + native size per channel; dHash check rejects near-duplicates; review screen shows the 3 prompts side by side | |
| G2 | Copy differs per channel (tone, length, hashtags, CTA) | Channel conventions in the plan schema; per-channel copy calls; review shows a diff table | |
| G3 | Bengali generated natively, not translated | Independent bn call with a Bengali system prompt; nativeness critic score; independence check (bn ≠ translation of en) | |
| A1 | Nothing reaches the queue without explicit human approval | `schedule()` throws without an approval whose hash matches; unit tests | tests/actions/gate.test.ts (no approval / edit clears / hash drift → throws), tests/domain/tick.test.ts (tick re-checks → NOT_APPROVED) |
| A2 | Discard-and-retry loop before approval | Discard + note → regenerate → version+1 with parentId | tests/actions/gate.test.ts "discard + regenerate" (note reaches the copy prompt; bn via critic path) |
| C1 | Cross-platform comparison is like-for-like | Grouped by `conceptId`, normalised rates side by side; bn vs en on the same platform | |
| MVP | Brief → image/video + copy ×3 → approved → scheduled → published (mock) → metrics → comparison + weekly report citing post IDs | End-to-end demo (docs/DEMO.md) | |
| R1 | Every report claim cites post IDs | Claims JSON + `verify.ts` (IDs exist, numbers match); unit tests | |
| T1 | Bengali brief → native-sounding output | Demo with a Bengali brief; critic flags; examples in README | |
| T2 | Constraint-violating post rejected at the adapter | Byte-level validate(); fixtures test each rule; rule-breaker demo panel | tests/adapters/validate.test.ts (every RejectionCode incl. Bengali+emoji over limit), tests/adapters/publish.test.ts, tests/actions/rule-breaker.test.ts; panel UI pending |
| D1 | Not "one image cropped per platform" | = G1 + dHash evidence | |
| D2 | Approval gate exists | = A1 | |
| D3 | Insights reach brief creation | Insight cards in the brief form; plan output lists `appliedInsightIds` + how each was applied; stored on the brief | |
