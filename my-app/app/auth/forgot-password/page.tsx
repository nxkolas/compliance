import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { getDictionary } from "@/lib/i18n";
import { Suspense } from "react";
import { PublicLanguageSwitcher } from "@/components/public-language-switcher";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <Suspense fallback={null}>
        <PublicLanguageSwitcher />
      </Suspense>
      <div className="w-full max-w-sm">
        <Suspense fallback={null}>
          <ForgotPasswordFormLoader />
        </Suspense>
      </div>
    </div>
  );
}

async function ForgotPasswordFormLoader() {
  const dictionary = await getDictionary();

  return <ForgotPasswordForm labels={dictionary.auth} />;
}
