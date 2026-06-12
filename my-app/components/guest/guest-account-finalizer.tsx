"use client";

import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function GuestAccountFinalizer({
  assessmentId,
  labels,
}: {
  assessmentId: string;
  labels: Dictionary["guestCheck"]["finalizer"];
}) {
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    async function claimAssessment() {
      try {
        const response = await fetch(
          `/api/guest-assessments/${assessmentId}/claim`,
          { method: "POST" },
        );
        if (!response.ok) {
          throw new Error(labels.claimFailed);
        }
        router.replace(`/tool/assessments/${assessmentId}/result`);
        router.refresh();
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : labels.claimFailed,
        );
      }
    }

    void claimAssessment();
  }, [assessmentId, labels.claimFailed, router]);

  return (
    <div className="flex w-full max-w-110.5 flex-col items-start gap-4 px-4 font-['Space_Grotesk']">
      <div className="flex h-16 items-center">
        <Image
          src="/images/Logo-weiß.svg"
          alt="complyX Logo"
          width={180}
          height={48}
          priority
          className="object-contain"
        />
      </div>
      <div className="flex self-stretch flex-col gap-2 pb-4">
        <h1 className="text-4xl font-medium tracking-tight text-white">
          {labels.title}
        </h1>
        <p className="text-base text-white/80">
          {labels.description}
        </p>
      </div>
      <div className="self-stretch rounded-2xl bg-[#FAFAFA] p-9 text-black">
        {error ? (
          <div className="flex flex-col gap-5">
            <p className="text-sm font-medium text-destructive">{error}</p>
            <Button asChild className="h-12 bg-[#002AFF] text-white">
              <Link href={`/check/${assessmentId}/claim`}>
                {labels.signIn}
              </Link>
            </Button>
          </div>
        ) : (
          <p>{labels.claiming}</p>
        )}
      </div>
    </div>
  );
}
