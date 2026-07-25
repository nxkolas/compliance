import * as z from "zod";

const schedulePattern = /^P(?:(\d{1,3})D|T(\d{1,4})H)$/;
const aliases: Record<string, string> = {
  hourly: "PT1H",
  daily: "P1D",
  weekly: "P7D",
};

export const legalSourceMonitorScheduleSchema = z.string()
  .trim()
  .transform((value) => aliases[value.toLowerCase()] ?? value.toUpperCase())
  .refine((value) => {
    const match = schedulePattern.exec(value);
    if (!match) return false;
    const hours = match[1] ? Number(match[1]) * 24 : Number(match[2]);
    return hours >= 1 && hours <= 365 * 24;
  }, "Schedule must be hourly, daily, weekly, or an ISO-8601 cadence from PT1H through P365D");

export function legalSourceMonitorIntervalMs(schedule: string) {
  const normalized = legalSourceMonitorScheduleSchema.parse(schedule);
  const match = schedulePattern.exec(normalized);
  if (!match) throw new Error("Validated legal-source monitor schedule could not be parsed");
  const hours = match[1] ? Number(match[1]) * 24 : Number(match[2]);
  return hours * 60 * 60 * 1_000;
}

export function nextLegalSourceMonitorCheck(schedule: string, after = new Date()) {
  return new Date(after.getTime() + legalSourceMonitorIntervalMs(schedule));
}
