import { AuthButton } from "@/components/auth-button";
import { BrandLogo } from "@/components/brand-logo";
import { PublicLanguageSwitcher } from "@/components/public-language-switcher";
import { getDictionary } from "@/lib/i18n";
import { hasEnvVars } from "@/lib/utils";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getDictionary();

  return {
    title: dictionary.legal.imprint.metadataTitle,
    description: dictionary.legal.imprint.metadataDescription,
  };
}

export default async function ImprintPage() {
  const dictionary = await getDictionary();
  const home = dictionary.home;
  const imprint = dictionary.legal.imprint;
  const websiteUrl = process.env.APP_PUBLIC_URL ?? "http://localhost:3000";
  const websiteDisplay = websiteUrl
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");

  return (
    <div className="min-h-screen bg-transparent text-white">
      <Suspense fallback={null}>
        <PublicLanguageSwitcher showThemeSwitcher />
      </Suspense>

      <main className="dark min-h-screen overflow-hidden bg-transparent text-white">
        <header className="dark fixed inset-x-0 top-0 z-40 h-28 bg-[#02040E]/25 text-white backdrop-blur-md">
          <div className="relative mx-auto flex h-full max-w-[1728px] items-start gap-8 px-6 pb-14 pt-4 sm:items-center sm:px-10 sm:py-0 lg:px-12 xl:px-[72px]">
            <Link href="/" aria-label={home.brand} className="shrink-0">
              <BrandLogo
                alt={home.brand}
                width={203}
                height={66}
                priority
                className="h-auto w-36 sm:w-44 lg:w-[203px]"
              />
            </Link>

            <nav className="ml-auto hidden items-center gap-8 font-sans text-base font-medium text-white lg:flex">
              <Link
                className="transition-all duration-200 hover:text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.70)]"
                href="/#nis2"
              >
                {home.navigation.nis2}
              </Link>
              <Link
                className="transition-all duration-200 hover:text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.70)]"
                href="/#about"
              >
                {home.navigation.about}
              </Link>
            </nav>

            <div className="absolute bottom-3 right-4 text-sm sm:static sm:mr-32">
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
        <div aria-hidden="true" className="h-28" />

        <section className="relative isolate overflow-hidden pb-16 pt-14 sm:pb-24">
          <div className="mx-auto max-w-[1728px] px-6 sm:px-10 lg:px-12 xl:px-[72px]">
            <header className="max-w-[1432px]">
              <h1 className="text-4xl font-bold leading-9 tracking-tight text-white">
                {imprint.title}
              </h1>
              <p className="mt-4 text-base font-normal leading-7 text-white/80 sm:text-lg">
                {imprint.introduction}
              </p>
            </header>

            <article className="mt-16 overflow-hidden rounded-xl border-[1.5px] border-[#3D4049] bg-[#1B1E27] shadow-sm">
              <ImprintSection title={imprint.provider.title}>
                <p className="font-bold">{imprint.provider.teamName}</p>
                <div className="mt-1">
                  {imprint.provider.members.map((member) => (
                    <p key={member}>{member}</p>
                  ))}
                </div>
                <address className="mt-6 not-italic">
                  {imprint.provider.institution}
                  <br />
                  {imprint.provider.street}
                  <br />
                  {imprint.provider.city}
                </address>
              </ImprintSection>

              <ImprintSection title={imprint.contact.title}>
                <p>
                  <span className="font-bold">
                    {imprint.contact.emailLabel}{" "}
                  </span>
                  <a
                    href="mailto:complyxx@gmail.com"
                    className="underline decoration-white/40 underline-offset-4 transition-colors hover:text-white/75"
                  >
                    {imprint.contact.email}
                  </a>
                  <br />
                  <span className="font-bold">
                    {imprint.contact.phoneLabel}{" "}
                  </span>
                  <a
                    href="tel:+4915208198263"
                    className="underline decoration-white/40 underline-offset-4 transition-colors hover:text-white/75"
                  >
                    {imprint.contact.phone}
                  </a>
                  <br />
                  <span className="font-bold">
                    {imprint.contact.websiteLabel}{" "}
                  </span>
                  <a
                    href={websiteUrl}
                    className="underline decoration-white/40 underline-offset-4 transition-colors hover:text-white/75"
                  >
                    {websiteDisplay}
                  </a>
                </p>
              </ImprintSection>

              <ImprintSection title={imprint.project.title}>
                <TextLines items={imprint.project.paragraphs} />
              </ImprintSection>

              <ImprintSection title={imprint.usage.title}>
                <TextLines items={imprint.usage.paragraphs} />
              </ImprintSection>

              <ImprintSection title={imprint.liability.title}>
                <TextLines items={imprint.liability.paragraphs} />
              </ImprintSection>
            </article>
          </div>
        </section>

        <footer className="bg-transparent">
          <div
            aria-hidden="true"
            className="mx-auto h-px w-[calc(100%_-_3rem)] max-w-[1285.5px] bg-zinc-700 sm:w-[calc(100%_-_5rem)]"
          />
          <div className="mx-auto flex max-w-[1285.5px] flex-col items-center px-6 pb-12 pt-4 text-xs text-zinc-500 sm:px-10">
            <nav
              aria-label={dictionary.legal.footerNavigationLabel}
              className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2"
            >
              <Link
                className="font-bold text-zinc-400 transition-colors hover:text-zinc-300"
                href="/imprint"
                aria-current="page"
              >
                {home.footer.imprint}
              </Link>
              <Link
                className="transition-colors hover:text-zinc-300"
                href="/privacy"
              >
                {home.footer.privacy}
              </Link>
              <Link
                className="transition-colors hover:text-zinc-300"
                href="/licenses.html"
              >
                {home.footer.licenses}
              </Link>
              <Link
                className="transition-colors hover:text-zinc-300"
                href="/cookie"
              >
                {home.footer.cookie}
              </Link>
            </nav>
            <p className="mt-2">{home.footer.copyright}</p>
          </div>
        </footer>
      </main>
    </div>
  );
}

function ImprintSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-[#3D4049] px-6 py-9 last:border-b-0 sm:px-12 lg:px-16">
      <h2 className="text-2xl font-bold text-white">{title}</h2>
      <div className="mt-4 max-w-[1412px] text-base font-normal leading-7 text-white/90">
        {children}
      </div>
    </section>
  );
}

function TextLines({ items }: { items: readonly string[] }) {
  return (
    <p>
      {items.map((line) => (
        <span key={line} className="block">
          {line}
        </span>
      ))}
    </p>
  );
}
