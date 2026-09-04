import { contentHash } from "../../canonical-json";
import type { GenerationPhase } from "./diagnostics";

export type GenerationReservationIdentity = string & {
  readonly __generationReservationIdentity: unique symbol;
};
export type GenerationCallAttemptIdentity = string & {
  readonly __generationCallAttemptIdentity: unique symbol;
};
export type DurableExecutionAttempt = number & {
  readonly __durableExecutionAttempt: unique symbol;
};

export function parseDurableExecutionAttempt(
  value: number,
): DurableExecutionAttempt {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error("Durable generation attempt must be a positive integer");
  }
  return value as DurableExecutionAttempt;
}

export function generationReservationIdentity(input: {
  taskId: string;
  phase: GenerationPhase;
}): GenerationReservationIdentity {
  return contentHash({
    kind: "generation_reservation",
    taskId: input.taskId,
    phase: input.phase,
  }) as GenerationReservationIdentity;
}

export function generationCallAttemptIdentity(input: {
  reservationIdentity: GenerationReservationIdentity;
  durableExecutionAttempt: DurableExecutionAttempt;
  providerAttempt: number;
}): GenerationCallAttemptIdentity {
  if (!Number.isInteger(input.providerAttempt) || input.providerAttempt < 1) {
    throw new Error("Provider call attempt must be a positive integer");
  }
  return contentHash({
    kind: "generation_call_attempt",
    reservationIdentity: input.reservationIdentity,
    durableExecutionAttempt: input.durableExecutionAttempt,
    providerAttempt: input.providerAttempt,
  }) as GenerationCallAttemptIdentity;
}
