import { describe, expect, it } from "vitest";
import { createAdapter } from "@/lib/adapters/base";
import { AdapterRejectedError, type AttemptLog, type Channel, type PublishPayload } from "@/lib/adapters/types";
import { fixture } from "../fixtures/load";

function harness(channel: Channel, files: Record<string, string>) {
  const logs: AttemptLog[] = [];
  const now = new Date("2026-10-01T10:00:00Z");
  const adapter = createAdapter(channel, {
    loadBytes: async (url) => (files[url] ? fixture(files[url]) : null),
    logAttempt: async (a) => {
      logs.push(a);
    },
    now: async () => now,
  });
  return { adapter, logs, now };
}

const p = (over: Partial<PublishPayload> = {}): PublishPayload => ({
  variantId: "P-0042",
  caption: "Tonight. #hoichoi",
  title: "Episode 5",
  hashtags: [],
  asset: { url: "/a" },
  ...over,
});

describe("publish() is the authority", () => {
  it.each([
    ["instagram", "ig-valid.png", /^ig_/],
    ["x", "x-valid.png", /^x_/],
    ["youtube", "yt-valid.mp4", /^yt_/],
  ] as const)("%s: valid post publishes with a prefixed externalId at app-clock time, and is logged", async (ch, file, prefix) => {
    const { adapter, logs, now } = harness(ch, { "/a": file });
    const res = await adapter.publish(p());
    expect(res.externalId).toMatch(prefix);
    expect(res.publishedAt).toEqual(now);
    expect(logs).toEqual([
      expect.objectContaining({ variantId: "P-0042", channel: ch, ok: true, externalId: res.externalId, reasons: null }),
    ]);
  });

  it("publish() validates by itself — an invalid post is rejected even if the caller never called validate()", async () => {
    const { adapter, logs } = harness("instagram", { "/a": "ig-oversize.png" });
    const err = await adapter.publish(p()).catch((e) => e);
    expect(err).toBeInstanceOf(AdapterRejectedError);
    expect((err as AdapterRejectedError).rejections.map((r) => r.code)).toEqual(["FILE_TOO_LARGE"]);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ ok: false, externalId: null });
    expect(logs[0].reasons?.[0].code).toBe("FILE_TOO_LARGE");
  });

  it("an unreachable asset is a FORMAT rejection, not a crash or a silent pass", async () => {
    const { adapter, logs } = harness("x", {});
    const err = await adapter.publish(p()).catch((e) => e);
    expect((err as AdapterRejectedError).rejections.map((r) => r.code)).toEqual(["FORMAT"]);
    expect(logs[0].ok).toBe(false);
  });

  it("validate() alone does not log or publish", async () => {
    const { adapter, logs } = harness("x", { "/a": "x-valid.png" });
    expect((await adapter.validate(p())).ok).toBe(true);
    expect(logs).toHaveLength(0);
  });
});
