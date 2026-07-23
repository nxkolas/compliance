import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";
});
import { formatFrozenAnswer } from "@/src/server/gap-analysis/generated-inputs-reader";

describe("generated Gap input snapshots", () => {
  const empty = {
    optionLabels: [],
    textValue: null,
    numberValue: null,
    booleanValue: null,
    dateValue: null,
    structuredValue: null,
  };

  it("preserves all selected option labels for future multi-select questions", () => {
    expect(
      formatFrozenAnswer({
        ...empty,
        optionLabels: ["Implemented", "Documented"],
      }),
    ).toBe("Implemented, Documented");
  });

  it("renders non-option immutable values without status assumptions", () => {
    expect(
      formatFrozenAnswer({ ...empty, textValue: "Custom answer" }),
    ).toBe("Custom answer");
    expect(
      formatFrozenAnswer({ ...empty, booleanValue: false }),
    ).toBe("No");
  });
});
