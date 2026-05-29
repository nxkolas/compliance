import { SignUpForm } from "@/components/sign-up-form";
import { getDictionary } from "@/lib/i18n";
import { Suspense } from "react";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SignUpFormLoader />
    </Suspense>
  );
}

async function SignUpFormLoader() {
  const dictionary = await getDictionary();

  return <SignUpForm labels={dictionary.auth} />;
}
