import { ApiError } from "../../platform/http/errors";

export type ScopedDocumentVersion = { id: string; organizationId: string };

export function assertSelectedDocumentVersionScope(
  organizationId: string,
  selectedVersionIds: string[],
  available: ScopedDocumentVersion[],
) {
  const selected = [...new Set(selectedVersionIds)];
  if (selected.length === 0) {
    throw new ApiError(400, "At least one document version must be selected");
  }
  const allowed = new Set(
    available
      .filter((version) => version.organizationId === organizationId)
      .map((version) => version.id),
  );
  if (selected.some((id) => !allowed.has(id))) {
    throw new ApiError(404, "A selected document version was not found");
  }
  return selected;
}
