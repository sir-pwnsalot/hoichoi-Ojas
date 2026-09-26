import { beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { approvals, schedules, variants } from "@/db/schema";
import { approveVariant, discardVariant, editVariant, getVariant, regenerateVariant } from "@/lib/actions/variants";
import { scheduleVariant } from "@/lib/actions/publish";
import { ApprovalMismatchError, NotApprovedError } from "@/lib/domain/approval";
import { IllegalTransitionError } from "@/lib/domain/status";
import { seedVariant } from "./seed";

vi.mock("@/lib/ai/copy", () => ({
  generateCopy: vi.fn(async ({ notes }: { notes?: string }) => ({
    hook: "New hook",
    caption: `Regenerated (${notes ?? "no note"})`,
    cta: "Stream now",
    hashtags: ["#hoichoi"],
    altText: "alt",
  })),
}));
vi.mock("@/lib/ai/critic", () => ({
  generateBnCopyWithCritic: vi.fn(async ({ notes }: { notes?: string }) => ({
    copy: { hook: "নতুন হুক", caption: `নতুন ক্যাপশন (${notes})`, cta: "দেখুন", hashtags: ["#hoichoi"], altText: "alt" },
    critic: { score: 5, verdict: "native", register: "chalit", flags: [] },
  })),
  buildCriticResult: vi.fn(async () => ({ score: 5, isTranslation: false, flaggedPhrases: [], notes: "ok" })),
}));
vi.mock("@/lib/ai/base-images", () => ({
  generateChannelBaseImages: vi.fn(async (_c: string, prompt: string) => ({
    urls: ["/uploads/regen.png"],
    provider: "mock",
    seed: 99,
    dhash: "0f0f0f0f0f0f0f0f",
    prompt,
  })),
}));

const activeApprovals = (id: string) =>
  db
    .select()
    .from(approvals)
    .where(and(eq(approvals.variantId, id), isNull(approvals.revokedAt)));

const future = () => new Date(Date.now() + 86_400_000);

describe("approval gate (non-negotiable #3), DB-backed", () => {
  let id: string;
  beforeEach(async () => {
    id = await seedVariant();
  });

  it("approve records approver, time and the content hash; status → approved", async () => {
    const a = await approveVariant(id, "editor@hoichoi.tv");
    expect(a).toMatchObject({ variantId: id, approver: "editor@hoichoi.tv", revokedAt: null });
    expect(a.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect((await getVariant(id))!.status).toBe("approved");
    expect(await activeApprovals(id)).toHaveLength(1);
  });

  it("approving twice throws (only drafts can be approved)", async () => {
    await approveVariant(id, "a");
    await expect(approveVariant(id, "a")).rejects.toBeInstanceOf(IllegalTransitionError);
  });

  it("scheduleVariant throws without an approval, and writes nothing", async () => {
    await expect(scheduleVariant(id, future())).rejects.toBeInstanceOf(IllegalTransitionError); // still draft
    // forge the status without an approval → the hash gate still refuses
    await db.update(variants).set({ status: "approved" }).where(eq(variants.id, id));
    await expect(scheduleVariant(id, future())).rejects.toBeInstanceOf(NotApprovedError);
    expect(await db.select().from(schedules).where(eq(schedules.variantId, id))).toHaveLength(0);
  });

  it("approved → schedule succeeds; status → scheduled", async () => {
    await approveVariant(id, "a");
    const when = future();
    const s = await scheduleVariant(id, when);
    expect(s).toMatchObject({ variantId: id, scheduledFor: when });
    expect((await getVariant(id))!.status).toBe("scheduled");
  });

  it("edit clears the approval → schedule throws", async () => {
    await approveVariant(id, "a");
    const v = await editVariant(id, { caption: "Edited caption" });
    expect(v).toMatchObject({ status: "draft", caption: "Edited caption" });
    expect(await activeApprovals(id)).toHaveLength(0);
    await db.update(variants).set({ status: "approved" }).where(eq(variants.id, id)); // forged status
    await expect(scheduleVariant(id, future())).rejects.toBeInstanceOf(NotApprovedError);
  });

  it("content changed behind the approval's back → hash mismatch → schedule throws", async () => {
    await approveVariant(id, "a");
    await db.update(variants).set({ caption: "sneaky change" }).where(eq(variants.id, id));
    await expect(scheduleVariant(id, future())).rejects.toBeInstanceOf(ApprovalMismatchError);
  });

  it("scheduled variants can't be edited", async () => {
    await approveVariant(id, "a");
    await scheduleVariant(id, future());
    await expect(editVariant(id, { caption: "x" })).rejects.toBeInstanceOf(IllegalTransitionError);
  });
});

describe("discard + regenerate", () => {
  it("discard stores the note; regenerate makes version+1 with parentId, fed the note, as a new draft", async () => {
    const id = await seedVariant({ lang: "en" });
    const d = await discardVariant(id, "too generic, mention the cliffhanger");
    expect(d).toMatchObject({ status: "discarded", discardNote: "too generic, mention the cliffhanger" });

    const r = await regenerateVariant(id);
    expect(r.id).not.toBe(id);
    expect(r).toMatchObject({ status: "draft", version: 2, parentId: id, channel: "instagram", lang: "en" });
    expect(r.caption).toContain("mention the cliffhanger");
    expect(r.baseImageUrls).toEqual(["/uploads/regen.png"]);
    expect(r.assetUrl).toBeNull();
    // the discarded original is untouched
    expect((await getVariant(id))!.status).toBe("discarded");
  });

  it("bn regeneration goes through the Bengali critic path with the note", async () => {
    const id = await seedVariant({ lang: "bn", channel: "x" });
    await discardVariant(id, "আরও ঘরোয়া করুন");
    const r = await regenerateVariant(id, "আরও ঘরোয়া করুন");
    expect(r.caption).toContain("আরও ঘরোয়া করুন");
    expect(r.criticJson?.score).toBe(5);
  });

  it("regenerate refuses a variant that isn't discarded", async () => {
    const id = await seedVariant();
    await expect(regenerateVariant(id, "x")).rejects.toBeInstanceOf(IllegalTransitionError);
  });

  it("an approved variant can be discarded, and its approval is revoked", async () => {
    const id = await seedVariant();
    await approveVariant(id, "a");
    await discardVariant(id, "nope");
    expect(await activeApprovals(id)).toHaveLength(0);
  });
});
