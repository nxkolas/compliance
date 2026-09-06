"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { GapLabels } from "./types";

export function GapStartState({
  labels,
  canContribute,
  busy,
  error,
  onStart,
}: {
  labels: GapLabels;
  canContribute: boolean;
  busy: boolean;
  error: string | null;
  onStart: () => void;
}) {
  return (
    <div className="mt-8 w-full min-w-0 sm:mt-12 xl:mt-28">
      {error ? (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription className="text-current">{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid min-w-0 grid-cols-1 items-start gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)]">
        <section
          aria-labelledby="gap-start-title"
          className="relative flex min-h-[300px] min-w-0 flex-col justify-center sm:min-h-80"
        >
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 size-full"
            viewBox="0 0 697 320"
            preserveAspectRatio="none"
            fill="none"
          >
            <path
              d="M0.75 307.25V12.75C0.75 6.123 6.123 0.75 12.75 0.75H661.25C667.877 0.75 673.25 6.123 673.25 12.75V139.75C673.25 144.04 675.54 148.005 679.26 150.147L694.75 159.07L680.18 165.866C675.95 167.837 673.25 172.078 673.25 176.742V307.25C673.25 313.877 667.877 319.25 661.25 319.25H12.75C6.123 319.25 0.75 313.877 0.75 307.25Z"
              fill="url(#gap-start-gradient)"
              stroke="#3D4049"
              strokeWidth="1.5"
            />
            <defs>
              <linearGradient id="gap-start-gradient" x1="0" y1="0" x2="281" y2="505" gradientUnits="userSpaceOnUse">
                <stop stopColor="#1A2540" />
                <stop offset="1" stopColor="#111825" />
              </linearGradient>
            </defs>
          </svg>
          <div className="relative z-10 w-[96.7%] min-w-0 px-6 py-10 text-white sm:px-10 xl:px-[46px]">
            <h2 id="gap-start-title" className="text-2xl leading-8 font-bold tracking-tight sm:text-3xl sm:leading-9">
              {labels.startTitle}
            </h2>
            <p className="mt-[14px] max-w-[562px] whitespace-pre-line text-base leading-7">
              {labels.startDescription}
            </p>
            {canContribute ? (
              <Button
                type="button"
                className="relative mt-6 h-12 w-64 max-w-full cursor-pointer justify-center overflow-hidden rounded-lg bg-[#002BFF] px-3 font-sans text-base font-medium whitespace-normal text-white shadow-none transition-[background-color,box-shadow] duration-200 hover:bg-[#123BFF] hover:shadow-[0_4px_16px_rgba(0,43,255,0.35)] disabled:cursor-not-allowed motion-reduce:transition-none"
                disabled={busy}
                onClick={onStart}
              >
                {busy ? (
                  <Loader2 aria-hidden="true" className="size-5 shrink-0 animate-spin" />
                ) : (
                  <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20" fill="none" className="size-5 shrink-0">
                    <path
                      d="M10 7.2V10M10 12.8H10.0075M10 17C10 17 16 14.2 16 10V5.1L10 3L4 5.1V10C4 14.2 10 17 10 17Z"
                      stroke="currentColor"
                      strokeWidth="1.33"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
                <span className="min-w-0">{labels.startAnalysis}</span>
              </Button>
            ) : (
              <p className="mt-6 text-sm leading-6">{labels.readOnly}</p>
            )}
          </div>
        </section>
        <div className="flex min-w-0 justify-center xl:pt-16">
          {/* Frame the visible artwork, excluding the source SVG's transparent margins. */}
          <svg
            aria-hidden="true"
            focusable="false"
            viewBox="38 179 932 629"
            width={932}
            height={629}
            className="block h-auto w-full max-w-[420px] xl:max-w-none"
          >
            <image
              href="/images/landing/landingpage-maskottchen-mit-logo.svg"
              width={1024}
              height={1024}
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
