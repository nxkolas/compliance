import { PublicPageShell } from "@/components/public-page-shell";
import { getDictionary } from "@/src/i18n";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getDictionary();

  return {
    title: dictionary.legal.imprint.metadataTitle,
    description: dictionary.legal.imprint.metadataDescription,
  };
}

export default async function ImprintPage() {
  const dictionary = await getDictionary();
  const imprint = dictionary.legal.imprint;
  const websiteUrl = process.env.APP_PUBLIC_URL ?? "http://localhost:3000";
  const websiteDisplay = websiteUrl
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");

  return (
    <PublicPageShell dictionary={dictionary}>
      <section className="relative isolate overflow-hidden pt-14 pb-16 sm:pb-24">
          <div className="mx-auto max-w-[1728px] px-6 sm:px-10 lg:px-12 xl:px-[72px]">
            <header className="max-w-[1432px]">
              <h1 className="text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
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
    </PublicPageShell>
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
