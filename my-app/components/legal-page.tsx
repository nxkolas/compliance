import { PublicPageShell } from "@/components/public-page-shell";
import type { Dictionary } from "@/src/i18n";

const privacyEmail = "complyx.de@gmail.com";

type LegalBlock =
  | { readonly type: "paragraph" | "subheading" | "strong"; readonly text: string }
  | { readonly type: "list" | "lines"; readonly items: readonly string[] };

type LegalDocumentContent = {
  readonly title: string;
  readonly introduction: string;
  readonly sections: readonly {
    readonly title: string;
    readonly blocks: readonly LegalBlock[];
  }[];
};

export function LegalPage({
  dictionary,
  document,
  page,
}: {
  dictionary: Dictionary;
  document: LegalDocumentContent;
  page: "privacy" | "cookie";
}) {
  return (
    <PublicPageShell dictionary={dictionary}>
      <section className="relative isolate overflow-hidden pt-14 pb-16 sm:pb-24">
        <div className="mx-auto max-w-[1728px] px-6 sm:px-10 lg:px-12 xl:px-[72px]">
          <LegalDocument document={document} page={page} />
        </div>
      </section>
    </PublicPageShell>
  );
}

export function LegalDocument({
  document,
  page,
}: {
  document: LegalDocumentContent;
  page: "privacy" | "cookie";
}) {
  return (
    <section
      data-legal-page={page}
      data-legal-shell="public"
      className="flex w-full min-w-0 flex-col"
    >
      <header className="max-w-[1432px]">
        <h1 className="text-3xl leading-tight font-bold tracking-tight text-white sm:text-4xl">
          {document.title}
        </h1>
        <p className="mt-4 text-base leading-7 font-normal text-white/80 sm:text-lg">
          {document.introduction}
        </p>
      </header>

      <article className="mt-12 w-full overflow-hidden rounded-xl border-[1.5px] border-[#3D4049] bg-[#1B1E27] text-white shadow-[0px_1px_2px_-1px_rgba(0,0,0,0.10),0px_1px_3px_0px_rgba(0,0,0,0.10)] sm:mt-16">
        {document.sections.map((section) => (
          <section
            key={section.title}
            className="border-b border-[#3D4049] px-6 py-9 last:border-b-0 sm:px-10 lg:px-12"
          >
            <h2 className="text-xl leading-8 font-bold text-white sm:text-2xl">
              {section.title}
            </h2>
            <div className="mt-4 max-w-[1096px] space-y-4 text-sm leading-6 font-normal text-white/90 sm:text-base sm:leading-7">
              {section.blocks.map((block, index) => (
                <LegalBlock key={`${section.title}-${index}`} block={block} />
              ))}
            </div>
          </section>
        ))}
      </article>
    </section>
  );
}

function LegalBlock({ block }: { block: LegalBlock }) {
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

  if (block.type === "paragraph") {
    return <p>{renderEmailLink(block.text)}</p>;
  }

  return null;
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
