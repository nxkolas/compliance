import { UpdatePasswordForm } from "@/components/update-password-form";
import { getDictionary } from "@/lib/i18n";
import { Suspense } from "react";
import { PublicLanguageSwitcher } from "@/components/public-language-switcher";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <Suspense fallback={null}>
        <PublicLanguageSwitcher compactOnMobile />
      </Suspense>
      <div className="w-full max-w-sm">
        <Suspense fallback={null}>
          <UpdatePasswordFormLoader />
        </Suspense>
      </div>
    </div>
  );
}

async function UpdatePasswordFormLoader() {
  const dictionary = await getDictionary();

  return <UpdatePasswordForm labels={dictionary.auth} />;
}
