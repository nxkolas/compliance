export {
  prepareGroundingOperation,
  runGroundedOperation,
  type GroundingExecutionDependencies,
  type PreparedGroundingOperation,
} from "./gateway";
export type {
  GroundedClaim,
  GroundedOutputContract,
  GroundedProvider,
  GroundingContextItem,
  QueryUnit,
} from "./types";
export {
  resolvePinnedLegalScope,
  retrieveMappedProvisionRows,
  retrievePinnedLegalContext,
  type PinnedLegalSnapshot,
} from "./legal-retrieval";
