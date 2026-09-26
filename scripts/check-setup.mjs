// Pre-build setup check. Run: npm run check:setup   (add -- --models to list usable model IDs)
// Never prints secret values; only set/empty and HTTP status codes.
import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const env = process.env;
const showModels = process.argv.includes("--models");
let fails = 0, warns = 0;
const ok = (m) => console.log(`  ✅ ${m}`);
const bad = (m) => { fails++; console.log(`  ❌ ${m}`); };
const warn = (m) => { warns++; console.log(`  ⚠️  ${m}`); };
const section = (t) => console.log(`\n${t}`);
const sh = (c) => { try { return execSync(c, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { return null; } };
const get = async (url, headers = {}) => {
  try { const r = await fetch(url, { headers, signal: AbortSignal.timeout(15000) }); return { status: r.status, json: r.ok ? await r.json() : null }; }
  catch (e) { return { status: `network error (${e.cause?.code || e.name})`, json: null }; }
};

section("1. Packages");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const deps = { ...pkg.dependencies, ...pkg.devDependencies };
for (const d of ["next", "drizzle-orm", "@libsql/client", "zod", "@vercel/blob", "image-size", "mp4box", "twitter-text"])
  deps[d] ? ok(d) : bad(`${d} missing → npm i ${d}`);
for (const d of ["drizzle-kit", "vitest", "tsx", "@types/twitter-text", "sharp"])
  deps[d] ? ok(d) : bad(`${d} missing → npm i -D ${d}`);
if (deps.cn) bad("stray package 'cn' installed → npm uninstall cn");
for (const s of ["typecheck", "test", "db:push", "db:seed"]) pkg.scripts?.[s] ? ok(`script ${s}`) : bad(`script ${s} missing`);

section("2. Project files");
for (const f of ["CLAUDE.md", "AGENTS.md", ".agents/rules/agents-md.md", ".claude/settings.json", ".claude/commands/next.md",
  ".claude/commands/verify.md", "docs/PLAN.md", "docs/RUNBOOK.md", "docs/HANDOFF.md", "components.json", ".env.local"])
  existsSync(f) ? ok(f) : bad(`${f} missing`);
for (const s of ["adapter-contracts", "ai-providers", "bengali-native-copy", "channel-tailoring", "demo-seed", "grounded-reporting"])
  existsSync(`.claude/skills/${s}/SKILL.md`) ? ok(`skill ${s}`) : bad(`skill ${s} missing`);
const claude = existsSync("CLAUDE.md") ? readFileSync("CLAUDE.md", "utf8") : "";
claude.includes("Non-negotiables") ? ok("CLAUDE.md is the project version") : bad("CLAUDE.md was overwritten (no 'Non-negotiables' section)");
existsSync("AGENTS.md") && readFileSync("AGENTS.md", "utf8").includes("Ownership split") ? ok("AGENTS.md has project rules") : bad("AGENTS.md missing the ownership split");

section("3. Secrets hygiene");
const tracked = sh("git ls-files") || "";
/(^|\n)(\.env\.local|API KEYS\.md)(\n|$)/.test(tracked) ? bad("a secrets file is tracked by git!") : ok("no secrets files tracked by git");
sh('git check-ignore ".env.local"') ? ok(".env.local ignored") : bad(".env.local NOT ignored");
sh('git check-ignore "API KEYS.md"') ? ok("API KEYS.md ignored") : bad("API KEYS.md NOT ignored");

section("4. Env values (.env.local)");
const need = ["GEMINI_API_KEY", "GEMINI_MODEL_COPY", "GROQ_API_KEY", "GROQ_MODEL_FAST", "OPENROUTER_API_KEY", "OPENROUTER_MODEL_FALLBACK",
  "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN", "CF_IMAGE_MODEL", "DATABASE_URL", "DEMO_PASSCODE"];
for (const k of need) {
  const v = (env[k] || "").trim();
  if (!v) bad(`${k} empty`);
  else if (v.startsWith("#")) bad(`${k} holds a comment, not a value`);
  else ok(`${k} set`);
}
for (const k of ["OPENROUTER_MODEL_PREMIUM", "GEMINI_IMAGE_MODEL", "BLOB_READ_WRITE_TOKEN", "DATABASE_AUTH_TOKEN"])
  (env[k] || "").trim() ? ok(`${k} set`) : warn(`${k} empty (optional for now)`);

section("5. Live key checks");
if (env.GEMINI_API_KEY) {
  const r = await get(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${env.GEMINI_API_KEY}`);
  if (r.json) {
    ok(`Gemini key valid (${r.status})`);
    const ids = r.json.models.map((m) => m.name.replace("models/", ""));
    if (env.GEMINI_MODEL_COPY) ids.includes(env.GEMINI_MODEL_COPY) ? ok(`Gemini model ${env.GEMINI_MODEL_COPY} available`) : bad(`Gemini model '${env.GEMINI_MODEL_COPY}' not found`);
    if (showModels) console.log("     flash models:", ids.filter((i) => /flash/.test(i) && !/image|tts|embed|live|audio/.test(i)).join(", "));
  } else bad(`Gemini key check failed: ${r.status}`);
}
if (env.GROQ_API_KEY) {
  const r = await get("https://api.groq.com/openai/v1/models", { Authorization: `Bearer ${env.GROQ_API_KEY}` });
  if (r.json) {
    ok(`Groq key valid (${r.status})`);
    const ids = r.json.data.map((m) => m.id);
    if (env.GROQ_MODEL_FAST) ids.includes(env.GROQ_MODEL_FAST) ? ok(`Groq model ${env.GROQ_MODEL_FAST} available`) : bad(`Groq model '${env.GROQ_MODEL_FAST}' not found`);
    if (showModels) console.log("     groq models:", ids.filter((i) => !/whisper|guard|tts/.test(i)).join(", "));
  } else bad(`Groq key check failed: ${r.status}`);
}
if (env.OPENROUTER_API_KEY) {
  const k = await get("https://openrouter.ai/api/v1/key", { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` });
  k.json ? ok(`OpenRouter key valid (${k.status})`) : bad(`OpenRouter key check failed: ${k.status}`);
  const m = await get("https://openrouter.ai/api/v1/models");
  if (m.json) {
    const ids = m.json.data.map((x) => x.id);
    for (const key of ["OPENROUTER_MODEL_FALLBACK", "OPENROUTER_MODEL_PREMIUM"])
      if (env[key]) ids.includes(env[key]) ? ok(`OpenRouter ${env[key]} available`) : bad(`OpenRouter model '${env[key]}' not found`);
    if (showModels) {
      console.log("     free models:", ids.filter((i) => i.endsWith(":free")).slice(0, 25).join(", "));
      console.log("     claude sonnet:", ids.filter((i) => /anthropic\/.*sonnet/.test(i)).join(", "));
    }
  }
}
if (env.CLOUDFLARE_API_TOKEN) {
  const r = await get("https://api.cloudflare.com/client/v4/user/tokens/verify", { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` });
  r.json?.result?.status === "active" ? ok("Cloudflare token active") : bad(`Cloudflare token check failed: ${r.status}`);
  if (env.CLOUDFLARE_ACCOUNT_ID && env.CF_IMAGE_MODEL) {
    const q = await get(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/models/search?search=flux`, { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` });
    q.json ? (q.json.result.some((m) => m.name === env.CF_IMAGE_MODEL) ? ok(`Workers AI can see ${env.CF_IMAGE_MODEL}`) : bad(`Workers AI model '${env.CF_IMAGE_MODEL}' not found`))
      : bad(`Workers AI access failed (${q.status}), check the token has Workers AI permission and the Account ID`);
  }
}
if ((env.DATABASE_URL || "").startsWith("libsql://")) {
  try { const { createClient } = await import("@libsql/client"); await createClient({ url: env.DATABASE_URL, authToken: env.DATABASE_AUTH_TOKEN }).execute("select 1"); ok("Turso reachable"); }
  catch (e) { bad(`Turso connection failed: ${e.message}`); }
} else warn("DATABASE_URL is local (fine for dev; Turso is checked when you point it at libsql://)");
if (env.BLOB_READ_WRITE_TOKEN) {
  try { const { list } = await import("@vercel/blob"); await list({ limit: 1 }); ok("Vercel Blob token works"); }
  catch (e) { bad(`Vercel Blob failed: ${e.message}`); }
}

section("6. Git / deploy");
const dirty = sh("git status --porcelain");
dirty ? warn("uncommitted changes → git add -A; git commit -m \"...\"") : ok("working tree clean");
sh("git remote get-url origin") ? ok("GitHub remote set") : bad("no GitHub remote");
const ahead = sh("git rev-list --count @{u}..HEAD");
ahead === null ? warn("branch has no upstream → git push -u origin main") : ahead === "0" ? ok("pushed to GitHub") : warn(`${ahead} commit(s) not pushed → git push`);
console.log("  👉 Vercel: open the project → Deployments → the latest one must be 'Ready' (check by hand)");

console.log(`\n${fails ? `❌ ${fails} problem(s)` : "✅ all required checks passed"}${warns ? `, ⚠️ ${warns} warning(s)` : ""}\n`);
process.exit(fails ? 1 : 0);
