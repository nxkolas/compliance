import {
  applicabilitySubmissionSchema,
  claimGuestApplicabilityCheckSchema,
} from "@/src/contracts/applicability-check";
export {
  claimGuestApplicabilityCheckSchema,
  guestApplicabilityCheckReferenceSchema,
} from "@/src/contracts/applicability-check";

export const submitApplicabilityCheckSchema = applicabilitySubmissionSchema;

export type SubmitApplicabilityCheckInput = import("zod").infer<typeof submitApplicabilityCheckSchema>;
export type ClaimGuestApplicabilityCheckInput = import("zod").infer<typeof claimGuestApplicabilityCheckSchema>;
