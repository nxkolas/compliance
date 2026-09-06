import type { Metadata } from "next";
import { Fragment } from "react";
import { LicenseFilters } from "@/components/license-filters";
import { PublicPageShell } from "@/components/public-page-shell";
import licenseData from "@/src/generated/third-party-licenses.json";
import { getDictionary, getLocale, type Dictionary } from "@/src/i18n";
import { formatDate, formatNumber } from "@/src/i18n/format";

type LicensePackage = {
  name: string;
  version: string;
  license: string;
  repository?: string;
  publisher?: string;
  licenseText?: string;
  licenseSource?: string;
  noticeText?: string;
};

const generated = licenseData as {
  generatedAt: string;
  packages: LicensePackage[];
};

export async function generateMetadata(): Promise<Metadata> {
  const labels = (await getDictionary()).legal.licenses;

  return {
    title: labels.metadataTitle,
    description: labels.metadataDescription,
    robots: { index: false, follow: false },
  };
}

export default async function LicensesPage() {
  const [dictionary, locale] = await Promise.all([getDictionary(), getLocale()]);
  const labels = dictionary.legal.licenses;
  const licenseCounts = new Map<string, number>();

  for (const item of generated.packages) {
    licenseCounts.set(item.license, (licenseCounts.get(item.license) ?? 0) + 1);
  }

  const licenses = [...licenseCounts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  const introduction = labels.introduction
    .replace("{count}", formatNumber(generated.packages.length, locale))
    .replace("{date}", formatDate(generated.generatedAt, locale));

  return (
    <PublicPageShell dictionary={dictionary}>
      <section className="relative isolate overflow-hidden pt-14 pb-16 sm:pb-24">
        <div className="mx-auto max-w-[1728px] px-6 sm:px-10 lg:px-12 xl:px-[72px]">
          <header className="max-w-[1432px]">
            <h1 className="text-3xl leading-tight font-bold tracking-tight text-white sm:text-4xl">
              {labels.title}
            </h1>
            <p className="mt-4 text-base leading-7 font-normal text-white/80 sm:text-lg">
              {introduction}
            </p>
          </header>

          <LicenseFilters
            packageCount={generated.packages.length}
            licenses={licenses}
            labels={labels}
          />

          <article className="mt-4 overflow-hidden rounded-xl border-[1.5px] border-[#3D4049] bg-[#1B1E27] shadow-sm">
            <div>
              {generated.packages.map((item) => (
                <LicenseEntry key={`${item.name}@${item.version}`} item={item} labels={labels} />
              ))}
            </div>
          </article>
        </div>
      </section>
    </PublicPageShell>
  );
}

function LicenseEntry({
  item,
  labels,
}: {
  item: LicensePackage;
  labels: Dictionary["legal"]["licenses"];
}) {
  const metadata = [
    item.repository ? { href: item.repository, label: item.repository } : null,
    item.licenseSource ? { label: item.licenseSource } : null,
  ].filter((entry): entry is { label: string; href?: string } => Boolean(entry));
  const search = [item.name, item.version, item.license, item.publisher ?? ""]
    .join(" ")
    .toLowerCase();

  return (
    <details
      data-license-package
      data-license={item.license}
      data-search={search}
      className="group border-b border-[#3D4049] last:border-b-0"
    >
      <summary className="flex cursor-pointer items-baseline gap-2.5 px-4 py-5 transition-colors marker:text-muted-foreground hover:bg-[#161922] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary group-open:bg-[#161922] sm:px-6">
        <span className="font-semibold text-white">{item.name}</span>
        <span className="text-sm text-muted-foreground">{item.version}</span>
        {item.publisher ? (
          <span className="text-sm text-muted-foreground max-sm:basis-full">{item.publisher}</span>
        ) : null}
        <span className="ml-auto rounded-full border border-[#3159FF] bg-[#18275D] px-2.5 py-0.5 text-xs whitespace-nowrap text-[#C2CCFF]">
          {item.license}
        </span>
      </summary>

      <div className="px-4 pb-6 sm:px-6">
        {metadata.length > 0 ? (
          <p className="mb-3 break-words text-sm text-muted-foreground">
            {metadata.map((entry, index) => (
              <Fragment key={entry.label}>
                {index > 0 ? " · " : null}
                {entry.href ? (
                  <a
                    href={entry.href}
                    rel="noopener noreferrer"
                    className="text-info-foreground underline underline-offset-4"
                  >
                    {entry.label}
                  </a>
                ) : (
                  entry.label
                )}
              </Fragment>
            ))}
          </p>
        ) : null}

        {item.licenseText ? (
          <LicenseText>{item.licenseText}</LicenseText>
        ) : (
          <p className="italic text-muted-foreground">
            {labels.missingLicense.replace("{license}", item.license)}
          </p>
        )}

        {item.noticeText ? (
          <>
            <h2 className="mt-4 mb-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {labels.notice}
            </h2>
            <LicenseText>{item.noticeText}</LicenseText>
          </>
        ) : null}
      </div>
    </details>
  );
}

function LicenseText({ children }: { children: string }) {
  return (
    <pre className="max-h-[36rem] overflow-auto rounded-lg border border-border bg-[#11172A] p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-white/90">
      {children}
    </pre>
  );
}
