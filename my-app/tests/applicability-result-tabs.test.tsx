import { ApplicabilityResultTabs } from "@/components/applicability-check/applicability-result-tabs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

describe("ApplicabilityResultTabs", () => {
  it.each([
    ["overview", "/result"],
    ["answers", "/answers"],
  ] as const)("marks the %s view as active", (activeView, activePath) => {
    const html = renderToStaticMarkup(
      <ApplicabilityResultTabs
        activeView={activeView}
        answersLabel="Antworten"
        baseHref="/tool/organizations/example/applicability-check"
        locale="de"
        overviewLabel="Übersicht"
      />,
    );

    expect(html).toContain('class="max-w-full overflow-x-auto"');
    expect(html).toContain("inline-flex h-12 min-w-max");
    expect(html).toContain("h-12 w-36 shrink-0 border-b-2 border-transparent");
    expect(html).toMatch(
      new RegExp(
        `<a[^>]*aria-current="page"[^>]*href="/tool/organizations/example/applicability-check${activePath}"`,
      ),
    );
  });
});
