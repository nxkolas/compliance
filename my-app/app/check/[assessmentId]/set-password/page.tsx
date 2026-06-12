import { GuestAccountFinalizer } from "@/components/guest/guest-account-finalizer";
import { getDictionary } from "@/lib/i18n";
import Image from "next/image";
import { Suspense } from "react";

type PageProps = {
  params: Promise<{ assessmentId: string }>;
};

export default function GuestAccountFinalizerPage({ params }: PageProps) {
  return (
    <Suspense fallback={null}>
      <GuestAccountFinalizerContent params={params} />
    </Suspense>
  );
}

async function GuestAccountFinalizerContent({ params }: PageProps) {
  const { assessmentId } = await params;
  const dictionary = await getDictionary();

  return (
    <main className="relative flex min-h-svh w-full items-center justify-center overflow-hidden bg-slate-950 p-4">
      <div className="pointer-events-none absolute inset-0 z-0">
        <Image
          src="/images/Startseite.svg"
          alt={dictionary.guestCheck.finalizer.backgroundAlt}
          fill
          className="object-cover"
          priority
        />
      </div>
      <div className="relative z-10 w-full max-w-md">
        <GuestAccountFinalizer
          assessmentId={assessmentId}
          labels={dictionary.guestCheck.finalizer}
        />
      </div>
    </main>
  );
}
