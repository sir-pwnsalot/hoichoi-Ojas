<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project rules (Antigravity / any non-Claude agent)

Read `CLAUDE.md` first. It is the project contract (stack, non-negotiables, layout, working agreement), and it applies to you too.
Before working in an area, read the matching `.claude/skills/<name>/SKILL.md` listed in CLAUDE.md's skills table.
Progress lives in `docs/PLAN.md`: tick boxes only when the item actually works. The step-by-step build order is `docs/RUNBOOK.md`.

## Ownership split (two agents work in parallel, so never edit the other side's files)
- **Antigravity owns:** `src/app/**` pages and layouts (NOT `src/app/api/**`), `src/components/**`, styling, `public/demo/**`, README.
- **Claude Code owns:** `src/lib/**` (including server actions in `src/lib/actions/**`), `src/app/api/**`, `src/db/**`, `scripts/**`, `tests/**`.
- UI reads data and runs mutations ONLY through `src/lib/actions/**` server actions or `src/app/api/**` routes. No DB access or AI calls from components.
- Need a change in the other side's files? Don't make it. Add a line to `docs/HANDOFF.md`: `- [ ] <file>: <what you need and why>`. When finishing a step, append a short "Done / Needs" note there.
- If a lib function doesn't exist yet, stub the call site with `// TODO(lib):` and add a HANDOFF entry.
- Commit after each working screen: `git add -A && git commit -m "ui: <screen>"`.
