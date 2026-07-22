import { contentHash } from "../compliance/publishing/canonical-json";

export type CorpusReleaseMemberValidation = {
  position: number;
  familyId: string;
  sourceFamilyId: string;
  sourceVersionStatus: string;
  renditionVersionId: string;
  sourceVersionId: string;
  translationStatus: string;
  authoritativeRenditionId: string | null;
  processingRenditionId: string;
  renditionId: string;
  processingState: string;
  reliableAnchors: boolean;
  embeddingConfig: unknown;
  contentHash: string;
};

export function validateCorpusReleaseMembers(
  familyId: string,
  members: CorpusReleaseMemberValidation[],
) {
  const errors: string[] = [];
  if (members.length === 0) errors.push("Release has no members");
  const positions = new Set<number>();
  let embeddingConfig: string | undefined;
  for (const member of members) {
    if (member.familyId !== familyId || member.sourceFamilyId !== familyId) errors.push("Member crosses corpus families");
    if (member.sourceVersionStatus !== "reviewed" && member.sourceVersionStatus !== "published") errors.push("Source version is not reviewed");
    if (member.renditionVersionId !== member.sourceVersionId) errors.push("Rendition belongs to another source version");
    if (member.processingRenditionId !== member.renditionId) errors.push("Processing generation belongs to another rendition");
    if (member.processingState !== "reviewed" || !member.reliableAnchors) errors.push("Processing generation is not approved");
    if (member.translationStatus !== "official" && !member.authoritativeRenditionId) errors.push("Translation lacks authoritative provenance");
    if (positions.has(member.position)) errors.push("Release positions are not unique");
    positions.add(member.position);
    const config = JSON.stringify(member.embeddingConfig);
    if (embeddingConfig !== undefined && config !== embeddingConfig) errors.push("Embedding configurations differ");
    embeddingConfig = config;
  }
  if (errors.length) return { ok: false as const, errors: [...new Set(errors)] };
  return {
    ok: true as const,
    contentHash: contentHash([...members].sort((a, b) => a.position - b.position).map((member) => ({
      position: member.position,
      sourceVersionId: member.sourceVersionId,
      renditionId: member.renditionId,
      contentHash: member.contentHash,
      embeddingConfig: member.embeddingConfig,
    }))),
  };
}
