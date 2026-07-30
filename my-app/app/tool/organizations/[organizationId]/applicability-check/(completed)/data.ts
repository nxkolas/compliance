import {
  getApplicabilityRecalculationLockForUser,
  getApplicabilityResultForUser,
} from "@/src/server/applicability-check";
import "server-only";
import { cache } from "react";

export const getCompletedApplicabilityResult = cache(
  getApplicabilityResultForUser,
);

export const getCompletedApplicabilityRecalculationLock = cache(
  getApplicabilityRecalculationLockForUser,
);
