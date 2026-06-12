"use client";

import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function GuestAccountFinalizer({
  assessmentId,
}: {
  assessmentId: string;
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
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Übernahme fehlgeschlagen");
        }
        router.replace(`/tool/assessments/${assessmentId}/result`);
        router.refresh();
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Der Schnellcheck konnte nicht übernommen werden.",
        );
      }
    }

    void claimAssessment();
  }, [assessmentId, router]);

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
          Konto wird erstellt
        </h1>
        <p className="text-base text-white/80">
          Ihr Schnellcheck wird jetzt mit dem Konto verknüpft.
        </p>
      </div>
      <div className="self-stretch rounded-2xl bg-[#FAFAFA] p-9 text-black">
        {error ? (
          <div className="flex flex-col gap-5">
            <p className="text-sm font-medium text-destructive">{error}</p>
            <Button asChild className="h-12 bg-[#002AFF] text-white">
              <Link href={`/check/${assessmentId}/claim`}>
                Mit bestehendem Konto anmelden
              </Link>
            </Button>
          </div>
        ) : (
          <p>Ergebnis wird übernommen...</p>
        )}
      </div>
    </div>
  );
}
