import { GuestAccountFinalizer } from "@/components/guest/guest-account-finalizer";
import Image from "next/image";
import { Suspense } from "react";

type PageProps = {
  params: Promise<{ assessmentId: string }>;
};

export default function GuestAccountFinalizerPage({ params }: PageProps) {
  return (
    <main className="relative flex min-h-svh w-full items-center justify-center overflow-hidden bg-slate-950 p-4">
      <div className="pointer-events-none absolute inset-0 z-0">
        <Image
          src="/images/Startseite.svg"
          alt="Hintergrund"
          fill
          className="object-cover"
          priority
        />
      </div>
      <div className="relative z-10 w-full max-w-md">
        <Suspense fallback={null}>
          <GuestAccountFinalizerContent params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function GuestAccountFinalizerContent({ params }: PageProps) {
  const { assessmentId } = await params;
  return <GuestAccountFinalizer assessmentId={assessmentId} />;
}
