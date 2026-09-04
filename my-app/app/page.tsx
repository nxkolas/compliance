import { AuthButton } from "@/components/auth-button";
import { BrandLogo } from "@/components/brand-logo";
import { AnimatedMascot } from "@/components/landing/animated-mascot";
import { DirectiveIllustrationInteraction } from "@/components/landing/directive-illustration-interaction";
import { CtaIntroShine } from "@/components/landing/cta-intro-shine";
import { PuzzleWorkflowReveal } from "@/components/landing/puzzle-workflow-reveal";
import { ProductVideo } from "@/components/landing/product-video";
import { LandingQuestionCard } from "@/components/landing/question-card";
import { TeamPuzzleSection } from "@/components/landing/team-puzzle-section";
import { PublicLanguageSwitcher } from "@/components/public-language-switcher";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import financialGraphAnimation from "@/public/animations/financial-graph-loader.json";
import { listOrganizationsForUserPage } from "@/src/server/modules/organizations";
import {
  ArrowRight,
  Building2,
  Database,
  ShieldCheck,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

type LottiePoint = [number, number];
type LottieShape = {
  i: LottiePoint[];
  o: LottiePoint[];
  v: LottiePoint[];
  c: boolean;
};

type FinancialGraphLottie = {
  layers: [
    {
      shapes: [
        {
          it: [
            {
              ks: {
                k: Array<{ s: [LottieShape] }>;
              };
            },
          ];
        },
      ];
    },
  ];
};

const financialGraphData = financialGraphAnimation as unknown as FinancialGraphLottie;
const financialGraphPaths = financialGraphData.layers[0].shapes[0].it[0].ks.k.map(
  (keyframe) => lottieShapeToPath(keyframe.s[0]),
);

export default function Home() {
  return (
    <div className="min-h-screen bg-transparent text-white">
      <Suspense fallback={<HomeFallback />}>
        <PublicLanguageSwitcher showThemeSwitcher compactOnMobile />
        <HomeContent />
      </Suspense>
    </div>
  );
}

async function HomeContent() {
  const dictionary = await getDictionary();
  const home = dictionary.home;
  const userState = await getLandingUserState();
  const isAuthenticated = userState !== "guest";
  const isNewUser = userState === "new-user";
  const authenticatedHero = isNewUser
    ? home.newUserHero
    : home.authenticatedHero;
  const heroPrimaryHref = isNewUser
    ? "/tool/organizations/new"
    : isAuthenticated
      ? "/tool/organizations"
      : "/check/applicability";
  const heroPrimaryLabel = isNewUser
    ? home.newUserHero.primaryCta
    : isAuthenticated
      ? home.dashboardCta
      : home.selfCheckCta;
  const applicabilityHref = isAuthenticated
    ? "/tool/organizations"
    : "/check/applicability";
  const questionCards = [
    { ...home.questions.items[0], illustration: "scope" as const },
    { ...home.questions.items[1], illustration: "documents" as const },
    { ...home.questions.items[2], illustration: "team" as const },
  ];

  return (
    <main className="dark min-h-screen overflow-hidden bg-transparent text-white">
      <header className="dark fixed inset-x-0 top-0 z-40 h-32 bg-[#02040E]/25 text-white backdrop-blur-md sm:h-28">
        <div className="relative mx-auto flex h-full max-w-[1728px] items-start gap-8 px-4 pb-14 pt-4 sm:items-center sm:px-10 sm:py-0 lg:px-12 xl:px-[72px]">
          <Link href="/" aria-label={home.brand} className="shrink-0">
            <BrandLogo
              alt={home.brand}
              width={203}
              height={66}
              priority
              className="h-auto w-28 sm:w-44 lg:w-[203px]"
            />
          </Link>

          <nav className="ml-auto hidden items-center gap-8 font-sans text-base font-medium text-white lg:flex">
            <Link
              className="transition-all duration-200 hover:text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.70)]"
              href="#nis2"
            >
              {home.navigation.nis2}
            </Link>
            <Link
              className="transition-all duration-200 hover:text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.70)]"
              href="#about"
            >
              {home.navigation.about}
            </Link>
          </nav>

          <div className="absolute right-4 bottom-2 text-sm sm:static sm:mr-32">
            {hasEnvVars ? (
              <Suspense fallback={<div className="h-8 w-48" />}>
                <AuthButton />
              </Suspense>
            ) : (
              <p className="text-xs text-white/60 sm:text-sm">
                {dictionary.common.supabaseMissing}
              </p>
            )}
          </div>
        </div>
      </header>
      <div aria-hidden="true" className="h-32 sm:h-28" />

      <section className="relative isolate min-h-[760px]">
        <div className="absolute inset-x-0 top-[-112px] -z-10 h-[977px] w-full overflow-hidden">
          <div className="absolute inset-x-0 top-[627px] z-10 h-64 bg-[linear-gradient(180deg,rgba(2,4,14,0)_0%,rgba(2,9,40,0.156)_25%,rgba(1,13,65,0.5)_50%,rgba(1,18,91,0.844)_75%,#001674_100%)] opacity-[0.82]" />
        </div>
        <div
          className={
            isAuthenticated
              ? "relative mx-auto grid min-h-[760px] max-w-[1728px] content-center gap-x-16 gap-y-12 px-6 py-20 sm:px-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-12 xl:px-[72px]"
              : "relative mx-auto flex min-h-[760px] max-w-[1728px] flex-col justify-center px-6 py-20 sm:px-10 lg:px-12 xl:px-[72px]"
          }
        >
          <div className="max-w-[720px]">
            {isAuthenticated ? (
              <>
                <h1 className="relative top-2 w-full max-w-[700px] text-4xl font-normal leading-[1.2] text-white sm:text-5xl lg:text-[52px]">
                  <span className="flex flex-col items-start gap-2 sm:flex-row sm:flex-nowrap sm:items-center sm:gap-x-3">
                    <span className="relative top-2 shrink-0 whitespace-nowrap">
                      {authenticatedHero.welcomeTitleBeforeLogo}
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-0.5">
                      <BrandLogo
                        alt={home.brand}
                        width={203}
                        height={66}
                        priority
                        className="h-auto w-32 sm:w-48 lg:w-[203px]"
                      />
                      <span className="relative top-2 shrink-0 leading-none">
                        .
                      </span>
                    </span>
                  </span>
                </h1>
                <p className="mt-7 max-w-[650px] text-2xl font-normal leading-[1.35] text-white sm:text-3xl lg:text-[34px]">
                  {authenticatedHero.continuationBefore}{" "}
                  <span className="text-[#002BFF]">
                    {authenticatedHero.continuationHighlight}
                  </span>
                  {authenticatedHero.continuationAfter === "." ? null : " "}
                  {authenticatedHero.continuationAfter}
                </p>
              </>
            ) : (
              <>
                <BrandLogo
                  alt={home.brand}
                  width={296}
                  height={96}
                  priority
                  className="mb-6 h-auto w-52 sm:w-64 lg:w-[296px]"
                />
                <h1 className="w-full max-w-[658px] text-4xl font-normal leading-[1.2] text-white sm:min-h-32 sm:leading-[61px]">
                  {home.hero.titleBefore}{" "}
                  <span className="font-normal text-[#002BFF]">
                    {home.hero.titleHighlight}
                  </span>{" "}
                  {home.hero.titleAfter}
                </h1>
              </>
            )}
            <p className={isAuthenticated ? "mt-5 max-w-[620px] text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8" : "mt-6 max-w-[690px] text-base leading-8 text-muted-foreground sm:text-lg sm:leading-9"}>
              {isAuthenticated
                ? authenticatedHero.description
                : home.heroDescription}
            </p>
            <div className={isAuthenticated ? "mt-8 flex flex-col gap-4 sm:flex-row" : "mt-9 flex flex-col gap-4 sm:flex-row"}>
              <Button
                asChild
                size="lg"
                className="h-12 min-w-64 rounded-lg bg-[#002BFF] px-7 text-base transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#002BFF] hover:shadow-[0px_7px_16px_0px_rgba(0,43,255,0.55)] active:translate-y-0"
              >
                <Link href={heroPrimaryHref}>
                  {isNewUser ? (
                    <Building2 className="size-5 shrink-0" aria-hidden="true" />
                  ) : isAuthenticated ? (
                    <LandingDashboardIcon />
                  ) : (
                    <ApplicabilityCheckIcon />
                  )}
                  {heroPrimaryLabel}
                </Link>
              </Button>
              <Link
                href="#product-video"
                className="inline-flex h-12 w-full max-w-72 items-center justify-center overflow-hidden rounded-lg bg-transparent font-sans text-base font-medium text-white/70 shadow-[0px_4px_4px_0px_rgba(255,255,255,0.25)] outline outline-[1.5px] outline-offset-[-1.5px] outline-white/70 transition-all duration-200 hover:-translate-y-0.5 hover:text-white hover:shadow-[0px_7px_14px_0px_rgba(255,255,255,0.32)] hover:outline-white active:translate-y-0"
              >
                <span>
                  {isNewUser
                    ? home.newUserHero.secondaryCta
                    : home.hero.secondaryCta}
                </span>
              </Link>
            </div>

            {isAuthenticated ? (
              <div className="mt-16 flex flex-wrap gap-3 sm:gap-6">
                <TrustPill
                  icon={<ShieldCheck className="size-4 text-white" />}
                  label={home.trust.gdpr}
                />
                <TrustPill
                  icon={<Database className="size-4 text-white" />}
                  label={home.trust.frankfurt}
                />
                <TrustPill
                  icon={<NoItDepartmentIcon />}
                  label={home.trust.noItDepartment}
                />
              </div>
            ) : null}
          </div>

          {!isAuthenticated ? (
            <div className="mt-16 flex flex-wrap gap-3 sm:gap-6">
              <TrustPill
                icon={<ShieldCheck className="size-4 text-white" />}
                label={home.trust.gdpr}
              />
              <TrustPill
                icon={<Database className="size-4 text-white" />}
                label={home.trust.frankfurt}
              />
              <TrustPill
                icon={<NoItDepartmentIcon />}
                label={home.trust.noItDepartment}
              />
            </div>
          ) : null}

          <HeroLaptopPreview
            title={isAuthenticated
              ? authenticatedHero.previewTitle
              : home.statusTitle}
          />
        </div>
      </section>

      <section
        id="nis2"
        className="relative isolate scroll-mt-24 overflow-hidden bg-transparent py-24 lg:min-h-[643px] lg:py-32"
      >
        <div className="mx-auto grid max-w-[1728px] gap-16 px-6 sm:px-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-start lg:px-12 xl:px-[72px]">
          <div>
            <h2 className="max-w-[560px] text-3xl font-medium leading-tight sm:text-4xl sm:leading-[1.35] lg:text-[46px]">
              {home.directive.titleBefore}{" "}
              <span className="bg-gradient-to-r from-[#0073FF] to-[#FFFFFF] bg-clip-text font-bold text-transparent">
                {home.directive.titleHighlight}
              </span>
              {home.directive.titleAfter}
            </h2>
            <DirectiveIllustration />
          </div>
          <div className="max-w-4xl text-base leading-8 text-muted-foreground sm:text-lg sm:leading-10 lg:pt-32 xl:pt-36">
            {home.directive.paragraphs.map((paragraph) => (
              <p key={paragraph} className="mb-6 last:mb-0">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section
        id="product-video"
        className="relative isolate scroll-mt-28 overflow-hidden bg-transparent pb-24 pt-16 lg:min-h-[951px] lg:pb-32 lg:pt-20"
      >
        <div className="absolute inset-x-0 top-[-28px] -z-10 h-[951px] bg-white/10" />
        <div className="relative mx-auto max-w-[1180px] px-6 sm:px-10">
          <ProductPreview
            title={home.statusTitle}
            playLabel={home.videoPlayLabel}
            fallback={home.videoFallback}
          />
          <div className="mt-12 flex justify-center">
            <Button
              asChild
              className="group relative h-12 w-full max-w-72 overflow-hidden rounded-lg border-0 bg-[#002BFF] px-8 font-sans text-base font-medium text-white shadow-[0_6px_18px_rgba(0,43,255,0.32)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#002BFF] hover:text-white hover:shadow-[0_9px_24px_rgba(0,43,255,0.46)] focus-visible:ring-2 focus-visible:ring-[#6681FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#02040E] active:translate-y-0"
            >
              <Link href={applicabilityHref} className="flex items-center justify-center gap-3">
                <CtaIntroShine />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -left-[35%] top-[-50%] h-[200%] w-[22%] rotate-[18deg] bg-gradient-to-r from-transparent via-white/30 to-transparent blur-[1px] transition-[left] duration-700 ease-out group-hover:left-[115%]"
                />
                <span className="relative">{home.showcaseCta}</span>
                <ArrowRight className="relative size-5 shrink-0 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section
        id="workflow"
        className="scroll-mt-24 bg-[#060918] py-24 lg:min-h-[866px] lg:py-32"
      >
        <div className="mx-auto max-w-[1380px] px-6 sm:px-10">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-3xl font-medium sm:text-4xl lg:text-[46px]">
              {home.modulesTitle}
            </h2>
            <p className="mt-5 text-base leading-8 text-muted-foreground sm:text-lg sm:leading-9">
              {home.modulesDescription}
            </p>
          </div>

          <PuzzleWorkflow modules={home.productLinks} />
        </div>
      </section>

      <section className="relative isolate overflow-hidden bg-[#02040e] bg-cover bg-center bg-no-repeat py-24 [background-image:var(--app-background-image)] lg:min-h-[883px] lg:py-32">
        <div className="mx-auto max-w-[1584px] px-6 sm:px-10">
          <div className="mx-auto max-w-5xl text-center">
            <h2 className="text-3xl font-medium sm:text-4xl lg:text-[46px]">
              {home.questions.title}
            </h2>
            <p className="mt-5 text-base leading-8 text-muted-foreground sm:text-lg sm:leading-9">
              {home.questions.description}
            </p>
          </div>

          <div className="mt-40 grid justify-items-center gap-x-5 gap-y-40 md:grid-cols-3 md:gap-y-0">
            {questionCards.map((item) => (
              <LandingQuestionCard
                key={item.title}
                title={item.title}
                description={item.description}
                illustration={item.illustration}
              />
            ))}
          </div>
        </div>
      </section>

      <TeamPuzzleSection
        titleBefore={home.about.titleBefore}
        titleHighlight={home.about.titleHighlight}
        description={home.about.description}
        team={home.about.team}
      />

      <section className="relative isolate overflow-hidden bg-transparent py-16 lg:min-h-[768px] lg:py-16">
        <div className="mx-auto grid max-w-[1520px] items-center gap-16 px-6 sm:px-10 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-medium leading-tight sm:text-4xl sm:leading-[1.35] lg:text-[46px]">
              {home.finalCta.titleBefore}{" "}
              <span className="bg-[linear-gradient(90deg,#0073FF_0%,#FFFFFF_100%)] bg-clip-text font-bold text-transparent">
                {home.finalCta.titleHighlight}
              </span>{" "}
              {home.finalCta.titleHighlightRest}{" "}
              {home.finalCta.titleAfter}
            </h2>
            <p className="mt-6 text-base leading-8 text-muted-foreground sm:text-lg sm:leading-9">
              {home.finalCta.description}
            </p>
            <Button
              asChild
              size="lg"
              className="mt-9 h-12 min-w-64 rounded-lg bg-[#002BFF] px-7 text-base transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#002BFF] hover:shadow-[0px_7px_16px_0px_rgba(0,43,255,0.55)] active:translate-y-0"
            >
              <Link href={applicabilityHref}>
                <ApplicabilityCheckIcon />
                {home.selfCheckCta}
              </Link>
            </Button>
          </div>
          <AnimatedMascot />
        </div>
      </section>

      <footer className="bg-transparent">
        <div
          aria-hidden="true"
          className="mx-auto h-px w-[calc(100%_-_3rem)] max-w-[1285.5px] bg-zinc-700 sm:w-[calc(100%_-_5rem)]"
        />
        <div className="mx-auto flex max-w-[1285.5px] flex-col items-center px-6 pb-12 pt-4 text-xs text-zinc-500 sm:px-10">
          <nav
            aria-label="Rechtliche Informationen"
            className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2"
          >
            <Link className="transition-colors hover:text-zinc-300" href="/imprint">
              {home.footer.imprint}
            </Link>
            <Link className="transition-colors hover:text-zinc-300" href="/privacy">
              {home.footer.privacy}
            </Link>
            <Link className="transition-colors hover:text-zinc-300" href="/licenses.html">
              {home.footer.licenses}
            </Link>
            <Link className="transition-colors hover:text-zinc-300" href="/cookie">
              {home.footer.cookie}
            </Link>
          </nav>
          <p className="mt-2">{home.footer.copyright}</p>
        </div>
      </footer>
    </main>
  );
}

type LandingUserState = "guest" | "new-user" | "existing-user";

async function getLandingUserState(): Promise<LandingUserState> {
  if (!hasEnvVars) {
    return "guest";
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return "guest";
  }

  const [activeOrganizations, archivedOrganizations] = await Promise.all([
    listOrganizationsForUserPage({
      userId: user.id,
      status: "active",
      limit: 1,
    }),
    listOrganizationsForUserPage({
      userId: user.id,
      status: "archived",
      limit: 1,
    }),
  ]);

  return activeOrganizations.organizations.length > 0 ||
    archivedOrganizations.organizations.length > 0
    ? "existing-user"
    : "new-user";
}

function HeroLaptopPreview({
  title,
}: {
  title: string;
}) {
  return (
    <div className="relative mx-auto mt-12 w-full max-w-[680px] xl:absolute xl:left-[55%] xl:top-1/2 xl:mt-0 xl:w-[clamp(54rem,62vw,72rem)] xl:max-w-none xl:-translate-y-1/2 2xl:left-[52%]">
      <Image
        src="/images/landing/authenticated-workspace-laptop.svg"
        alt={title}
        width={1039}
        height={641}
        priority
        className="h-auto w-full max-w-none"
      />
    </div>
  );
}

function TrustPill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="relative isolate flex h-9 items-center gap-2 overflow-hidden rounded-full border border-white/50 px-4 text-sm text-white before:absolute before:inset-0 before:-z-10 before:bg-[linear-gradient(90deg,rgb(255_255_255/3%),rgb(153_153_153/18%))] before:opacity-20">
      <span className="flex shrink-0 items-center justify-center">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function ApplicabilityCheckIcon() {
  return (
    <svg
      aria-hidden="true"
      width="19"
      height="20"
      viewBox="0 0 19 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
    >
      <path
        d="M3.33268 18.3327H14.9993C15.4414 18.3327 15.8653 18.1571 16.1779 17.8445C16.4904 17.532 16.666 17.108 16.666 16.666V6.24935L12.0827 1.66602H4.99935C4.55732 1.66602 4.1334 1.84161 3.82084 2.15417C3.50828 2.46673 3.33268 2.89065 3.33268 3.33268V5.83268M11.666 1.66602V6.66602H16.666M7.49935 14.9993L6.24935 13.7493M4.16602 14.166C4.49432 14.166 4.81941 14.1014 5.12272 13.9757C5.42604 13.8501 5.70164 13.6659 5.93378 13.4338C6.16593 13.2016 6.35008 12.926 6.47571 12.6227C6.60135 12.3194 6.66602 11.9943 6.66602 11.666C6.66602 11.3377 6.60135 11.0126 6.47571 10.7093C6.35008 10.406 6.16593 10.1304 5.93378 9.89825C5.70164 9.6661 5.42604 9.48195 5.12272 9.35632C4.81941 9.23068 4.49432 9.16602 4.16602 9.16602C3.50297 9.16602 2.86709 9.42941 2.39825 9.89825C1.92941 10.3671 1.66602 11.003 1.66602 11.666C1.66602 12.3291 1.92941 12.9649 2.39825 13.4338C2.86709 13.9026 3.50297 14.166 4.16602 14.166Z"
        stroke="#FBFBFB"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LandingDashboardIcon() {
  return (
    <svg
      viewBox="0 0 17 17"
      fill="none"
      className="size-5 shrink-0"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M0.666992 0C1.03518 0 1.33398 0.298802 1.33398 0.666992V14C1.33398 14.2652 1.43942 14.5195 1.62695 14.707C1.81449 14.8946 2.06877 15 2.33398 15H15.667C16.0352 15 16.334 15.2988 16.334 15.667C16.334 16.0352 16.0352 16.334 15.667 16.334H2.33398C1.71515 16.334 1.12118 16.088 0.683594 15.6504C0.246009 15.2128 0 14.6188 0 14V0.666992C0 0.298802 0.298802 0 0.666992 0ZM4.83398 9.16699C5.20201 9.16719 5.50098 9.46592 5.50098 9.83398V12.334C5.50071 12.7018 5.20184 13.0008 4.83398 13.001C4.46596 13.001 4.16726 12.702 4.16699 12.334V9.83398C4.16699 9.46579 4.46579 9.16699 4.83398 9.16699ZM9 1.66699C9.36819 1.66699 9.66699 1.96579 9.66699 2.33398V12.334C9.66673 12.702 9.36803 13.001 9 13.001C8.63214 13.0008 8.33327 12.7018 8.33301 12.334V2.33398C8.33301 1.96592 8.63198 1.66719 9 1.66699ZM13.167 5C13.5352 5 13.834 5.2988 13.834 5.66699V12.334C13.8338 12.702 13.5351 13 13.167 13C12.7989 13 12.5002 12.702 12.5 12.334V5.66699C12.5 5.2988 12.7988 5 13.167 5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function NoItDepartmentIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
    >
      <path
        d="M8 11.3333H2.66667C2.48986 11.3333 2.32029 11.2631 2.19526 11.1381C2.07024 11.013 2 10.8435 2 10.6667V2.66667C2 2.48986 2.07024 2.32029 2.19526 2.19526C2.32029 2.07024 2.48986 2 2.66667 2H13.3333C13.5101 2 13.6797 2.07024 13.8047 2.19526C13.9298 2.32029 14 2.48986 14 2.66667V8"
        stroke="white"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M2 8.66602H10.6667" stroke="white" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.33398 14H8.00065" stroke="white" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.66732 11.334L6.33398 14.0007" stroke="white" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M11.334 12.6673C11.334 13.0209 11.4745 13.3601 11.7245 13.6101C11.9746 13.8602 12.3137 14.0007 12.6673 14.0007C13.0209 14.0007 13.3601 13.8602 13.6101 13.6101C13.8602 13.3601 14.0007 13.0209 14.0007 12.6673C14.0007 12.3137 13.8602 11.9746 13.6101 11.7245C13.3601 11.4745 13.0209 11.334 12.6673 11.334C12.3137 11.334 11.9746 11.4745 11.7245 11.7245C11.4745 11.9746 11.334 12.3137 11.334 12.6673Z"
        stroke="white"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12.668 10.334V11.334" stroke="white" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.668 14V15" stroke="white" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14.6883 11.5L13.8223 12" stroke="white" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.5132 13.334L10.6465 13.834" stroke="white" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.6465 11.5L11.5132 12" stroke="white" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.8223 13.334L14.6889 13.834" stroke="white" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DirectiveIllustration() {
  return (
    <DirectiveIllustrationInteraction>
      <FigmaCompactDocumentStack />
      <FigmaLeftDocument />
      <FigmaRightDocument />
      <FigmaCenterDocument />

      <FigmaShieldBackground />

      <div className="absolute left-1/2 top-[34px] z-40 flex size-[72px] -translate-x-1/2 translate-y-2 scale-[0.96] items-center justify-center transition-transform duration-600 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-data-[expanded=true]:-translate-y-2 group-data-[expanded=true]:scale-105 motion-reduce:transition-none">
        <FigmaLockIcon />
      </div>
    </DirectiveIllustrationInteraction>
  );
}

function FigmaCompactDocumentStack() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 z-10 opacity-100 transition-opacity duration-300 group-data-[expanded=true]:opacity-0 motion-reduce:hidden"
    >
      <div className="absolute bottom-1 left-1/2 h-[206px] w-[260px] origin-bottom -translate-x-[55%] translate-y-1 -rotate-3 rounded-[3px] border border-[#cbd6ef] bg-[#dce5ff] shadow-[0_14px_30px_rgba(15,23,42,0.16)]" />
      <div className="absolute bottom-1 left-1/2 h-[206px] w-[260px] origin-bottom -translate-x-[45%] translate-y-2 rotate-3 rounded-[3px] border border-[#dce3f2] bg-[#f1f4ff] shadow-[0_12px_26px_rgba(15,23,42,0.12)]" />
    </div>
  );
}

function FigmaLeftDocument() {
  return (
    <svg
      width="242"
      height="206"
      viewBox="0 0 242 206"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="absolute bottom-5 left-[9%] z-10 h-[206px] w-[242px] translate-x-14 scale-[0.94] opacity-0 blur-[0.5px] drop-shadow-xl transition-[transform,opacity,filter] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-data-[expanded=true]:translate-x-0 group-data-[expanded=true]:scale-100 group-data-[expanded=true]:opacity-100 group-data-[expanded=true]:blur-0 group-data-[expanded=true]:drop-shadow-2xl motion-reduce:transition-none"
      aria-hidden="true"
    >
      <rect width="214.454" height="169.18" transform="matrix(-0.983072 0.183221 0.183221 0.983072 210.823 0)" fill="white" />
      <rect width="214.454" height="13.1055" transform="matrix(-0.983072 0.183221 0.183221 0.983072 210.823 0)" fill="#E9E9E9" />
      <rect width="193.008" height="54.8048" transform="matrix(-0.983072 0.183221 0.183221 0.983072 205.741 31.2461)" fill="#A0B5FF" />
      <rect width="14.2969" height="10.7227" transform="matrix(-0.983072 0.183221 0.183221 0.983072 190.208 110.494)" fill="#6C63FE" />
      <rect width="14.2969" height="10.7227" transform="matrix(-0.983072 0.183221 0.183221 0.983072 193.052 125.717)" fill="#FE5A5A" />
      <rect width="14.2969" height="10.7227" transform="matrix(-0.983072 0.183221 0.183221 0.983072 195.89 140.943)" fill="#FF9800" />
      <rect width="98.8869" height="5.95704" transform="matrix(-0.983072 0.183221 0.183221 0.983072 157.849 118.943)" fill="#C6BFFF" />
      <rect width="98.8869" height="5.95704" transform="matrix(-0.983072 0.183221 0.183221 0.983072 160.69 134.166)" fill="#C6BFFF" />
      <rect width="98.8869" height="5.95704" transform="matrix(-0.983072 0.183221 0.183221 0.983072 163.53 149.393)" fill="#C6BFFF" />
      <circle cx="1.78711" cy="1.78711" r="1.78711" transform="matrix(-0.983072 0.183221 0.183221 0.983072 203.499 6.21484)" fill="#EB5757" />
      <circle cx="1.78711" cy="1.78711" r="1.78711" transform="matrix(-0.983072 0.183221 0.183221 0.983072 196.474 7.52344)" fill="#F2C94C" />
      <circle cx="1.78711" cy="1.78711" r="1.78711" transform="matrix(-0.983072 0.183221 0.183221 0.983072 189.446 8.83203)" fill="#3BE88B" />
    </svg>
  );
}

function FigmaRightDocument() {
  return (
    <svg
      width="242"
      height="206"
      viewBox="0 0 242 206"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="absolute bottom-5 right-[9%] z-10 h-[206px] w-[242px] -translate-x-14 scale-[0.94] opacity-0 blur-[0.5px] drop-shadow-xl transition-[transform,opacity,filter] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-data-[expanded=true]:translate-x-0 group-data-[expanded=true]:scale-100 group-data-[expanded=true]:opacity-100 group-data-[expanded=true]:blur-0 group-data-[expanded=true]:drop-shadow-2xl motion-reduce:transition-none"
      aria-hidden="true"
    >
      <g transform="rotate(10.5574 30.998 0)">
        <rect x="30.998" width="214.454" height="169.18" fill="white" />
        <rect x="30.998" width="214.454" height="13.1055" fill="#E9E9E9" />
        <rect x="36.08" y="31.2461" width="193.008" height="54.8048" fill="#A0B5FF" />
        <rect x="51.61" y="110.494" width="14.2969" height="10.7227" fill="#6C63FE" />
        <rect x="48.77" y="125.717" width="14.2969" height="10.7227" fill="#FE5A5A" />
        <rect x="45.93" y="140.943" width="14.2969" height="10.7227" fill="#FF9800" />
        <rect x="83.97" y="118.95" width="98.8869" height="5.95704" fill="#C6BFFF" />
        <rect x="81.13" y="134.17" width="98.8869" height="5.95704" fill="#C6BFFF" />
        <rect x="78.29" y="149.4" width="98.8869" height="5.95704" fill="#C6BFFF" />
        <circle cx="40.107" cy="8.001" r="1.78711" fill="#EB5757" />
        <circle cx="47.137" cy="9.307" r="1.78711" fill="#F2C94C" />
        <circle cx="54.167" cy="10.617" r="1.78711" fill="#3BE88B" />
      </g>
    </svg>
  );
}

function FigmaCenterDocument() {
  return (
    <div className="absolute -bottom-5 left-1/2 z-20 h-[271px] w-[326px] -translate-x-1/2 translate-y-3 scale-[0.97] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-data-[expanded=true]:-translate-y-1 group-data-[expanded=true]:scale-100 motion-reduce:transition-none">
      <svg
        width="326"
        height="271"
        viewBox="0 0 326 271"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0 block h-[271px] w-[326px]"
        aria-hidden="true"
      >
        <g filter="url(#directive-document-shadow)">
          <rect x="32.3789" y="28.6777" width="260.876" height="205.802" fill="white" />
          <rect x="32.3789" y="28.6777" width="260.876" height="15.9424" fill="#E9E9E9" />
          <rect x="45.4238" y="64.9102" width="234.789" height="66.6684" fill="url(#directive-document-gradient)" />
          <rect x="81.6562" y="156.219" width="17.3918" height="13.0438" fill="#A0B5FF" />
          <rect x="81.6562" y="175.059" width="17.3918" height="13.0438" fill="#002BFF" />
          <rect x="81.6562" y="193.9" width="17.3918" height="13.0438" fill="#1B1E27" />
          <rect x="122.238" y="159.113" width="120.293" height="7.24657" fill="#3D4049" />
          <rect x="122.238" y="177.955" width="120.293" height="7.24657" fill="#3D4049" />
          <rect x="122.238" y="196.797" width="120.293" height="7.24657" fill="#3D4049" />
          <circle cx="44.6994" cy="36.6505" r="2.17397" fill="#EB5757" />
          <circle cx="53.3966" cy="36.6505" r="2.17397" fill="#F2C94C" />
          <circle cx="62.0919" cy="36.6505" r="2.17397" fill="#3BE88B" />
        </g>
        <defs>
          <filter
            id="directive-document-shadow"
            x="-0.000190735"
            y="-0.000894547"
            width="325.635"
            height="270.561"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feColorMatrix
              in="SourceAlpha"
              type="matrix"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
              result="hardAlpha"
            />
            <feOffset dy="3.70047" />
            <feGaussianBlur stdDeviation="16.1895" />
            <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.15 0" />
            <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow" />
            <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
          </filter>
          <linearGradient
            id="directive-document-gradient"
            x1="36.0033"
            y1="98.2444"
            x2="261.372"
            y2="98.2444"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0.163462" stopColor="#072DE9" />
            <stop offset="1" stopColor="#0D0738" />
          </linearGradient>
        </defs>
      </svg>

      <div className="absolute left-[45.424px] top-[64.91px] h-[66.668px] w-[234.789px] overflow-hidden">
        <FinancialGraphAnimation />
      </div>
    </div>
  );
}

function FigmaLockIcon() {
  return (
    <svg
      width="72"
      height="72"
      viewBox="0 0 72 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="size-[72px]"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M17.9336 32.2824V25.1085C17.9336 20.3519 19.8232 15.7902 23.1866 12.4268C26.55 9.06337 31.1118 7.17383 35.8683 7.17383C40.6249 7.17383 45.1867 9.06337 48.5501 12.4268C51.9135 15.7902 53.803 20.3519 53.803 25.1085V32.2824C55.7057 32.2824 57.5304 33.0382 58.8757 34.3836C60.2211 35.7289 60.9769 37.5537 60.9769 39.4563V57.391C60.9769 59.2936 60.2211 61.1183 58.8757 62.4637C57.5304 63.809 55.7057 64.5649 53.803 64.5649H17.9336C16.031 64.5649 14.2063 63.809 12.8609 62.4637C11.5156 61.1183 10.7598 59.2936 10.7598 57.391V39.4563C10.7598 37.5537 11.5156 35.7289 12.8609 34.3836C14.2063 33.0382 16.031 32.2824 17.9336 32.2824ZM46.6292 25.1085V32.2824H25.1075V25.1085C25.1075 22.2546 26.2413 19.5175 28.2593 17.4995C30.2773 15.4814 33.0144 14.3477 35.8683 14.3477C38.7223 14.3477 41.4594 15.4814 43.4774 17.4995C45.4954 19.5175 46.6292 22.2546 46.6292 25.1085Z"
        fill="white"
      />
    </svg>
  );
}

function FigmaShieldBackground() {
  return (
    <div
      className="absolute left-1/2 top-0 z-30 h-[145px] w-[120px] -translate-x-1/2 translate-y-2 scale-[0.96] drop-shadow-[0_12px_20px_rgba(0,43,255,0.2)] transition-[transform,filter] duration-600 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-data-[expanded=true]:-translate-y-2 group-data-[expanded=true]:scale-105 group-data-[expanded=true]:drop-shadow-[0_20px_35px_rgba(0,43,255,0.42)] motion-reduce:transition-none"
      aria-hidden="true"
    >
      <svg
        width="120"
        height="145"
        viewBox="0 0 120 145"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0 block h-[145px] w-[120px]"
      >
        <path
          d="M59.834 0.00088501C44.5854 11.9633 23.4601 21.3623 0.229972 26.4847L0.000878642 70.3074C-0.104182 90.3586 9.21288 108.499 27.6932 124.226C39.8362 134.558 52.6033 140.969 59.0812 143.848C59.3599 143.729 59.6659 143.589 59.9667 143.458V0.101624C59.9227 0.0709534 59.8765 0.0359497 59.834 0.00088501Z"
          fill="#3778D9"
          fillOpacity="0.5"
        />
        <path
          d="M60.0664 0.000167847V144.031C66.8016 141.02 79.0429 134.799 90.7666 124.951C109.406 109.291 118.911 91.14 119.015 70.9943L119.244 26.9653C96.1394 21.6559 75.1749 12.0849 60.0664 0.000167847Z"
          fill="#3778D9"
          fillOpacity="0.5"
        />
      </svg>

      <div className="absolute left-1/2 top-0 flex h-[141px] w-[113px] -translate-x-1/2">
        <svg
          width="57"
          height="141"
          viewBox="0 0 57 141"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="block h-[141px] w-[57px] shrink-0 translate-x-px"
        >
          <path
            d="M55.9398 -0.000518799C33.3735 9.82376 21.7191 13.3709 0.000821458 18.3842L0.000821457 68.8089C-0.0974012 88.4332 8.61328 106.188 25.8909 121.579C37.2435 131.692 49.1797 137.966 55.236 140.783C55.4966 140.667 55.7827 140.53 56.0639 140.402V0.0980682C56.0227 0.0680542 55.9796 0.033783 55.9398 -0.000518799Z"
            fill="#002BFF"
          />
        </svg>
        <svg
          width="56"
          height="141"
          viewBox="0 0 56 141"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="block h-[141px] w-[56px] shrink-0 -translate-x-px"
        >
          <path
            d="M0 -0.000732422V140.303C6.29823 137.369 17.7453 131.31 28.7083 121.716C46.1383 106.462 55.0263 88.7804 55.1236 69.1561V16.7965C33.1381 12.3302 10.2483 4.70024 0 -0.000732422Z"
            fill="#002BFF"
          />
        </svg>
      </div>
    </div>
  );
}

function FinancialGraphAnimation() {
  const [startPath, endPath] = financialGraphPaths;

  return (
    <svg
      viewBox="-700 -340 1400 860"
      fill="none"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-80 transition-opacity duration-300 group-hover:opacity-100"
    >
      <path
        d={startPath}
        pathLength="1"
        stroke="rgba(0,115,255,0.22)"
        strokeWidth="30"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="0.3 1"
      >
        <animate
          attributeName="d"
          values={`${startPath};${endPath};${startPath}`}
          dur="2.6s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="stroke-dasharray"
          values="0.3 1;0.71 0.29;0.3 1"
          dur="2.6s"
          repeatCount="indefinite"
        />
      </path>
      <path
        d={startPath}
        pathLength="1"
        stroke="#0073FF"
        strokeWidth="11"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="0.3 1"
      >
        <animate
          attributeName="d"
          values={`${startPath};${endPath};${startPath}`}
          dur="2.6s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="stroke-dasharray"
          values="0.3 1;0.71 0.29;0.3 1"
          dur="2.6s"
          repeatCount="indefinite"
        />
      </path>
    </svg>
  );
}

function lottieShapeToPath(shape: LottieShape) {
  const [firstVertex] = shape.v;
  let path = `M ${firstVertex[0]} ${firstVertex[1]}`;

  for (let index = 1; index < shape.v.length; index += 1) {
    const previousVertex = shape.v[index - 1];
    const currentVertex = shape.v[index];
    const previousOutTangent = shape.o[index - 1];
    const currentInTangent = shape.i[index];

    path += ` C ${previousVertex[0] + previousOutTangent[0]} ${
      previousVertex[1] + previousOutTangent[1]
    } ${currentVertex[0] + currentInTangent[0]} ${
      currentVertex[1] + currentInTangent[1]
    } ${currentVertex[0]} ${currentVertex[1]}`;
  }

  return shape.c ? `${path} Z` : path;
}

function ProductPreview({
  title,
  playLabel,
  fallback,
}: {
  title: string;
  playLabel: string;
  fallback: string;
}) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-white/15 bg-[#151821] shadow-[0_30px_90px_rgb(0_0_0/0.5)]">
      <div className="flex items-center gap-2 border-b border-white/10 bg-[#242833] px-5 py-4">
        <span className="size-3 rounded-full bg-[#ef6674]" />
        <span className="size-3 rounded-full bg-[#f1bd5b]" />
        <span className="size-3 rounded-full bg-[#55c889]" />
      </div>
      <div className="bg-[#02040E]">
        <ProductVideo title={title} playLabel={playLabel} fallback={fallback} />
      </div>
    </div>
  );
}

function PuzzleWorkflow({
  modules,
}: {
  modules: ReadonlyArray<{ label: string; description: string }>;
}) {
  const pieceAnimationClass =
    "-translate-x-16 opacity-0 transition-[opacity,translate] duration-700 ease-out group-data-[revealed=true]:translate-x-0 group-data-[revealed=true]:opacity-100 motion-reduce:translate-x-0 motion-reduce:opacity-100 motion-reduce:transition-none";

  return (
    <PuzzleWorkflowReveal>
      <div className="mt-14 overflow-x-auto pb-4">
        <div className="mx-auto w-full min-w-[760px] max-w-[1380px]">
          <div className="grid grid-cols-4">
          {modules.map((module, index) => (
            <h3
              key={module.label}
              className="-translate-x-5 px-3 pb-4 text-center text-sm font-bold text-white opacity-0 transition-[opacity,translate] duration-500 ease-out group-data-[revealed=true]:translate-x-0 group-data-[revealed=true]:opacity-100 motion-reduce:translate-x-0 motion-reduce:opacity-100 motion-reduce:transition-none lg:text-base"
              style={{ transitionDelay: `${index * 320}ms` }}
            >
              {module.label}
            </h3>
          ))}
          </div>

        <div className="relative aspect-[4.988] w-full">
          <svg
            aria-hidden="true"
            viewBox="0 0 1297 260"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="absolute inset-0 size-full"
          >
            <path
              className={pieceAnimationClass}
              style={{ transitionDelay: "80ms" }}
              d="M1.5 1.5H324.95V89.4851C337.037 89.4851 348.63 93.6498 357.177 101.063C365.725 108.476 370.527 118.531 370.527 129.015C370.527 139.499 365.725 149.553 357.177 156.966C348.63 164.38 337.037 168.544 324.95 168.544V256.529H1.5V1.5Z"
              fill="#E8F1FF"
              stroke="#3D4049"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              className={pieceAnimationClass}
              style={{ transitionDelay: "400ms" }}
              d="M1.5 1.5H324.95V89.4851C337.037 89.4851 348.63 93.6498 357.177 101.063C365.725 108.476 370.527 118.531 370.527 129.015C370.527 139.499 365.725 149.553 357.177 156.966C348.63 164.38 337.037 168.544 324.95 168.544V256.529H1.5V168.544C13.5878 168.544 25.1805 164.38 33.7278 156.966C42.2751 149.553 47.077 139.499 47.077 129.015C47.077 118.531 42.2751 108.476 33.7278 101.063C25.1805 93.6498 13.5878 89.4851 1.5 89.4851L1.5 1.5Z"
              transform="translate(323.45)"
              fill="#A0B5FF"
              stroke="#3D4049"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              className={pieceAnimationClass}
              style={{ transitionDelay: "720ms" }}
              d="M1.5 1.5H324.95V89.4851C312.862 89.4851 301.269 93.6498 292.722 101.063C284.174 108.476 279.373 118.531 279.373 129.015C279.373 139.499 284.174 149.553 292.722 156.966C301.269 164.38 312.862 168.544 324.95 168.544V256.529H1.5V168.544C13.5878 168.544 25.1805 164.38 33.7278 156.966C42.2751 149.553 47.077 139.499 47.077 129.015C47.077 118.531 42.2751 108.476 33.7278 101.063C25.1805 93.6498 13.5878 89.4851 1.5 89.4851L1.5 1.5Z"
              transform="translate(646.9)"
              fill="#0739FF"
              stroke="#3D4049"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              className={pieceAnimationClass}
              style={{ transitionDelay: "1040ms" }}
              d="M369.906 257.703L46.4595 256.527L46.8849 168.542C34.7973 168.498 23.2249 164.291 14.7134 156.847C6.202 149.403 1.4488 139.331 1.4995 128.847C1.55019 118.363 6.40063 108.326 14.9838 100.944C23.5669 93.5623 35.1796 89.4398 47.2673 89.4838L47.6927 1.4994L371.139 2.67597L369.906 257.703Z"
              transform="translate(924.157)"
              fill="#9098AC"
              stroke="#3D4049"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            <svg
              x="95"
              y="56"
              width="135"
              height="148"
              viewBox="0 0 135 148"
              className={pieceAnimationClass}
              style={{ transitionDelay: "80ms" }}
            >
              <path
                d="M19.2363 142.117H115.486C119.133 142.117 122.63 140.678 125.209 138.116C127.788 135.553 129.236 132.078 129.236 128.454V43.0599L91.4238 5.48633H32.9863C29.3396 5.48633 25.8422 6.92583 23.2636 9.48816C20.685 12.0505 19.2363 15.5257 19.2363 19.1494V39.6441M87.9863 5.48633V46.4756H129.236M53.6113 114.791L43.2988 104.544M26.1113 107.96C28.8198 107.96 31.5018 107.429 34.0042 106.4C36.5065 105.37 38.7802 103.86 40.6954 101.957C42.6106 100.054 44.1298 97.7944 45.1663 95.3079C46.2028 92.8214 46.7363 90.1563 46.7363 87.4649C46.7363 84.7735 46.2028 82.1085 45.1663 79.622C44.1298 77.1354 42.6106 74.8761 40.6954 72.973C38.7802 71.0699 36.5065 69.5603 34.0042 68.5303C31.5018 67.5004 28.8198 66.9703 26.1113 66.9703C20.6412 66.9703 15.3952 69.1295 11.5273 72.973C7.65931 76.8165 5.48633 82.0294 5.48633 87.4649C5.48633 92.9005 7.65931 98.1134 11.5273 101.957C15.3952 105.8 20.6412 107.96 26.1113 107.96Z"
                stroke="#002BFF"
                strokeWidth="10.9725"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            <svg
              x="393"
              y="37"
              width="185"
              height="185"
              viewBox="0 0 185 185"
              className={pieceAnimationClass}
              style={{ transitionDelay: "400ms" }}
            >
              <path
                d="M161.875 115.625V146.458C161.875 150.547 160.251 154.468 157.36 157.36C154.468 160.251 150.547 161.875 146.458 161.875H38.5417C34.4529 161.875 30.5316 160.251 27.6404 157.36C24.7493 154.468 23.125 150.547 23.125 146.458V115.625"
                stroke="#FBFBFB"
                strokeWidth="12.3025"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M131.048 61.6667L92.5065 23.125L53.9648 61.6667"
                stroke="#FBFBFB"
                strokeWidth="12.3025"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M92.5 23.125V115.625"
                stroke="#FBFBFB"
                strokeWidth="12.3025"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            <svg
              x="719"
              y="40"
              width="180"
              height="180"
              viewBox="0 0 180 180"
              className={pieceAnimationClass}
              style={{ transitionDelay: "720ms" }}
            >
              <path
                d="M168 54L104.25 117.75L66.75 80.25L18 129M168 99V54H123"
                stroke="#FBFBFB"
                strokeWidth="11.97"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            <svg
              x="1040"
              y="36"
              width="188"
              height="187"
              viewBox="0 0 188 187"
              className={pieceAnimationClass}
              style={{ transitionDelay: "1040ms" }}
            >
              <path
                d="M93.9996 67.252V93.4056M93.9996 119.559H94.0701M93.9996 158.79C93.9996 158.79 150.4 132.636 150.4 93.4056V47.6367L93.9996 28.0215L37.5996 47.6367V93.4056C37.5996 132.636 93.9996 158.79 93.9996 158.79Z"
                stroke="#FBFBFB"
                strokeWidth="12.502"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </svg>
        </div>

          <div className="mt-5 grid grid-cols-4">
          {modules.map((module, index) => (
            <p
              key={module.label}
              className="mx-auto max-w-[240px] -translate-x-5 px-4 text-center text-xs leading-5 text-white/85 opacity-0 transition-[opacity,translate] duration-500 ease-out group-data-[revealed=true]:translate-x-0 group-data-[revealed=true]:opacity-100 motion-reduce:translate-x-0 motion-reduce:opacity-100 motion-reduce:transition-none lg:text-sm lg:leading-6"
              style={{ transitionDelay: `${index * 320 + 160}ms` }}
            >
              {module.description}
            </p>
          ))}
          </div>
        </div>
      </div>
    </PuzzleWorkflowReveal>
  );
}

function HomeFallback() {
  return <main className="min-h-screen bg-transparent" />;
}
