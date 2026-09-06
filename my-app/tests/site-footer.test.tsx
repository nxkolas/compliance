import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SiteFooter } from "@/components/site-footer";
import { getDefaultDictionary } from "@/lib/i18n";

const navigation = vi.hoisted(() => ({
  pathname: "/tool/organizations/organization-1",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}));

describe("SiteFooter", () => {
  it("renders the landing-page links and aligns tool pages after the sidebar", () => {
    const dictionary = getDefaultDictionary();
    const html = renderToStaticMarkup(
      <SiteFooter
        labels={dictionary.home.footer}
        navigationLabel={dictionary.legal.footerNavigationLabel}
      />,
    );

    expect(html).toContain("data-site-footer");
    expect(html).toContain("xl:pl-[clamp(18rem,24vw,24rem)]");
    expect(html).toContain('href="/imprint"');
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('href="/licenses.html"');
    expect(html).toContain('href="/cookie"');
  });

  it("uses the privacy-page background and marks its link as current", () => {
    navigation.pathname = "/privacy";
    const dictionary = getDefaultDictionary();
    const html = renderToStaticMarkup(
      <SiteFooter
        labels={dictionary.home.footer}
        navigationLabel={dictionary.legal.footerNavigationLabel}
      />,
    );

    expect(html).toContain("bg-[#02040E]");
    expect(html).not.toContain("xl:pl-[clamp(18rem,24vw,24rem)]");
    expect(html).toMatch(/<a[^>]*aria-current="page"[^>]*href="\/privacy"/);

    navigation.pathname = "/tool/organizations/organization-1";
  });
});
