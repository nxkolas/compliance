import { fingerprintRequest } from "../api/idempotency";

export function buildGapGenerationEnqueueFingerprint(input: {
  draftId: string;
  expectedLockVersion?: number;
  retryNonce?: string;
  outputLocale: "de" | "en";
}) {
  return fingerprintRequest(input);
}
