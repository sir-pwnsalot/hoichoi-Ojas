import { describe, expect, it } from "vitest";
import { transition, canTransition, IllegalTransitionError } from "@/lib/domain/status";

describe("status transitions", () => {
  it("allows the happy path draft -> approved -> scheduled -> published", () => {
    expect(transition("draft", "approve")).toBe("approved");
    expect(transition("approved", "schedule")).toBe("scheduled");
    expect(transition("scheduled", "tick_ok")).toBe("published");
  });

  it("allows scheduled -> rejected on a failed tick", () => {
    expect(transition("scheduled", "tick_fail")).toBe("rejected");
  });

  it("allows edit to clear back to draft from approved or rejected", () => {
    expect(transition("approved", "edit")).toBe("draft");
    expect(transition("rejected", "edit")).toBe("draft");
  });

  it("allows discard from draft, and regenerate from discarded", () => {
    expect(transition("draft", "discard")).toBe("discarded");
    expect(transition("discarded", "regenerate")).toBe("draft");
  });

  it("throws IllegalTransitionError for disallowed transitions", () => {
    expect(() => transition("draft", "schedule")).toThrow(IllegalTransitionError);
    expect(() => transition("published", "approve")).toThrow(IllegalTransitionError);
    expect(() => transition("scheduled", "approve")).toThrow(IllegalTransitionError);
    expect(() => transition("discarded", "edit")).toThrow(IllegalTransitionError);
  });

  it("published is terminal", () => {
    expect(canTransition("published", "edit")).toBe(false);
    expect(canTransition("published", "discard")).toBe(false);
  });
});
