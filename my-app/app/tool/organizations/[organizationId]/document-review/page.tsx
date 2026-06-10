import { ProductModuleContent } from "@/components/product-module-content";
import { getDictionary } from "@/lib/i18n";

export default async function DocumentReviewPage() {
  const dictionary = await getDictionary();

  return (
    <ProductModuleContent
      title={dictionary.modules.documentReview.title}
      description={dictionary.modules.documentReview.description}
      metrics={dictionary.modules.documentReview.metrics}
      cards={dictionary.modules.documentReview.cards}
    />
  );
}
