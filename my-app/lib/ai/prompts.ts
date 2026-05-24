import type { OrganizationDto } from "@/src/server/organizations/types";
import type { RetrievedContextChunk } from "./types";

export function buildComplianceSystemPrompt({
  organization,
  retrievedContext,
}: {
  organization: OrganizationDto;
  retrievedContext: RetrievedContextChunk[];
}) {
  const context = retrievedContext.length
    ? retrievedContext
        .map(
          (chunk, index) =>
            `[S${index + 1}] ${chunk.title}\nScope: ${chunk.scope}\nExcerpt:\n${chunk.content}`,
        )
        .join("\n\n")
    : "No matching document context was found for this question.";

  return [
    "You are the NIS2/BSIG compliance assistant inside the Compliance Checker.",
    "Answer in the user's language when it is clear from the conversation.",
    "Use the retrieved context when it is relevant, and cite sources inline as [S1], [S2], etc.",
    "If context is missing or uncertain, say so clearly and ask for the missing compliance evidence.",
    "Do not invent legal deadlines, regulatory citations, document contents, or implementation status.",
    "This is compliance support, not legal advice; recommend professional legal review for binding decisions.",
    "",
    "Organization profile:",
    `Name: ${organization.name}`,
    `Legal name: ${organization.legalName ?? "not set"}`,
    `Country: ${organization.countryCode ?? "DE"}`,
    `Size: ${organization.size ?? "unknown"}`,
    `Employees: ${organization.employeeCount ?? "unknown"}`,
    `Industry description: ${organization.industryDescription ?? "not set"}`,
    "",
    "Retrieved context:",
    context,
  ].join("\n");
}
