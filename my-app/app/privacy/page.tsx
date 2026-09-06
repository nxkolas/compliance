import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthButton } from "@/components/auth-button";
import { BrandLogo } from "@/components/brand-logo";
import { PageHeader } from "@/components/page-header";
import { PublicLanguageSwitcher } from "@/components/public-language-switcher";
import { getDictionary, type Dictionary } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import { listOrganizationsForUserPage } from "@/src/server/organizations/service";

const privacyEmail = "complyx.de@gmail.com";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getDictionary();

  return {
    title: dictionary.legal.privacy.metadataTitle,
    description: dictionary.legal.privacy.metadataDescription,
  };
}

export default async function PrivacyPage() {
  const dictionary = await getDictionary();
  const viewer = await getPrivacyViewer();

  if (viewer) {
    return (
      <AppShell
        dictionary={dictionary}
        organizationId={viewer.organizationId}
      >
        <PrivacyDocument privacy={dictionary.legal.privacy} shell="app" />
      </AppShell>
    );
  }

  return (
    <PublicPrivacyShell dictionary={dictionary}>
      <PrivacyDocument privacy={dictionary.legal.privacy} shell="public" />
    </PublicPrivacyShell>
  );
}

async function getPrivacyViewer() {
  if (!hasEnvVars) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const organizations = await listOrganizationsForUserPage({
    userId: user.id,
    status: "active",
    limit: 1,
  });

  return { organizationId: organizations.organizations[0]?.id };
}

function PublicPrivacyShell({
  dictionary,
  children,
}: {
  dictionary: Dictionary;
  children: ReactNode;
}) {
  const home = dictionary.home;

  return (
    <main className="dark min-h-screen overflow-x-hidden bg-[#02040E] text-white">
      <header className="dark fixed inset-x-0 top-0 z-40 h-32 bg-[#02040E]/25 text-white backdrop-blur-md sm:h-28">
        <div className="relative mx-auto flex h-full max-w-[1728px] items-start gap-8 px-4 pt-4 pb-14 sm:items-center sm:px-10 sm:py-0 lg:px-12 xl:px-[72px]">
          <Link href="/" aria-label={home.brand} className="shrink-0">
            <BrandLogo
              alt={home.brand}
              width={203}
              height={66}
              priority
              className="h-auto w-28 sm:w-44 lg:w-[203px]"
            />
          </Link>

          <nav className="ml-auto hidden items-center gap-8 text-base font-medium text-white lg:flex">
            <Link className="transition-colors hover:text-white/75" href="/#nis2">
              {home.navigation.nis2}
            </Link>
            <Link className="transition-colors hover:text-white/75" href="/#about">
              {home.navigation.about}
            </Link>
          </nav>

          <div className="absolute top-3 right-4 z-10 flex flex-col items-end gap-3 text-sm xl:static xl:flex-row xl:items-center xl:gap-2">
            <PublicLanguageSwitcher
              showThemeSwitcher
              compactOnMobile
              inline
              className="order-1 xl:order-2"
            />
            <div className="order-2 xl:order-1">
              {hasEnvVars ? (
                <Suspense fallback={<div className="h-10 w-48" />}>
                  <AuthButton />
                </Suspense>
              ) : (
                <p className="text-xs text-white/60 sm:text-sm">
                  {dictionary.common.supabaseMissing}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>
      <div aria-hidden="true" className="h-32 sm:h-28" />
      <div className="mx-auto w-full max-w-[1728px] px-4 pt-8 pb-16 sm:px-10 sm:pt-12 lg:px-12 xl:px-[72px]">
        {children}
      </div>
    </main>
  );
}

function PrivacyDocument({
  privacy,
  shell,
}: {
  privacy: Dictionary["legal"]["privacy"];
  shell: "app" | "public";
}) {
  return (
    <section
      data-privacy-page
      data-privacy-shell={shell}
      className="flex w-full min-w-0 flex-col"
    >
      <PageHeader
        title={privacy.title}
        subtitle={privacy.introduction}
        className="w-full [&>p]:max-w-[1130px]"
      />

      <article className="mt-12 w-full overflow-hidden rounded-xl border-[1.5px] border-[#3D4049] bg-[#1B1E27] text-white shadow-[0px_1px_2px_-1px_rgba(0,0,0,0.10),0px_1px_3px_0px_rgba(0,0,0,0.10)] sm:mt-16">
        {privacy.sections.map((section) => (
          <section
            key={section.title}
            className="border-b border-[#3D4049] px-6 py-9 last:border-b-0 sm:px-10 lg:px-12"
          >
            <h2 className="text-xl leading-8 font-bold text-white sm:text-2xl">
              {section.title}
            </h2>
            <div className="mt-4 max-w-[1096px] space-y-4 text-sm leading-6 font-normal text-white/90 sm:text-base sm:leading-7">
              {section.blocks.map((block, index) => (
                <PrivacyBlock key={`${section.title}-${index}`} block={block} />
              ))}
            </div>
          </section>
        ))}
      </article>
    </section>
  );
}

type PrivacyBlockData =
  Dictionary["legal"]["privacy"]["sections"][number]["blocks"][number];

function PrivacyBlock({ block }: { block: PrivacyBlockData }) {
  if (block.type === "list") {
    return (
      <ul className="list-disc space-y-1 pl-6 marker:text-white/75">
        {block.items.map((item) => (
          <li key={item}>{renderEmailLink(item)}</li>
        ))}
      </ul>
    );
  }

  if (block.type === "lines") {
    return (
      <p>
        {block.items.map((item) => (
          <span key={item} className="block">
            {renderEmailLink(item)}
          </span>
        ))}
      </p>
    );
  }

  if (block.type === "subheading") {
    return (
      <h3 className="pt-2 text-base leading-7 font-bold text-white sm:text-lg">
        {renderEmailLink(block.text)}
      </h3>
    );
  }

  if (block.type === "strong") {
    return <p className="font-bold text-white">{renderEmailLink(block.text)}</p>;
  }

  return <p>{renderEmailLink(block.text)}</p>;
}

function renderEmailLink(text: string) {
  return text.split(privacyEmail).map((part, index, parts) => (
    <span key={`${index}-${part}`}>
      {part}
      {index < parts.length - 1 ? (
        <a
          href={`mailto:${privacyEmail}`}
          className="font-semibold text-white underline decoration-white/40 underline-offset-4 transition-colors hover:text-white/75"
        >
          {privacyEmail}
        </a>
      ) : null}
    </span>
  ));
}
