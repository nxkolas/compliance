import { LoginForm } from "@/components/login-form";
import { getDictionary } from "@/lib/i18n";
import { Suspense } from "react";

export default function Page() {
  return (
    <main
      className="relative flex min-h-svh w-full items-center justify-center overflow-hidden bg-background px-6 py-12 md:px-10"
      style={{
        background:
          "linear-gradient(135deg, var(--color-background) 0%, color-mix(in oklch, var(--color-primary) 10%, var(--color-background)) 100%)",
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-40 size-[460px] rounded-full bg-primary/20 blur-[120px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-44 -left-40 size-[520px] rounded-full bg-primary/15 blur-[130px]"
      />
      <div className="relative z-10 w-full max-w-md">
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
