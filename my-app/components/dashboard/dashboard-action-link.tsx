"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { readApplicabilityDraft, subscribeApplicabilityDraft } from "@/src/applicability-draft";

export function DashboardActionLink({ href, label, draftKey, startLabel, continueLabel }: { href: string; label: string; draftKey?: string; startLabel?: string; continueLabel?: string }) {
  const draft = useSyncExternalStore(subscribeApplicabilityDraft, () => draftKey ? readApplicabilityDraft(draftKey) : null, () => null);
  return <Link href={href} className="mt-5 ml-auto flex w-fit max-w-full items-center justify-end gap-1 font-sans text-[10px] leading-5 font-medium text-white/70 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4">
    <span>{draftKey ? draft ? continueLabel : startLabel : label}</span>
    <svg width="17" height="17" viewBox="0 0 17 17" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M6.07571 4.03937L10.0504 8.06453L6.02523 12.0392" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </Link>;
}
