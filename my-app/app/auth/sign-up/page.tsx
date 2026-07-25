import { SignUpForm } from "@/components/sign-up-form";
import { getDictionary } from "@/lib/i18n";
import { Suspense } from "react";
import { PublicLanguageSwitcher } from "@/components/public-language-switcher";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PublicLanguageSwitcher />
      <SignUpFormLoader />
    </Suspense>
  );
}

async function SignUpFormLoader() {
  const dictionary = await getDictionary();

  return <SignUpForm labels={dictionary.auth} />;
}
