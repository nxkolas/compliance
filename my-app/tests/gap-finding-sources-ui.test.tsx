import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GapFindingSources } from "@/components/gap-analysis/gap-finding-sources";
import { modulesMessages } from "@/lib/i18n/messages/modules";
import type { GapFindingSource } from "@/src/server/gap-analysis/finding-source-projection";

const sources: GapFindingSource[] = [
  {
    kind: "document",
    key: "document:1",
    label: "A very long organization security policy title",
    href: "/api/organizations/org/document-versions/version/source-access?mode=inline&page=2",
    available: true,
    pageNumbers: [2, 8],
    sectionLabels: ["Access control"],
  },
  {
    kind: "legal",
    key: "legal:1",
    label: "NIS2 Directive",
    href: "https://example.test/nis2",
    available: true,
    pageNumbers: [10],
    sectionLabels: ["Article 21"],
  },
  {
    kind: "assessment",
    key: "assessment",
    label: "Your information",
    href: null,
    available: true,
    pageNumbers: [],
    sectionLabels: [],
  },
  {
    kind: "legal",
    key: "legal:2",
    label: "Unavailable official source",
    href: null,
    available: false,
    pageNumbers: [],
    sectionLabels: [],
  },
  {
    kind: "document",
    key: "document:2",
    label: "Business continuity plan",
    href: "/api/source-2",
    available: true,
    pageNumbers: [],
    sectionLabels: [],
  },
];

describe("compact Gap finding sources", () => {
  it("renders safe links, non-link questionnaire support, locations, and +N", () => {
    const html = renderToStaticMarkup(
      <GapFindingSources
        sources={sources}
        labels={modulesMessages.en.modules.gapAnalysis.workflow}
      />,
    );

    expect(html).toContain("Sources");
    expect(html).toContain("A very long organization security policy title");
    expect(html).toContain("Pages 2, 8");
    expect(html).toContain("Section Access control");
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('role="note"');
    expect(html).toContain("Your information");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain(">+2</button>");
    expect(html).not.toContain("Unavailable official source");
    expect(html).not.toContain("SOURCE_EXCERPT_SENTINEL");
  });

  it.each([
    ["de", "Quellen", "Keine Quellen verknüpft"],
    ["en", "Sources", "No sources linked"],
  ] as const)("renders the explicit empty state in %s", (locale, heading, empty) => {
    const html = renderToStaticMarkup(
      <GapFindingSources
        sources={[]}
        labels={modulesMessages[locale].modules.gapAnalysis.workflow}
      />,
    );

    expect(html).toContain(heading);
    expect(html).toContain(empty);
  });

  it("explains an unavailable legal source without making it a link", () => {
    const html = renderToStaticMarkup(
      <GapFindingSources
        sources={[sources[3]!]}
        labels={modulesMessages.en.modules.gapAnalysis.workflow}
      />,
    );

    expect(html).toContain("Unavailable official source");
    expect(html).toContain("This source is currently unavailable.");
    expect(html).toContain('role="note"');
    expect(html).not.toContain("<a");
  });
});
