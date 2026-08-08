import { PageHeader } from "@/components/page-header";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

describe("PageHeader", () => {
  it("uses the brand blue for page descriptions in light mode", () => {
    const html = renderToStaticMarkup(
      <PageHeader title="Gap-Analyse" subtitle="Beschreibung" />,
    );

    expect(html).toContain("text-[#002BFF]");
    expect(html).toContain("dark:text-info-foreground");
  });
});
