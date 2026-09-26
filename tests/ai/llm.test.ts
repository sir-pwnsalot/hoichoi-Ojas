import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AllProvidersExhaustedError, generateJSON } from "@/lib/ai/llm";

describe("generateJSON provider exhaustion", () => {
  beforeEach(() => {
    vi.stubEnv("LLM_TIER", "free");
    vi.stubEnv("GEMINI_API_KEY", "test");
    vi.stubEnv("GEMINI_MODEL_COPY", "test-model");
    vi.stubEnv("OPENROUTER_API_KEY", "test");
    vi.stubEnv("OPENROUTER_MODEL_FALLBACK", "test-model");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("throws a typed, user-facing error naming every provider tried", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("upstream down")));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const err = await generateJSON({
      purpose: "copy",
      system: "s",
      user: "u",
      schema: z.object({ caption: z.string() }),
    }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(AllProvidersExhaustedError);
    const exhausted = err as AllProvidersExhaustedError;
    expect(exhausted.message).toMatch(/rate-limited or unavailable/);
    expect(exhausted.attempts.map((a) => a.provider)).toEqual(["gemini", "openrouter_free"]);
    expect(exhausted.attempts[0].reason).toContain("upstream down");

    const line = log.mock.calls.map((c) => String(c[0])).find((m) => m.includes("all providers exhausted"));
    expect(line).toContain("gemini (");
    expect(line).toContain("openrouter_free (");
  });
});
