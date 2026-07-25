import { ApiError } from "../api/errors";

export function assertReportConcurrency(activeReports: number) {
  if (activeReports >= 3) throw new ApiError(429, "Too many reports are already in progress", { maxConcurrentReports: 3 }, "REPORT_CONCURRENCY_LIMIT");
}
