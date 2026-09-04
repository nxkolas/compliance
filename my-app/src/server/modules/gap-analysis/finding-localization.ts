import type { LoadedGapRelease } from "./release-loader";

type CatalogueRequirement = LoadedGapRelease["requirements"][number];

export function localizeGapFinding<
  T extends {
    finding: { requirementVersionId: string };
    requirement: Record<string, unknown>;
  },
>(
  row: T,
  catalogueByVersionId: ReadonlyMap<string, CatalogueRequirement>,
  releaseId?: string,
) {
  const catalogue = catalogueByVersionId.get(
    row.finding.requirementVersionId,
  );
  if (!catalogue) {
    throw new Error(
      `Pinned requirement ${row.finding.requirementVersionId} is absent from the localized Gap release catalogue${releaseId ? ` ${releaseId}` : ""}`,
    );
  }
  return {
    ...row,
    requirement: {
      ...row.requirement,
      stableRequirementId: catalogue.stableRequirementId,
      code: catalogue.code,
      position: catalogue.position,
      icon: catalogue.icon,
      criticality: catalogue.criticality,
      title: catalogue.title,
      requirementText: catalogue.requirementText,
      legalReferences: catalogue.legalReferences,
    },
  };
}
