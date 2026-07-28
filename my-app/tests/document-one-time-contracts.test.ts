import { describe, expect, it } from "vitest";
import {
  documentDtoSchema,
  documentListQuerySchema,
  documentUploadCompletionSchema,
} from "@/src/contracts/documents";
import {
  gapReassessmentEvidenceSchema,
  gapReassessmentPrepareSchema,
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
      gapReassessmentPrepareSchema.parse({
        assessmentId: id,
        selectedDocumentIds: [id],
      }).selectedDocumentIds,
    ).toEqual([id]);
    expect(
      gapReassessmentEvidenceSchema.safeParse({
        draftId: id,
        expectedLockVersion: 1,
        selectedDocumentVersionIds: [id],
      }).success,
    ).toBe(false);
  });

  it("rejects document-version fields anywhere in a browser workflow", () => {
    const base = {
      workflow: {
        canContribute: true,
        canManage: false,
        release: null,
        assessment: null,
        run: null,
        reassessment: null,
        acceptedRevision: null,
        candidateRevision: null,
        acceptedFindings: [],
        candidateFindings: [],
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
            documents: [{ id, documentVersionId: id }],
          },
        },
      }).success,
    ).toBe(false);
  });
});
