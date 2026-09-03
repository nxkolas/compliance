import * as z from "zod";
import { jobDtoSchema } from "../common/jobs";

export const retryableGapAnalysisCycleStatuses = ["failed", "cancelled"] as const;

export function isRetryableGapAnalysisCycleStatus(status: string) {
  return (retryableGapAnalysisCycleStatuses as readonly string[]).includes(status);
}

export const gapAnalysisCycleGenerationSchema = z.object({
  id: z.uuid(),
  status: z.enum(["locked", "generated", "failed", "cancelled"]),
  outputLocale: z.enum(["de", "en"]),
  lockVersion: z.number().int().positive(),
  generationJobId: z.uuid(),
  outputGapRevisionId: z.uuid().nullable(),
});

const timestampSchema = z.iso.datetime();
const gapStatusSchema = z.enum([
  "fulfilled",
  "partially_fulfilled",
  "not_fulfilled",
  "insufficient_evidence",
]);
const gapItemSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  findingId: z.uuid(),
  stableKey: z.string(),
  kind: z.enum(["missing", "partial", "uncertain"]),
  statement: z.string(),
  recommendation: z.string(),
  position: z.number().int().nonnegative(),
  createdAt: timestampSchema,
});
const gapReleaseSchema = z.object({
  id: z.string(),
  versionLabel: z.string(),
  questions: z.array(z.object({
    id: z.string(),
    stableKey: z.string(),
    position: z.number().int().nonnegative(),
    questionText: z.string(),
    helpText: z.string().nullable(),
    answerType: z.string(),
    required: z.boolean(),
    splittable: z.boolean(),
    maximumStatements: z.number().int().positive(),
    legalProvisions: z.array(z.object({
      id: z.string(),
      key: z.string(),
      provisionCode: z.string(),
      position: z.number().int().nonnegative(),
    })),
    options: z.array(z.object({
      id: z.string(),
      stableValue: z.string(),
      label: z.string(),
      position: z.number().int().nonnegative(),
    })),
  })),
  requirements: z.array(z.object({
    id: z.string(),
    stableRequirementId: z.string(),
    code: z.string(),
    position: z.number().int().nonnegative(),
    icon: z.string(),
    criticality: z.enum(["low", "medium", "high", "critical"]),
    title: z.string(),
    requirementText: z.string(),
    legalReferences: z.array(z.object({
      key: z.string(),
      label: z.string(),
      url: z.string().nullable(),
    })),
    applicabilityOutcomeCodes: z.array(z.string()),
    questionStableKeys: z.array(z.string()),
  })),
});
const gapFindingReadSchema = z.object({
  finding: z.object({
    id: z.uuid(),
    organizationId: z.uuid(),
    outputRevisionId: z.uuid(),
    requirementKey: z.string(),
    requirementTitle: z.string(),
    requirementText: z.string(),
    icon: z.string(),
    criticality: z.enum(["low", "medium", "high", "critical"]),
    status: gapStatusSchema,
    summary: z.string(),
    guidance: z.string(),
    materialContradiction: z.boolean(),
    contradictionResolved: z.boolean(),
    sourceChoice: z.enum(["questionnaire", "document"]).nullable(),
    resolutionCitationIds: z.array(z.string()).nullable(),
    decidedBy: z.uuid().nullable(),
    decidedAt: timestampSchema.nullable(),
    originalFindingId: z.uuid().nullable(),
    position: z.number().int().nonnegative(),
    createdAt: timestampSchema,
    requiresReview: z.boolean(),
    reviewNotice: z.string().nullable(),
    gaps: z.array(gapItemSchema),
  }),
  requirement: z.object({
    id: z.string(),
    stableRequirementId: z.string(),
    title: z.string(),
    requirementText: z.string(),
    icon: z.string(),
    criticality: z.enum(["low", "medium", "high", "critical"]),
    position: z.number().int().nonnegative(),
  }),
  sources: z.array(z.object({
    kind: z.enum(["document", "legal", "assessment"]),
    key: z.string(),
    label: z.string(),
    href: z.string().nullable(),
    available: z.boolean(),
    pageNumbers: z.array(z.number().int().positive()),
    sectionLabels: z.array(z.string()),
  })),
  hasOrganizationDocument: z.boolean(),
  manuallyChanged: z.boolean(),
});
export const gapAnalysisCycleDtoSchema = z.object({
  draft: z.object({
    id: z.uuid(),
    status: z.enum(["open", "locked", "generated", "failed", "cancelled"]),
    outputLocale: z.enum(["de", "en"]),
    lockVersion: z.number().int().positive(),
    generationJobId: z.uuid().nullable(),
    outputGapRevisionId: z.uuid().nullable(),
  }),
  selected: z.array(z.object({
    documentId: z.uuid(),
    selectionOrigin: z.literal("explicit_addition"),
  })),
  summary: z.object({
    baseAcceptedGapRevisionId: z.uuid().nullable(),
    baseAcceptedGapRevisionNumber: z.number().int().positive().nullable(),
    assessmentRevisionId: z.uuid().nullable(),
    assessmentRevisionNumber: z.number().int().positive().nullable(),
    gapAnalysisReleaseId: z.string(),
    gapAnalysisReleaseVersion: z.string(),
    requirementCount: z.number().int().nonnegative(),
  }),
});
const gapPrerequisiteSchema = z.discriminatedUnion("satisfied", [
  z.object({
    satisfied: z.literal(true),
    status: z.literal("eligible"),
    destination: z.string(),
  }),
  z.object({
    satisfied: z.literal(false),
    status: z.enum(["missing", "definition_incompatible", "invalid", "not_eligible"]),
    reason: z.enum(["unsupported_country", "clarification_required", "not_directly_in_scope"]).optional(),
    outcome: z.string().optional(),
    countryCode: z.string().nullable().optional(),
    supportedCountryCodes: z.array(z.string()),
    destination: z.string(),
  }),
]);

export const gapGenerationEnqueueResponseSchema = z.object({
  job: jobDtoSchema,
  reused: z.boolean(),
});

export const gapContradictionResolutionSchema = z.object({
  sourceChoice: z.enum(["questionnaire", "document"]),
}).strict();

export type GapGenerationEnqueueResponse = z.infer<typeof gapGenerationEnqueueResponseSchema>;

export const gapAssessmentSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  kind: z.literal("gap"),
  currentRevisionId: z.uuid().nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export const gapAssessmentRevisionSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  assessmentId: z.uuid(),
  previousRevisionId: z.uuid().nullable(),
  definitionHash: z.string(),
  buildHash: z.string(),
  locale: z.enum(["de", "en"]),
  deterministicEvaluations: z.json(),
  inputHash: z.string(),
  submittedBy: z.uuid(),
  submittedAt: timestampSchema,
});
export const gapQuestionnaireInputSchema = z.object({
  assessmentId: z.uuid(),
  draftId: z.uuid(),
});
export const gapQuestionnaireDraftAnswerSchema = z.object({
  draftId: z.uuid(),
  optionId: z.string().trim().min(1),
});
export const gapQuestionnaireProgressSchema = z.object({
  draftId: z.uuid().nullable(),
  answeredRequired: z.number().int().nonnegative(),
  totalRequired: z.number().int().nonnegative(),
  complete: z.boolean(),
  questions: z.array(z.object({
    questionKey: z.string().min(1),
    required: z.boolean(),
    answered: z.boolean(),
  })),
});
export const gapAnalysisCycleQuerySchema = z.object({ assessmentId: z.uuid() });
export const gapAnalysisCyclePrepareSchema = z
  .object({
    assessmentId: z.uuid(),
    selectedDocumentIds: z.array(z.uuid()),
  })
  .strict();
export const gapAnalysisCycleEvidenceSchema = z
  .object({
    draftId: z.uuid(),
    selectedDocumentIds: z.array(z.uuid()),
  })
  .strict();
export const gapAnalysisEvidenceReplaceSchema = gapAnalysisCycleEvidenceSchema.omit({ draftId: true });
export const gapAnalysisCycleGenerateSchema = z.object({
  draftId: z.uuid(),
});
export const gapAnalysisCycleRetrySchema = z.object({
  draftId: z.uuid(),
  retryNonce: z.string().trim().min(1).max(100),
});
export const gapAnalysisGenerationJobSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("start"),
  }).strict(),
  z.object({
    operation: z.literal("retry"),
    retryNonce: z.string().trim().min(1).max(100),
  }).strict(),
]);

export const gapWorkflowReadSchema = z.object({
  workflow: z.object({
    role: z.enum(["owner", "contributor", "viewer"]),
    canContribute: z.boolean(),
    canManage: z.boolean(),
    release: gapReleaseSchema,
    assessment: z.object({ id: z.uuid(), currentRevisionId: z.uuid().nullable() }).nullable(),
    answers: z.record(z.string(), z.string()),
    questionnaireDraft: z.object({
      id: z.uuid(),
      status: z.enum(["open", "submitted"]),
      version: z.number().int().positive(),
      answers: z.record(z.string(), z.string()),
    }).nullable(),
    documentLibrary: z.object({ documents: z.array(z.object({
      id: z.uuid(),
      title: z.string(),
      mimeType: z.string(),
      archivedAt: timestampSchema.nullable(),
      eligibleForAnalysis: z.boolean(),
    }).strict()) }),
    run: z.object({ errorCode: z.string().nullable() }).nullable(),
    revision: z.object({ id: z.uuid(), outputLocale: z.enum(["de", "en"]), createdAt: timestampSchema }).nullable(),
    acceptedRevision: z.object({ id: z.uuid(), outputLocale: z.enum(["de", "en"]), createdAt: timestampSchema }).nullable(),
    candidateRevision: z.null(),
    activePlan: z.object({ sourceGapArtifactRevisionId: z.uuid() }).nullable(),
    analysisCycle: gapAnalysisCycleDtoSchema.nullable(),
    prerequisite: gapPrerequisiteSchema,
    history: z.array(z.object({ id: z.string(), label: z.string(), occurredAt: timestampSchema, actor: z.string(), reason: z.string().nullable() })),
    generatedInputs: z.object({
      questions: z.array(z.object({ questionId: z.string(), question: z.string(), displayAnswer: z.string() })),
      documents: z.array(z.object({ documentId: z.uuid(), title: z.string(), archived: z.boolean(), unavailable: z.boolean() })),
    }).nullable(),
    reviewBlockers: z.array(z.uuid()),
    planUpdateAvailable: z.boolean(),
    acceptedStaleness: z.null(),
    candidateStaleness: z.null(),
    staleness: z.object({ outdated: z.literal(true) }).nullable(),
    lifecycleMode: z.enum(["collecting_inputs", "generating", "generated_editable", "locked_by_action_plan"]),
    lifecycle: z.object({
      showInputWizard: z.boolean(),
      showGeneratedViews: z.boolean(),
      inputsEditable: z.boolean(),
      findingsEditable: z.boolean(),
      canGenerate: z.boolean(),
      canFinalize: z.boolean(),
      locked: z.boolean(),
    }),
    findings: z.array(gapFindingReadSchema),
    acceptedFindings: z.array(gapFindingReadSchema),
    candidateFindings: z.array(gapFindingReadSchema),
    comparison: z.array(z.never()),
    gapCounts: z.record(z.string(), z.number().int().nonnegative()),
    lastWorkflowChange: z.object({ id: z.string(), label: z.string(), occurredAt: timestampSchema, actor: z.string(), reason: z.string().nullable() }).nullable(),
  }),
}).superRefine((value, context) => {
  const forbidden = new Set([
    "selectedDocumentVersionIds",
    "documentVersionId",
    "versionNumber",
    "currentVersionId",
  ]);
  const visit = (candidate: unknown, path: PropertyKey[]) => {
    if (!candidate || typeof candidate !== "object") return;
    if (Array.isArray(candidate)) {
      candidate.forEach((item, index) => visit(item, [...path, index]));
      return;
    }
    for (const [key, item] of Object.entries(candidate)) {
      if (forbidden.has(key)) {
        context.addIssue({
          code: "custom",
          message: `Browser workflow contains forbidden document version field: ${key}`,
          path: [...path, key] as Array<string | number>,
        });
      }
      visit(item, [...path, key]);
    }
  };
  visit(value.workflow, ["workflow"]);
});

export const gapRevisionReadSchema = z.object({
  revision: z.object({
    id: z.uuid(),
    organizationId: z.uuid(),
    outputId: z.uuid(),
    previousRevisionId: z.uuid().nullable(),
    assessmentRevisionId: z.uuid(),
    sourceApplicabilityRevisionId: z.uuid().nullable(),
    definitionHash: z.string(),
    buildHash: z.string(),
    locale: z.enum(["de", "en"]),
    inputHash: z.string(),
    result: z.json(),
    jurisdictionCode: z.string().nullable(),
    outcomeCode: z.string().nullable(),
    gapEligible: z.boolean().nullable(),
    generationJobId: z.uuid().nullable(),
    createdBy: z.uuid(),
    createdAt: timestampSchema,
  }),
  findings: z.array(gapFindingReadSchema),
  staleness: z.object({ outdated: z.literal(true) }).nullable(),
});
export const gapInputsReadSchema = z.object({
  inputs: z.object({
    questions: z.array(z.object({ questionId: z.string(), question: z.string(), displayAnswer: z.string() })),
    documents: z.array(z.object({ documentId: z.uuid(), title: z.string(), archived: z.boolean(), unavailable: z.boolean() })),
  }).nullable(),
});
export const gapHistoryReadSchema = z.object({
  history: z.array(z.object({ id: z.string(), label: z.string(), occurredAt: timestampSchema, actor: z.string(), reason: z.string().nullable() })),
});
