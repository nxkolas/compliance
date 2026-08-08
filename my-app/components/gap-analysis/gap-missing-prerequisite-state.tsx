import Image from "next/image";
import Link from "next/link";
import { CircleHelp, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GapMissingPrerequisiteState({
  destination,
  title,
  description,
  action,
  whySequence,
  infoTitle,
  infoDescription,
  variant = "missing",
  noticeTitle,
}: {
  destination: string;
  title: string;
  description: string;
  action: string;
  whySequence: string;
  infoTitle: string;
  infoDescription: string;
  variant?: "missing" | "unsupported-country";
  noticeTitle?: string;
}) {
  const isUnsupportedCountry = variant === "unsupported-country";

  return (
    <div
      data-gap-missing-prerequisite
      className="mt-8 w-full max-w-[1274px] sm:mt-12 lg:mt-16 xl:mt-16"
    >
      <div className="relative flex min-w-0 flex-col xl:min-h-[576px]">
        <div className="w-full min-w-0 xl:w-[694px]">
          <section className="relative min-h-[384px] overflow-visible xl:w-[697px]">
            <svg
              data-gap-prerequisite-speech-bubble
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 size-full"
              viewBox="0 0 697 360"
              fill="none"
              preserveAspectRatio="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M0.75 346.75V12.75C0.75 6.12258 6.12258 0.75 12.75 0.75H661.248C667.876 0.75 673.248 6.12259 673.248 12.75V156.595C673.248 160.886 675.54 164.851 679.259 166.993L694.75 175.916L680.177 182.712C675.95 184.683 673.248 188.924 673.248 193.588V346.75C673.248 353.377 667.876 358.75 661.248 358.75H12.75C6.12258 358.75 0.75 353.377 0.75 346.75Z"
                fill="#D9D9D9"
              />
              <path
                d="M0.75 346.75V12.75C0.75 6.12258 6.12258 0.75 12.75 0.75H661.248C667.876 0.75 673.248 6.12259 673.248 12.75V156.595C673.248 160.886 675.54 164.851 679.259 166.993L694.75 175.916L680.177 182.712C675.95 184.683 673.248 188.924 673.248 193.588V346.75C673.248 353.377 667.876 358.75 661.248 358.75H12.75C6.12258 358.75 0.75 353.377 0.75 346.75Z"
                fill="url(#gap-prerequisite-bubble-gradient)"
              />
              <path
                d="M0.75 346.75V12.75C0.75 6.12258 6.12258 0.75 12.75 0.75H661.248C667.876 0.75 673.248 6.12259 673.248 12.75V156.595C673.248 160.886 675.54 164.851 679.259 166.993L694.75 175.916L680.177 182.712C675.95 184.683 673.248 188.924 673.248 193.588V346.75C673.248 353.377 667.876 358.75 661.248 358.75H12.75C6.12258 358.75 0.75 353.377 0.75 346.75Z"
                stroke="#3D4049"
                strokeWidth="1.5"
              />
              <defs>
                <linearGradient
                  id="gap-prerequisite-bubble-gradient"
                  x1="0.75"
                  y1="0.75"
                  x2="294.595"
                  y2="563.248"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#1A2540" />
                  <stop offset="1" stopColor="#111825" />
                </linearGradient>
              </defs>
            </svg>

            <div
              className={
                isUnsupportedCountry
                  ? "relative z-10 px-6 pt-10 sm:px-10 xl:px-[46px] xl:pt-[52px]"
                  : "relative z-10 px-6 pt-8 sm:px-10 xl:px-[46px] xl:pt-[34px]"
              }
            >
              <h2 className="max-w-[474px] text-2xl leading-8 font-bold tracking-tight text-white sm:text-3xl sm:leading-9">
                {title}
              </h2>
              {noticeTitle ? (
                <h3 className="mt-5 max-w-[520px] text-xl leading-7 font-semibold text-white">
                  {noticeTitle}
                </h3>
              ) : null}
              <p
                className={
                  noticeTitle
                    ? "mt-3 max-w-[548px] text-base leading-7 text-white"
                    : "mt-[14px] max-w-[482px] text-base leading-7 text-white"
                }
              >
                {description}
              </p>
              <Button
                asChild
                className="mt-[29px] h-12 w-full gap-3 overflow-hidden rounded-lg bg-[#002BFF] px-5 text-base font-medium text-white shadow-none hover:bg-[#0022CC] sm:w-96"
              >
                <Link href={destination}>
                  <ApplicabilityCheckIcon />
                  {action}
                </Link>
              </Button>
            </div>

            {!isUnsupportedCountry ? (
              <div className="absolute right-6 bottom-0 left-0 z-10 flex h-[93px] items-center border-t border-slate-800 pl-6 sm:pl-10 xl:pl-[46px]">
                <div className="flex items-center gap-[18px] text-white">
                  <CircleHelp aria-hidden="true" className="size-7 shrink-0" strokeWidth={1.33} />
                  <span className="text-base leading-5 font-medium">{whySequence}</span>
                </div>
              </div>
            ) : null}
          </section>

          {!isUnsupportedCountry ? (
            <aside className="relative mt-8 flex min-h-40 w-full items-start rounded-xl bg-[rgba(27,29,38,0.36)] px-6 pt-[23px] text-white outline outline-1 outline-offset-[-1px] outline-[rgba(0,43,255,0.42)] sm:px-10 xl:block xl:h-40 xl:w-[673px] xl:px-0 xl:pt-0">
              <Info aria-hidden="true" className="mt-0.5 size-7 shrink-0 xl:absolute xl:top-[23px] xl:left-[46px] xl:mt-0" strokeWidth={1.33} />
              <div className="ml-[18px] min-w-0 xl:absolute xl:top-[28px] xl:left-[92px] xl:ml-0 xl:w-[559px]">
                <h3 className="text-lg leading-5 font-bold">{infoTitle}</h3>
                <p className="mt-[13px] max-w-[549px] text-base leading-7">
                  {infoDescription}
                </p>
              </div>
            </aside>
          ) : null}
        </div>

        <div className="order-first mb-6 flex w-full justify-center xl:absolute xl:top-1 xl:left-[690px] xl:order-none xl:mb-0 xl:size-[560px] xl:justify-start">
          <Image
            src="/robot-sad.svg"
            alt=""
            width={560}
            height={560}
            className="h-auto w-full max-w-[420px] object-contain xl:max-w-none"
          />
        </div>
      </div>
    </div>
  );
}

function ApplicabilityCheckIcon() {
  return (
    <svg
      data-applicability-check-icon
      aria-hidden="true"
      className="size-5 shrink-0"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4.33335 18.3332H16C16.442 18.3332 16.866 18.1576 17.1785 17.845C17.4911 17.5325 17.6667 17.1085 17.6667 16.6665V6.24984L13.0834 1.6665H6.00002C5.55799 1.6665 5.13407 1.8421 4.82151 2.15466C4.50895 2.46722 4.33335 2.89114 4.33335 3.33317V5.83317M12.6667 1.6665V6.6665H17.6667M8.50002 14.9998L7.25002 13.7498M5.16669 14.1665C5.49499 14.1665 5.82008 14.1018 6.1234 13.9762C6.42671 13.8506 6.70231 13.6664 6.93445 13.4343C7.1666 13.2021 7.35075 12.9265 7.47639 12.6232C7.60202 12.3199 7.66669 11.9948 7.66669 11.6665C7.66669 11.3382 7.60202 11.0131 7.47639 10.7098C7.35075 10.4065 7.1666 10.1309 6.93445 9.89874C6.70231 9.66659 6.42671 9.48244 6.1234 9.3568C5.82008 9.23117 5.49499 9.1665 5.16669 9.1665C4.50365 9.1665 3.86776 9.4299 3.39892 9.89874C2.93008 10.3676 2.66669 11.0035 2.66669 11.6665C2.66669 12.3295 2.93008 12.9654 3.39892 13.4343C3.86776 13.9031 4.50365 14.1665 5.16669 14.1665Z"
        stroke="#FBFBFB"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
