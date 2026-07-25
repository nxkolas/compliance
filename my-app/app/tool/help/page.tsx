import { AppShell } from "@/components/app-shell";
import { ProductModuleContent } from "@/components/product-module-content";
import { getDictionary } from "@/lib/i18n";

export default async function HelpGlossaryPage() {
  const dictionary = await getDictionary();

  return (
    <AppShell dictionary={dictionary}>
      <ProductModuleContent
        title={dictionary.modules.helpGlossary.title}
        description={dictionary.modules.helpGlossary.description}
        metrics={dictionary.modules.helpGlossary.metrics}
        cards={dictionary.modules.helpGlossary.cards}
      />
    </AppShell>
  );
}
