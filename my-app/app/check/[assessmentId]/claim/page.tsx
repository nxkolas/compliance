import { LoginForm } from "@/components/login-form";
import { getDictionary } from "@/lib/i18n";
import Image from "next/image";
import { Suspense } from "react";

type PageProps = {
  params: Promise<{ assessmentId: string }>;
};

export default function GuestClaimPage({ params }: PageProps) {
  return (
    <Suspense fallback={null}>
      <GuestClaimContent params={params} />
    </Suspense>
  );
}

async function GuestClaimContent({ params }: PageProps) {
  const { assessmentId } = await params;
  const dictionary = await getDictionary();

  return (
    <main className="relative flex min-h-svh w-full items-center justify-center overflow-hidden bg-slate-950 p-4">
      <div className="pointer-events-none absolute inset-0 z-0">
        <Image
          src="/images/Startseite.svg"
          alt={dictionary.auth.backgroundAlt}
          fill
          className="object-cover"
          priority
        />
      </div>
      <div className="relative z-10 w-full max-w-md">
        <LoginForm
          labels={dictionary.auth}
          guestAssessmentId={assessmentId}
        />
      </div>
    </main>
  );
}
