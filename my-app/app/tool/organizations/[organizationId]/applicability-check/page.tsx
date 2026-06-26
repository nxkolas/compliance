import { ProductModuleContent } from "@/components/product-module-content";
import { getDictionary } from "@/lib/i18n";

export default async function ApplicabilityCheckPage() {
  const dictionary = await getDictionary();
  const workflow = dictionary.modules.applicabilityCheck.workflow;

  return (
    <ProductModuleContent
      title={dictionary.modules.applicabilityCheck.title}
      description={dictionary.modules.applicabilityCheck.description}
      metrics={dictionary.modules.applicabilityCheck.metrics}
      cards={[
        {
          title: workflow.purposeTitle,
          description: workflow.purposeDescription,
          items: workflow.results,
        },
        {
          title: workflow.inputsTitle,
          description:
            "Der neue versionierte Fragebogen wird in einer spaeteren Schema-Phase angebunden.",
          items: workflow.inputs,
        },
      ]}
    />
  );
}
