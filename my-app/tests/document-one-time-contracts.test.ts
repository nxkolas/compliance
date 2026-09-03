import { describe, expect, it } from "vitest";
import {
  documentDtoSchema,
  documentListQuerySchema,
  documentUploadCompletionSchema,
} from "@/src/contracts/documents";
import {
  gapAnalysisCycleEvidenceSchema,
  gapAnalysisCyclePrepareSchema,
  gapWorkflowReadSchema,
} from "@/src/contracts/gap-analysis/generation";

const id = "00000000-0000-4000-8000-000000000001";

describe("one-time document browser contracts", () => {
  it("defaults list queries to active documents and 25 rows", () => {
    expect(documentListQuerySchema.parse({})).toEqual({
      status: "active",
      limit: 25,
      search: undefined,
    });
  });

  it("normalizes supported list filters", () => {
    expect(
      documentListQuerySchema.parse({
        status: "archived",
        search: "  policy  ",
        limit: "100",
        cursor: "opaque",
      }),
    ).toEqual({
      status: "archived",
      search: "policy",
      limit: 100,
      cursor: "opaque",
    });
  });

  it("rejects invalid status, search, and limits", () => {
    expect(
      documentListQuerySchema.safeParse({ status: "deleted" }).success,
    ).toBe(false);
    expect(
      documentListQuerySchema.safeParse({ search: "x".repeat(201) }).success,
    ).toBe(false);
    expect(documentListQuerySchema.safeParse({ limit: 101 }).success).toBe(
      false,
    );
  });

  it("keeps the public DTO strict and flat", () => {
    const document = {
      id,
      title: "Policy",
      mimeType: "application/pdf",
      byteSize: 1024,
      uploadedAt: "2026-07-28T12:00:00.000Z",
      status: "active",
      indexStatus: "indexed",
    };
    expect(documentDtoSchema.parse(document)).toEqual(document);
    expect(
      documentDtoSchema.safeParse({
        ...document,
        currentVersionId: id,
      }).success,
    ).toBe(false);
  });

  it("accepts title-only upload completion", () => {
    expect(documentUploadCompletionSchema.parse({ title: "Policy" })).toEqual({
      title: "Policy",
    });
    expect(
      documentUploadCompletionSchema.safeParse({
        title: "Policy",
        documentId: id,
      }).success,
    ).toBe(false);
  });

  it("uses document IDs for Gap Analysis selection", () => {
    expect(
      gapAnalysisCyclePrepareSchema.parse({
        assessmentId: id,
        selectedDocumentIds: [id],
      }).selectedDocumentIds,
    ).toEqual([id]);
    expect(
      gapAnalysisCycleEvidenceSchema.safeParse({
        draftId: id,
        expectedLockVersion: 1,
        selectedDocumentVersionIds: [id],
      }).success,
    ).toBe(false);
  });

  it("rejects document-version fields anywhere in a browser workflow", () => {
    const base = {
      workflow: {
        role: "owner",
        canContribute: true,
        canManage: false,
        release: {
          id: "gap-release",
          versionLabel: "v1",
          questions: [],
          requirements: [],
        },
        assessment: null,
        answers: {},
        questionnaireDraft: null,
        documentLibrary: { documents: [] },
        run: null,
        revision: null,
        analysisCycle: null,
        acceptedRevision: null,
        candidateRevision: null,
        activePlan: null,
        acceptedFindings: [],
        candidateFindings: [],
        findings: [],
        history: [],
        generatedInputs: null,
        reviewBlockers: [],
        planUpdateAvailable: false,
        acceptedStaleness: null,
        candidateStaleness: null,
        staleness: null,
        lifecycleMode: "collecting_inputs",
        lifecycle: {
          showInputWizard: true,
          showGeneratedViews: false,
          inputsEditable: true,
          findingsEditable: false,
          canGenerate: false,
          canFinalize: false,
          locked: false,
        },
        comparison: [],
        gapCounts: { all: 0 },
        lastWorkflowChange: null,
        prerequisite: {
          satisfied: true,
          status: "eligible",
          destination: "/gap",
        },
      },
    };
    expect(gapWorkflowReadSchema.safeParse(base).success).toBe(true);
    expect(
      gapWorkflowReadSchema.safeParse({
        workflow: {
          ...base.workflow,
          documentLibrary: {
            documents: [{
              id,
              title: "Policy",
              mimeType: "application/pdf",
              archivedAt: null,
              eligibleForAnalysis: true,
              documentVersionId: id,
            }],
          },
        },
      }).success,
    ).toBe(false);
  });
});
