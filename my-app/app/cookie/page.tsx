import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { getDictionary } from "@/src/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getDictionary();

  return {
    title: dictionary.legal.cookie.metadataTitle,
    description: dictionary.legal.cookie.metadataDescription,
  };
}

export default async function CookiePage() {
  const dictionary = await getDictionary();

  return (
    <LegalPage
      dictionary={dictionary}
      document={dictionary.legal.cookie}
      page="cookie"
    />
  );
}
