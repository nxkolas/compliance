import "dotenv/config";
import { buildGapPrompt } from "../src/server/gap-analysis/prompt-builder";
import { createGapGenerationModel } from "../src/server/gap-analysis/model";
import { validateGapModelResponse } from "../src/server/gap-analysis/generation-schema";
import { demoGapRelease } from "../src/server/gap-analysis/releases/demo-v1/release";

async function main() {
  if (process.env.RUN_LIVE_GAP_EVAL !== "1") {
    throw new Error("Set RUN_LIVE_GAP_EVAL=1 to acknowledge live model usage and cost");
  }
  const requirement = demoGapRelease.requirementSet.requirements[0];
  const citations = [
    {
      id: "Q:live-demo",
      sourceType: "assessment_answer" as const,
      sourceId: "00000000-0000-0000-0000-000000000001",
      excerpt: "Access rights are implemented and documented.",
      pageNumber: null,
      sectionLabel: null,
    },
    {
      id: "DOC:live-demo",
      sourceType: "document_chunk" as const,
      sourceId: "00000000-0000-0000-0000-000000000002",
      excerpt: "The access owner reviews all role assignments every quarter and records approval.",
      pageNumber: 2,
      sectionLabel: "Access review",
    },
  ];
  const prompt = buildGapPrompt([{
    code: requirement.code,
    title: requirement.title.en,
    requirementText: requirement.requirementText.en,
    criticality: requirement.criticality,
    legalReferences: requirement.legalReferences,
    citations,
  }]);
  const model = createGapGenerationModel(demoGapRelease.modelPolicy.model);
  const result = await model.generate(prompt);
  const validated = validateGapModelResponse({
    value: result.value,
    requestedRequirementCodes: [requirement.code],
    citations,
    citationIdsByRequirement: {
      [requirement.code]: citations.map((citation) => citation.id),
    },
  });
  console.log(JSON.stringify({
    model: model.model,
    promptTemplateHash: demoGapRelease.prompt.templateHash,
    renderedInputHash: prompt.renderedInputHash,
    inputTokens: result.inputTokens ?? null,
    outputTokens: result.outputTokens ?? null,
    finding: validated.findings[0],
  }, null, 2));
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
