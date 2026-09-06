import { describe, expect, it } from "vitest";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
  localeTag,
} from "@/src/i18n/format";

describe("locale formatting", () => {
  it("uses explicit German and British English locale tags", () => {
    expect(localeTag("de")).toBe("de-DE");
    expect(localeTag("en")).toBe("en-GB");
  });

  it("formats dates and numeric values for German and English", () => {
    const date = new Date("2026-07-24T12:00:00.000Z");

    expect(formatDate(date, "de")).toBe("24.07.2026");
    expect(formatDate(date, "en")).toBe("24/07/2026");
    expect(formatNumber(1234.5, "de")).toBe("1.234,5");
    expect(formatNumber(1234.5, "en")).toBe("1,234.5");
    expect(normalizeSpace(formatCurrency(1234.5, "de", "EUR"))).toBe(
      "1.234,50 €",
    );
    expect(normalizeSpace(formatCurrency(1234.5, "en", "EUR"))).toBe(
      "€1,234.50",
    );
    expect(normalizeSpace(formatPercent(0.425, "de"))).toBe("42,5 %");
    expect(normalizeSpace(formatPercent(0.425, "en"))).toBe("42.5%");
  });
});

function normalizeSpace(value: string) {
  return value.replace(/\s/g, " ");
}
