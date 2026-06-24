"use client";

import type { Dictionary } from "@/lib/i18n";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export function GuestAccountFinalizer({
  assessmentId,
  labels,
}: {
  assessmentId: string;
  labels: Dictionary["guestCheck"]["finalizer"];
}) {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    router.replace(`/tool/organizations/claim-assessment/${assessmentId}`);
    router.refresh();
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
          {labels.title}
        </h1>
        <p className="text-base text-white/80">
          {labels.description}
        </p>
      </div>
      <div className="self-stretch rounded-2xl bg-[#FAFAFA] p-9 text-black">
        <p>{labels.claiming}</p>
      </div>
    </div>
  );
}
