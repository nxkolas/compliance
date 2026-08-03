import * as z from "zod";
import { backgroundJobKindEnum, backgroundJobs } from "@/src/db/schema";
import { actionPlanDefinitionHash } from "@/src/server/action-plans/current-contract";
import {
  classifyGenerationFailure,
  isCancellationFailure,
} from "@/src/server/ai/generation/failures";
import { currentGapDefinitionHash } from "@/src/server/definitions";
import type { OrganizationCapability } from "../auth/capabilities";

export const JOB_KINDS = backgroundJobKindEnum.enumValues;
export type JobKind = (typeof JOB_KINDS)[number];
export type BackgroundJobRecord = typeof backgroundJobs.$inferSelect;

const locator = <T extends string>(type: T) =>
  z.object({ type: z.literal(type), id: z.uuid() }).strict();

const payloadSchemas = {
  gap_analysis: z.object({
    cycleId: z.uuid(),
    locale: z.enum(["de", "en"]),
    definitionHash: z.string().min(1),
    buildHash: z.string().min(1),
    idempotencyKey: z.string().min(1),
    retryNonce: z.string().min(1).optional(),
  }).strict(),
  gap_conflict_resolution: z.object({
    sourceRevisionId: z.uuid(),
    findingId: z.uuid(),
    sourceChoice: z.enum(["questionnaire", "document"]),
    definitionHash: z.string().min(1),
    buildHash: z.string().min(1),
  }).strict(),
  action_plan_generation: z.object({
    sourceGapRevisionId: z.uuid(),
    locale: z.enum(["de", "en"]),
    gapDefinitionHash: z.literal(currentGapDefinitionHash),
    actionPlanDefinitionHash: z.literal(actionPlanDefinitionHash),
    buildHash: z.string().min(1),
  }).strict(),
  report_render: z.object({ reportId: z.uuid() }).strict(),
  document_indexing: z.object({ documentVersionId: z.uuid() }).strict(),
  legal_source_processing: z.object({ processingGenerationId: z.uuid() }).strict(),
  maintenance_cleanup: z.object({ version: z.literal(1) }).strict(),
} satisfies Record<JobKind, z.ZodType>;

type PayloadByKind = {
  [K in JobKind]: z.infer<(typeof payloadSchemas)[K]>;
};

type OrganizationJobCommand<K extends JobKind> = {
  kind: K;
  payload: PayloadByKind[K];
  organizationId: string;
  requestedByUserId: string;
};

type UnscopedJobCommand<K extends JobKind> = {
  kind: K;
  payload: PayloadByKind[K];
  organizationId?: never;
  requestedByUserId?: never;
};

export type JobCommand =
  | OrganizationJobCommand<"gap_analysis">
  | OrganizationJobCommand<"gap_conflict_resolution">
  | OrganizationJobCommand<"action_plan_generation">
  | OrganizationJobCommand<"report_render">
  | OrganizationJobCommand<"document_indexing">
  | UnscopedJobCommand<"legal_source_processing">
  | UnscopedJobCommand<"maintenance_cleanup">;

export type JobResultLocator = { type: string; id: string };

export type JobFailurePolicy = {
  cancellation: boolean;
  code: string;
  retryable: boolean;
  retryDelaySeconds?: number;
};

type ResultProjection = Pick<
  import("@/src/contracts/common/jobs").JobDto,
  "resultLink" | "result"
>;

type JobDefinition = {
  payloadSchema: z.ZodType;
  organizationScoped: boolean;
  requesterRequired: boolean;
  maxAttempts: number;
  readCapability: OrganizationCapability | null;
  cancellationCapability: OrganizationCapability | null;
  cancellable: boolean;
  resultSchema: z.ZodType;
  execute: (
    job: BackgroundJobRecord,
    payload: Record<string, unknown>,
    signal: AbortSignal,
  ) => Promise<unknown>;
  classifyFailure: (error: unknown) => JobFailurePolicy;
  projectResult: (
    job: BackgroundJobRecord,
    result: JobResultLocator | null,
  ) => ResultProjection;
};

const noResult: ResultProjection = { resultLink: null, result: null };

function generationFailure(error: unknown): JobFailurePolicy {
  const failure = classifyGenerationFailure(error);
  return {
    cancellation: isCancellationFailure(failure),
    code: failure.safeCode,
    retryable: failure.failureClass === "transient_provider",
    retryDelaySeconds:
      failure.failureClass === "transient_provider"
        ? Math.ceil((failure.retryAfterMs ?? 1_000) / 1_000)
        : undefined,
  };
}

function ordinaryFailure(error: unknown): JobFailurePolicy {
  const code =
    error && typeof error === "object" && "code" in error && typeof error.code === "string"
      ? error.code
      : "JOB_FAILED";
  return { cancellation: false, code, retryable: true };
}

export const jobDefinitions = {
  gap_analysis: {
    payloadSchema: payloadSchemas.gap_analysis,
    organizationScoped: true,
    requesterRequired: true,
    maxAttempts: 3,
    readCapability: "gap:read",
    cancellationCapability: "gap:contribute",
    cancellable: true,
    resultSchema: locator("analysis_output_revision"),
    async execute(job, payload, signal) {
      const { executeGapGenerationJob } = await import("../gap-analysis");
      return executeGapGenerationJob({
        jobId: job.id,
        cycleId: payload.cycleId as string,
        locale: payload.locale as "de" | "en",
        retryNonce: payload.retryNonce as string | undefined,
        userId: job.requestedBy!,
        organizationId: job.organizationId!,
        workerId: job.leaseOwner!,
        attemptCount: job.attemptCount,
        abortSignal: signal,
      });
    },
    classifyFailure: generationFailure,
    projectResult(job, result) {
      return {
        resultLink: result && job.organizationId
          ? `/api/organizations/${job.organizationId}/gap-analysis/revisions/${result.id}`
          : null,
        result: null,
      };
    },
  },
  gap_conflict_resolution: {
    payloadSchema: payloadSchemas.gap_conflict_resolution,
    organizationScoped: true,
    requesterRequired: true,
    maxAttempts: 3,
    readCapability: "gap:read",
    cancellationCapability: "gap:contribute",
    cancellable: true,
    resultSchema: locator("analysis_output_revision"),
    async execute(job, payload, signal) {
      const { executeGapContradictionResolutionJob } = await import("../gap-analysis");
      return executeGapContradictionResolutionJob({
        jobId: job.id,
        organizationId: job.organizationId!,
        userId: job.requestedBy!,
        sourceRevisionId: payload.sourceRevisionId as string,
        findingId: payload.findingId as string,
        sourceChoice: payload.sourceChoice as "questionnaire" | "document",
        abortSignal: signal,
      });
    },
    classifyFailure: generationFailure,
    projectResult(job, result) {
      return {
        resultLink: result && job.organizationId
          ? `/api/organizations/${job.organizationId}/gap-analysis/revisions/${result.id}`
          : null,
        result: null,
      };
    },
  },
  action_plan_generation: {
    payloadSchema: payloadSchemas.action_plan_generation,
    organizationScoped: true,
    requesterRequired: true,
    maxAttempts: 3,
    readCapability: "plans:read",
    cancellationCapability: "plans:manage",
    cancellable: true,
    resultSchema: locator("action_plan"),
    async execute(job, payload, signal) {
      const { executeActionPlanGenerationJob } = await import("../action-plans");
      return executeActionPlanGenerationJob({
        jobId: job.id,
        organizationId: job.organizationId!,
        userId: job.requestedBy!,
        workerId: job.leaseOwner!,
        sourceGapRevisionId: payload.sourceGapRevisionId as string,
        locale: payload.locale as "de" | "en",
        attemptCount: job.attemptCount,
        abortSignal: signal,
      });
    },
    classifyFailure: generationFailure,
    projectResult(_job, result) {
      return {
        resultLink: null,
        result: result ? { actionPlanId: result.id } : null,
      };
    },
  },
  report_render: {
    payloadSchema: payloadSchemas.report_render,
    organizationScoped: true,
    requesterRequired: true,
    maxAttempts: 3,
    readCapability: "reports:read",
    cancellationCapability: "reports:create",
    cancellable: true,
    resultSchema: locator("report"),
    async execute(job, payload, signal) {
      const { handleReportRender } = await import("../reports");
      return handleReportRender(job, payload.reportId as string, signal);
    },
    classifyFailure: ordinaryFailure,
    projectResult: () => noResult,
  },
  document_indexing: {
    payloadSchema: payloadSchemas.document_indexing,
    organizationScoped: true,
    requesterRequired: true,
    maxAttempts: 3,
    readCapability: "documents:read",
    cancellationCapability: "documents:write",
    cancellable: true,
    resultSchema: locator("document_version"),
    async execute(job, payload) {
      const { executeDocumentIndexingJob } = await import("../documents/service");
      return executeDocumentIndexingJob({
        documentVersionId: payload.documentVersionId as string,
        organizationId: job.organizationId!,
      });
    },
    classifyFailure: ordinaryFailure,
    projectResult: () => noResult,
  },
  legal_source_processing: {
    payloadSchema: payloadSchemas.legal_source_processing,
    organizationScoped: false,
    requesterRequired: false,
    maxAttempts: 3,
    readCapability: null,
    cancellationCapability: null,
    cancellable: false,
    resultSchema: locator("legal_source_processing_generation"),
    async execute(job, payload, signal) {
      const { executeLegalSourceProcessingJob } = await import("../corpus");
      return executeLegalSourceProcessingJob({
        jobId: job.id,
        processingGenerationId: payload.processingGenerationId as string,
        abortSignal: signal,
      });
    },
    classifyFailure: ordinaryFailure,
    projectResult: () => noResult,
  },
  maintenance_cleanup: {
    payloadSchema: payloadSchemas.maintenance_cleanup,
    organizationScoped: false,
    requesterRequired: false,
    maxAttempts: 3,
    readCapability: null,
    cancellationCapability: null,
    cancellable: false,
    resultSchema: locator("maintenance_cleanup"),
    async execute(job) {
      const { runMaintenanceCleanup } = await import("../api/cleanup");
      await runMaintenanceCleanup();
      return { type: "maintenance_cleanup", id: job.id };
    },
    classifyFailure: ordinaryFailure,
    projectResult: () => noResult,
  },
} satisfies Record<JobKind, JobDefinition>;

export class InvalidPersistedJobError extends Error {
  readonly code = "JOB_PAYLOAD_INVALID";

  constructor(message: string) {
    super(message);
    this.name = "InvalidPersistedJobError";
  }
}

export function getJobDefinition(kind: JobKind): JobDefinition {
  return jobDefinitions[kind];
}

export function validateJobCommand(command: JobCommand) {
  const definition = getJobDefinition(command.kind);
  const organizationId = command.organizationId ?? null;
  const requestedByUserId = command.requestedByUserId ?? null;
  if (definition.organizationScoped && !organizationId) {
    throw new InvalidPersistedJobError(`${command.kind} requires organization scope`);
  }
  if (definition.requesterRequired && !requestedByUserId) {
    throw new InvalidPersistedJobError(`${command.kind} requires a requester`);
  }
  return {
    kind: command.kind,
    payload: definition.payloadSchema.parse(command.payload),
    organizationId,
    requestedByUserId,
    maxAttempts: definition.maxAttempts,
  };
}

export async function executePersistedJob(
  job: BackgroundJobRecord,
  signal: AbortSignal,
): Promise<JobResultLocator> {
  const definition = getJobDefinition(job.kind);
  if (definition.organizationScoped && !job.organizationId) {
    throw new InvalidPersistedJobError(`${job.kind} has no organization scope`);
  }
  if (definition.requesterRequired && !job.requestedBy) {
    throw new InvalidPersistedJobError(`${job.kind} has no requester`);
  }
  if (!job.leaseOwner) {
    throw new InvalidPersistedJobError(`${job.kind} has no lease owner`);
  }
  const payloadResult = definition.payloadSchema.safeParse(job.payload);
  if (!payloadResult.success) {
    throw new InvalidPersistedJobError(`${job.kind} has an incompatible payload`);
  }
  const result = await definition.execute(
    job,
    payloadResult.data as Record<string, unknown>,
    signal,
  );
  const resultResult = definition.resultSchema.safeParse(result);
  if (!resultResult.success) {
    throw new InvalidPersistedJobError(`${job.kind} returned an incompatible result`);
  }
  return resultResult.data as JobResultLocator;
}

export function classifyJobFailure(
  job: BackgroundJobRecord,
  error: unknown,
): JobFailurePolicy {
  if (error instanceof InvalidPersistedJobError) {
    return { cancellation: false, code: error.code, retryable: false };
  }
  return getJobDefinition(job.kind).classifyFailure(error);
}

export function projectJobResult(job: BackgroundJobRecord): ResultProjection {
  const definition = getJobDefinition(job.kind);
  if (job.resultLocator === null) return definition.projectResult(job, null);
  const parsed = definition.resultSchema.safeParse(job.resultLocator);
  return definition.projectResult(
    job,
    parsed.success ? parsed.data as JobResultLocator : null,
  );
}
