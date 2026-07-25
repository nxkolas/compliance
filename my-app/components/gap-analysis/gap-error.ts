import { ApiClientError } from "@/src/client/api-client";
import type { GapLabels } from "./types";

export function localizeGapError(error: unknown, labels: GapLabels) {
  if (error instanceof ApiClientError) {
    return (
      labels.errors[error.code as keyof typeof labels.errors] ??
      labels.errors.generic
    );
  }
  return labels.errors.generic;
}
