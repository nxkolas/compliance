import { LoginForm } from "../../../components/login-form"; // Mit geschweiften Klammern!
import { getDictionary } from "@/src/i18n";
import { Suspense } from "react";
import { PublicLanguageSwitcher } from "@/components/public-language-switcher";

export default function Page() {
  return (
    <main className="relative flex min-h-svh w-full items-center justify-center overflow-hidden bg-transparent p-4">
      <Suspense fallback={null}>
        <PublicLanguageSwitcher compactOnMobile />
      </Suspense>

      {/* VORDERGRUND: Die Maske schwebt darüber */}
      <div className="relative z-10 w-full max-w-[476px]">
        <Suspense fallback={null}>
          <LoginFormLoader />
        </Suspense>
      </div>
    </main>
  );
}

async function LoginFormLoader() {
  const dictionary = await getDictionary();

  return <LoginForm labels={dictionary.auth} />;
}
