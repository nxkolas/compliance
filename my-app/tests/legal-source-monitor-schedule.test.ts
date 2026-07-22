import { describe, expect, it } from "vitest";
import {
  legalSourceMonitorScheduleSchema,
  nextLegalSourceMonitorCheck,
} from "@/src/contracts/admin/legal-source-monitor-schedule";

describe("legal source monitor schedules", () => {
  it.each([
    ["hourly", "PT1H"],
    ["daily", "P1D"],
    ["weekly", "P7D"],
    ["pt12h", "PT12H"],
    ["P30D", "P30D"],
  ])("normalizes %s", (input, expected) => {
    expect(legalSourceMonitorScheduleSchema.parse(input)).toBe(expected);
  });

  it.each(["", "cron: 0 0 * * *", "PT0H", "P0D", "P366D", "PT8761H", "P1M"])(
    "rejects unsupported cadence %s",
    (schedule) => expect(() => legalSourceMonitorScheduleSchema.parse(schedule)).toThrow(),
  );

  it("calculates the next check without catch-up drift", () => {
    expect(nextLegalSourceMonitorCheck("P1D", new Date("2026-07-22T12:00:00Z")).toISOString())
      .toBe("2026-07-23T12:00:00.000Z");
  });
});
