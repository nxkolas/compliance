import { afterEach, describe, expect, it, vi } from "vitest";
import { readApplicabilityDraft, subscribeApplicabilityDraft, writeApplicabilityDraft } from "@/lib/applicability-draft";

afterEach(() => vi.unstubAllGlobals());

describe("applicability draft", () => {
  it("keeps organization drafts separate and notifies links when saved or cleared", () => {
    const values = new Map<string, string>();
    const target = new EventTarget();
    vi.stubGlobal("window", Object.assign(target, { sessionStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    } }));
    const listener = vi.fn();
    const unsubscribe = subscribeApplicabilityDraft(listener);
    const draft = JSON.stringify({ answers: { question: "answer" }, step: 2 });
    writeApplicabilityDraft("organization-a", draft);
    expect(readApplicabilityDraft("organization-a")).toBe(draft);
    expect(readApplicabilityDraft("organization-b")).toBeNull();
    writeApplicabilityDraft("organization-a", null);
    expect(readApplicabilityDraft("organization-a")).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
  it("allows the questionnaire to work when storage is unavailable", () => {
    vi.stubGlobal("window", { get sessionStorage() { throw new Error("Storage unavailable"); } });
    expect(readApplicabilityDraft("organization")).toBeNull();
    expect(() => writeApplicabilityDraft("organization", "draft")).not.toThrow();
  });
});
